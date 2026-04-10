import { Context } from "koa";
import { getQrSession, getTokenSession, saveTokenSession } from "./sessionStore";
import { mergeCookies, neteaseGet } from "./neteaseClient";

const trackCache = new Map<string, { expiresAt: number; data: unknown }>();
const TRACK_TTL_MS = 10 * 60 * 1000;

function pickFirstSong(payload: any): any | undefined {
  if (Array.isArray(payload?.songs) && payload.songs.length > 0) {
    return payload.songs[0];
  }
  if (Array.isArray(payload?.data?.songs) && payload.data.songs.length > 0) {
    return payload.data.songs[0];
  }
  if (payload?.song && typeof payload.song === "object") {
    return payload.song;
  }
  return undefined;
}

function songArtist(song: any): string {
  if (Array.isArray(song?.ar) && song.ar.length > 0) {
    return song.ar.map((item: any) => item?.name || "Unknown").join(", ");
  }
  if (Array.isArray(song?.artists) && song.artists.length > 0) {
    return song.artists.map((item: any) => item?.name || "Unknown").join(", ");
  }
  return "Unknown Artist";
}

function songCover(song: any): string {
  return song?.al?.picUrl || song?.album?.picUrl || song?.picUrl || "";
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function toId(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function extractSongIdsFromPayload(payload: any): string[] {
  const songsFromList = Array.isArray(payload?.songs)
    ? payload.songs.map((s: any) => toId(s?.id)).filter(Boolean)
    : [];

  const songsFromTracks = Array.isArray(payload?.playlist?.tracks)
    ? payload.playlist.tracks.map((s: any) => toId(s?.id)).filter(Boolean)
    : [];

  const songsFromTrackIds = Array.isArray(payload?.playlist?.trackIds)
    ? payload.playlist.trackIds.map((s: any) => toId(s?.id)).filter(Boolean)
    : [];

  return uniqueIds([...songsFromList, ...songsFromTracks, ...songsFromTrackIds]).slice(0, 200);
}

function isUpstreamUnavailable(error: unknown): boolean {
  const msg = String((error as Error)?.message || "");
  return /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|timeout|Upstream NetEase API unavailable/i.test(msg);
}

async function fetchPlaylistSongIds(playlistId: string, cookie?: string) {
  const attempts: string[] = [];
  const routes: Array<{
    path: string;
    profile: "pc" | "web";
    params: Record<string, string | number>;
    source: string;
  }> = [
    {
      path: "/playlist/track/all",
      profile: "pc",
      params: { id: playlistId, limit: 200, offset: 0, timestamp: Date.now() },
      source: "track-all-pc",
    },
    {
      path: "/playlist/detail",
      profile: "pc",
      params: { id: playlistId, timestamp: Date.now() },
      source: "playlist-detail-pc",
    },
    {
      path: "/playlist/track/all",
      profile: "web",
      params: { id: playlistId, limit: 200, offset: 0, timestamp: Date.now() },
      source: "track-all-web",
    },
    {
      path: "/playlist/detail",
      profile: "web",
      params: { id: playlistId, timestamp: Date.now() },
      source: "playlist-detail-web",
    },
  ];

  let lastError: unknown;

  for (const route of routes) {
    try {
      const resp = await neteaseGet(route.path, route.params, cookie, route.profile);
      const code = Number(resp?.data?.code || resp.statusCode || 0);
      const ids = extractSongIdsFromPayload(resp?.data || {});
      attempts.push(`${route.source}:code=${code}:songs=${ids.length}`);

      if (ids.length > 0) {
        return {
          songs: ids,
          source: route.source,
          upstreamCode: code,
          attempts,
        };
      }
    } catch (error) {
      lastError = error;
      attempts.push(`${route.source}:error=${String((error as Error)?.message || error)}`);
    }
  }

  const apiBase = String(process.env.NETEASE_API_BASE || "http://127.0.0.1:3000").trim();
  const detail = attempts.join(" | ");
  const message = isUpstreamUnavailable(lastError)
    ? `Upstream NetEase API unavailable at ${apiBase}. Ensure local API on port 3000 is running.`
    : `Unable to load playlist songs for ${playlistId}. Attempts: ${detail}`;
  throw new Error(message);
}

async function fetchTrackById(id: string) {
  const cached = trackCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const [detailResp, urlResp, lrcResp] = await Promise.all([
    neteaseGet("/song/detail", { ids: id, timestamp: Date.now() }),
    neteaseGet("/song/url/v1", { id, level: "standard", timestamp: Date.now() }),
    neteaseGet("/lyric", { id, timestamp: Date.now() }),
  ]);

  const detailData = detailResp.data as any;
  let song = pickFirstSong(detailData);

  // Some upstream setups return empty songs for pc profile; web profile often still has metadata.
  if (!song) {
    try {
      const detailRespWeb = await neteaseGet(
        "/song/detail",
        { ids: id, timestamp: Date.now() },
        undefined,
        "web",
      );
      song = pickFirstSong(detailRespWeb.data);
    } catch {
      // Keep fallback title/artist below.
    }
  }

  const urlData = urlResp.data as any;
  const lrcData = lrcResp.data as any;
  const urlItem = Array.isArray(urlData.data) ? urlData.data[0] : undefined;
  const lyricText = typeof lrcData.lrc?.lyric === "string" ? lrcData.lrc.lyric : "";
  const translatedLyricText = typeof lrcData.tlyric?.lyric === "string" ? lrcData.tlyric.lyric : "";

  const data = {
    id,
    title: song?.name || `Song ${id}`,
    artist: songArtist(song),
    cover: songCover(song),
    audio: urlItem?.url || "",
    lyric: lyricText,
    tlyric: translatedLyricText,
  };

  trackCache.set(id, {
    expiresAt: Date.now() + TRACK_TTL_MS,
    data,
  });

  return data;
}

function toSongIdList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => {
      const id = (it as { id?: number | string })?.id;
      return id !== undefined ? String(id) : "";
    })
    .filter(Boolean)
    .slice(0, 100);
}

