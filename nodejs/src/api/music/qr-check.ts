import { Context } from "koa";
import { getQrSession, getTokenSession, saveTokenSession } from "./sessionStore";
import { mergeCookies, neteaseGet } from "./neteaseClient";

const trackCache = new Map<string, { expiresAt: number; data: unknown }>();
const TRACK_TTL_MS = 10 * 60 * 1000;

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
  const urlData = urlResp.data as any;
  const lrcData = lrcResp.data as any;
  const song = Array.isArray(detailData.songs) ? detailData.songs[0] : undefined;
  const urlItem = Array.isArray(urlData.data) ? urlData.data[0] : undefined;
  const lyricText = typeof lrcData.lrc?.lyric === "string" ? lrcData.lrc.lyric : "";
  const translatedLyricText = typeof lrcData.tlyric?.lyric === "string" ? lrcData.tlyric.lyric : "";

  const data = {
    id,
    title: song?.name || `Song ${id}`,
    artist: Array.isArray(song?.ar) ? song.ar.map((item: any) => item?.name || "Unknown").join(", ") : "Unknown Artist",
    cover: song?.al?.picUrl || "",
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
    const firstPlaylistResp = await neteaseGet(
      "/playlist/track/all",
      { id: firstPlaylistId, limit: 100, offset: 0, timestamp: Date.now() },
      undefined,
      "pc",
    );
    const songsRaw = Array.isArray(firstPlaylistResp.data.songs)
      ? (firstPlaylistResp.data.songs as Array<{ id?: number }>)
      : [];
    recentSongs = songsRaw
      .map((s) => (s.id !== undefined ? String(s.id) : ""))
      .filter(Boolean)
      .slice(0, 100);
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

    const playlistResp = await neteaseGet(
      "/playlist/track/all",
      { id: playlistId, limit: 200, offset: 0, timestamp: Date.now() },
      session.cookie,
      "pc",
    );

    const songsRaw = Array.isArray(playlistResp.data.songs)
      ? (playlistResp.data.songs as Array<{ id?: number }>)
      : [];

    const songs = songsRaw
      .map((s) => (s.id !== undefined ? String(s.id) : ""))
      .filter(Boolean)
      .slice(0, 200);

    ctx.body = {
      code: 200,
      message: "Playlist songs retrieved",
      data: {
        playlistId,
        songs,
      },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      code: 500,
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

    const playlistResp = await neteaseGet(
      "/playlist/track/all",
      { id: playlistId, limit: 200, offset: 0, timestamp: Date.now() },
      undefined,
      "pc",
    );

    const songsRaw = Array.isArray(playlistResp.data.songs)
      ? (playlistResp.data.songs as Array<{ id?: number }>)
      : [];

    const songs = songsRaw
      .map((s) => (s.id !== undefined ? String(s.id) : ""))
      .filter(Boolean)
      .slice(0, 200);

    ctx.body = {
      code: 200,
      message: "Public playlist songs retrieved",
      data: {
        playlistId,
        songs,
      },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      code: 500,
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

    const playlistResp = await neteaseGet(
      "/playlist/track/all",
      { id: playlistId, limit: 200, offset: 0, timestamp: Date.now() },
      cookie,
      "pc",
    );

    const songsRaw = Array.isArray(playlistResp.data.songs)
      ? (playlistResp.data.songs as Array<{ id?: number }>)
      : [];

    const songs = songsRaw
      .map((s) => (s.id !== undefined ? String(s.id) : ""))
      .filter(Boolean)
      .slice(0, 200);

    ctx.body = {
      code: 200,
      message: "Cookie playlist songs retrieved",
      data: {
        playlistId,
        songs,
      },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      code: 500,
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