async function buildUserSnapshot(cookie: string) {
  const accountResp = await neteaseGet("/user/account", { timestamp: Date.now() }, cookie, "pc");
  const profile = (accountResp.data.profile || {}) as {
    userId?: number;
    nickname?: string;
    avatarUrl?: string;
  };
  const userId = profile.userId ? String(profile.userId) : "";

  if (!userId) {
    throw new Error("Unable to resolve user ID after QR login");
  }

  const [playlistResp, recentResp, likeResp] = await Promise.all([
    neteaseGet("/user/playlist", { uid: userId, limit: 50, timestamp: Date.now() }, cookie, "pc"),
    neteaseGet("/record/recent/song", { limit: 100, timestamp: Date.now() }, cookie, "pc"),
    neteaseGet("/likelist", { uid: userId, timestamp: Date.now() }, cookie, "pc"),
  ]);

  const playlistsRaw = Array.isArray(playlistResp.data.playlist)
    ? (playlistResp.data.playlist as Array<{ id?: number; name?: string; trackCount?: number }>)
    : [];

  const recentData = (recentResp.data.data || {}) as { list?: Array<{ data?: { id?: number } }> };
  const recentHistory = Array.isArray(recentData.list)
    ? recentData.list
        .map((x) => {
          const id = x?.data?.id;
          const playedAt = (x as any)?.playTime || (x as any)?.data?.playTime || 0;
          if (id === undefined) return null;
          return {
            id: String(id),
            playedAt: Number(playedAt) || 0,
          };
        })
        .filter(Boolean)
        .slice(0, 100)
    : [];
  const recentSongs = Array.isArray(recentData.list)
    ? recentData.list
        .map((x) => (x.data?.id !== undefined ? String(x.data.id) : ""))
        .filter(Boolean)
        .slice(0, 100)
    : [];

  const favoriteSongs = toSongIdList(likeResp.data.ids);

  return {
    userId,
    username: profile.nickname || "NetEase User",
    avatarUrl: profile.avatarUrl || "",
    playlists: playlistsRaw.map((pl) => ({
      id: pl.id ? String(pl.id) : "",
      name: pl.name || "Playlist",
      songCount: pl.trackCount || 0,
    })),
    recentSongs,
    recentHistory,
    favoriteSongs,
  };
}

async function buildPublicSnapshot(userId: string) {
  const accountResp = await neteaseGet(
    "/user/detail",
    { uid: userId, timestamp: Date.now() },
    undefined,
    "pc",
  );

  const profile = (accountResp.data.profile || {}) as {
    userId?: number;
    nickname?: string;
    avatarUrl?: string;
  };
  const resolvedUserId = profile.userId ? String(profile.userId) : String(userId);

  const playlistResp = await neteaseGet(
    "/user/playlist",
    { uid: resolvedUserId, limit: 50, timestamp: Date.now() },
    undefined,
    "pc",
  );

  const playlistsRaw = Array.isArray(playlistResp.data.playlist)
    ? (playlistResp.data.playlist as Array<{ id?: number; name?: string; trackCount?: number }>)
    : [];

  const firstPlaylistId = playlistsRaw[0]?.id ? String(playlistsRaw[0].id) : "";
  let recentSongs: string[] = [];
  if (firstPlaylistId) {
    const snapshotSongs = await fetchPlaylistSongIds(firstPlaylistId);
    recentSongs = snapshotSongs.songs.slice(0, 100);
  }

  return {
    userId: resolvedUserId,
    username: profile.nickname || "NetEase User",
    avatarUrl: profile.avatarUrl || "",
    playlists: playlistsRaw.map((pl) => ({
      id: pl.id ? String(pl.id) : "",
      name: pl.name || "Playlist",
      songCount: pl.trackCount || 0,
    })),
    recentSongs,
    recentHistory: [],
    favoriteSongs: recentSongs,
    source: "public-profile",
  };
}

export async function checkQrStatus(ctx: Context) {
  try {
    const qrId = String(ctx.query.qrId || "");

    if (!qrId) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: "Missing qrId parameter",
      };
      return;
    }

    const qrSession = getQrSession(qrId);
    if (!qrSession) {
      ctx.body = {
        code: 200,
        message: "QR code expired",
        data: {
          status: "expired",
        },
      };
      return;
    }

    const checkResp = await neteaseGet(
      "/login/qr/check",
      {
        key: qrId,
        timestamp: Date.now(),
      },
      qrSession.cookie,
      "pc",
    );

    const neteaseCode = Number(checkResp.data.code || 0);

    if (neteaseCode === 800) {
      ctx.body = {
        code: 200,
        message: "QR code expired",
        data: { status: "expired" },
      };
      return;
    }

    if (neteaseCode === 801) {
      ctx.body = {
        code: 200,
        message: "Waiting for scan",
        data: { status: "pending" },
      };
      return;
    }

    if (neteaseCode === 802) {
      ctx.body = {
        code: 200,
        message: "Scanned, waiting confirmation",
        data: { status: "authorized" },
      };
      return;
    }

    if (neteaseCode === 803) {
      const mergedCookie = mergeCookies(qrSession.cookie, checkResp.setCookie);
      if (!mergedCookie) {
        ctx.status = 502;
        ctx.body = {
          code: 502,
          message: "Login succeeded but no cookie was returned by NetEase API",
        };
        return;
      }

      const user = await buildUserSnapshot(mergedCookie);
      const token = saveTokenSession({
        cookie: mergedCookie,
        userId: user.userId,
        profile: {
          userId: user.userId,
          username: user.username,
          avatarUrl: user.avatarUrl,
        },
      });

      ctx.body = {
        code: 200,
        message: "QR code confirmed",
        data: {
          status: "confirmed",
          user,
          token,
        },
      };
      return;
    }

    if (neteaseCode === 502) {
      const rawMessage = String(checkResp.data.message || "");
      const blocked = /环境异常|abnormal|risk|block/i.test(rawMessage);
      ctx.body = {
        code: 200,
        message: blocked ? "QR login blocked by risk control" : "QR check returned 502",
        data: {
          status: blocked ? "blocked" : "pending",
          raw: checkResp.data,
        },
      };
      return;
    }

    ctx.body = {
      code: 200,
      message: "Unhandled QR state",
      data: {
        status: "pending",
        raw: checkResp.data,
      },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: "Failed to check QR status",
      error: (error as Error).message,
    };
  }
}

export async function getUserData(ctx: Context) {
  try {
    const token = String(ctx.query.token || "");

    if (!token) {
      ctx.status = 401;
      ctx.body = {
        code: 401,
        message: "Unauthorized - missing token",
      };
      return;
    }

    const session = getTokenSession(token);
    if (!session) {
      ctx.status = 401;
      ctx.body = {
        code: 401,
        message: "Invalid or expired token",
      };
      return;
    }

    const user = await buildUserSnapshot(session.cookie);

    ctx.body = {
      code: 200,
      message: "User data retrieved",
      data: user,
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: "Failed to get user data",
      error: (error as Error).message,
    };
  }
}

export async function getPlaylistSongs(ctx: Context) {
  try {
    const token = String(ctx.query.token || "");
    const playlistId = String(ctx.query.playlistId || "");

    if (!token || !playlistId) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: "Missing token or playlistId",
      };
      return;
    }

    const session = getTokenSession(token);
    if (!session) {
      ctx.status = 401;
      ctx.body = {
        code: 401,
        message: "Invalid or expired token",
      };
      return;
    }

    const playlistData = await fetchPlaylistSongIds(playlistId, session.cookie);

    ctx.body = {
      code: 200,
      message: "Playlist songs retrieved",
      data: {
        playlistId,
        songs: playlistData.songs,
        source: playlistData.source,
      },
    };
  } catch (error) {
    ctx.status = isUpstreamUnavailable(error) ? 503 : 500;
    ctx.body = {
      code: ctx.status,
      message: "Failed to get playlist songs",
      error: (error as Error).message,
    };
  }
}

export async function getPublicUserData(ctx: Context) {
  try {
    const userId = String(ctx.query.uid || "").trim();
    if (!userId) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: "Missing uid",
      };
      return;
    }

    const user = await buildPublicSnapshot(userId);
    ctx.body = {
      code: 200,
      message: "Public user data retrieved",
      data: user,
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: "Failed to get public user data",
      error: (error as Error).message,
    };
  }
}

export async function getPublicPlaylistSongs(ctx: Context) {
  try {
    const playlistId = String(ctx.query.playlistId || "").trim();

    if (!playlistId) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: "Missing playlistId",
      };
      return;
    }

    const playlistData = await fetchPlaylistSongIds(playlistId);

    ctx.body = {
      code: 200,
      message: "Public playlist songs retrieved",
      data: {
        playlistId,
        songs: playlistData.songs,
        source: playlistData.source,
      },
    };
  } catch (error) {
    ctx.status = isUpstreamUnavailable(error) ? 503 : 500;
    ctx.body = {
      code: ctx.status,
      message: "Failed to get public playlist songs",
      error: (error as Error).message,
    };
  }
}

export async function getCookieUserData(ctx: Context) {
  try {
    const cookie = String(process.env.NETEASE_MUSIC_COOKIE || "").trim();
    if (!cookie) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: "NETEASE_MUSIC_COOKIE is not configured",
      };
      return;
    }

    const user = await buildUserSnapshot(cookie);
    ctx.body = {
      code: 200,
      message: "Cookie user data retrieved",
      data: user,
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: "Failed to get cookie user data",
      error: (error as Error).message,
    };
  }
}

export async function getCookiePlaylistSongs(ctx: Context) {
  try {
    const cookie = String(process.env.NETEASE_MUSIC_COOKIE || "").trim();
    const playlistId = String(ctx.query.playlistId || "").trim();

    if (!cookie) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: "NETEASE_MUSIC_COOKIE is not configured",
      };
      return;
    }

    if (!playlistId) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: "Missing playlistId",
      };
      return;
    }

    const playlistData = await fetchPlaylistSongIds(playlistId, cookie);

    ctx.body = {
      code: 200,
      message: "Cookie playlist songs retrieved",
      data: {
        playlistId,
        songs: playlistData.songs,
        source: playlistData.source,
      },
    };
  } catch (error) {
    ctx.status = isUpstreamUnavailable(error) ? 503 : 500;
    ctx.body = {
      code: ctx.status,
      message: "Failed to get cookie playlist songs",
      error: (error as Error).message,
    };
  }
}

export async function getTrack(ctx: Context) {
  try {
    const id = String(ctx.query.id || "");
    if (!id) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: "Missing id",
      };
      return;
    }

    const track = await fetchTrackById(id);
    ctx.body = {
      code: 200,
      message: "Track retrieved",
      data: track,
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: "Failed to get track",
      error: (error as Error).message,
    };
  }
}
