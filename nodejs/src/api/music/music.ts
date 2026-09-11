import { Context } from "koa";
import { neteaseGet } from "./neteaseClient";

const REAL_IP = (process.env.NETEASE_REAL_IP || "").trim();

// Only metadata (detail + lyric) is cached; it is stable. The playback URL is a
// short-lived, signed NetEase CDN link and must be resolved fresh on every call,
// otherwise a cached link expires and the browser gets a 403.
const metaCache = new Map<string, { expiresAt: number; meta: any }>();
const META_TTL_MS = 30 * 60 * 1000;

// Playlist track metadata (title/artist/cover) is stable and large; cache it so
// re-entering the page does not refetch hundreds of songs from the upstream API.
const MAX_PLAYLIST_TRACKS = 500;
const playlistCache = new Map<string, { expiresAt: number; songs: string[]; tracks: any[] }>();
const PLAYLIST_TTL_MS = 10 * 60 * 1000;

function mapPlaylistTracks(songsRaw: any[], limit: number) {
  return songsRaw
    .map((s: any) => ({
      id: s?.id !== undefined ? String(s.id) : "",
      title: s?.name || "Unknown",
      artist: Array.isArray(s?.ar) ? s.ar.map((a: any) => a?.name || "Unknown").join(", ") : "Unknown Artist",
      cover: s?.al?.picUrl || "",
    }))
    .filter((t) => t.id)
    .slice(0, limit);
}

// One upstream call returns the whole playlist's metadata (no N+1 per-track fetch).
async function fetchPlaylistTracks(playlistId: string, cookie: string | undefined, limit: number) {
  const cacheKey = `${playlistId}:${cookie ? "c" : "p"}`;
  const cached = playlistCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { songs: cached.songs, tracks: cached.tracks };
  }

  const resp = await neteaseGet(
    "/playlist/track/all",
    { id: playlistId, limit, offset: 0, timestamp: Date.now() },
    cookie,
    "pc",
  );
  const songsRaw = Array.isArray(resp.data?.songs) ? (resp.data.songs as any[]) : [];
  const tracks = mapPlaylistTracks(songsRaw, limit);
  const songs = tracks.map((t) => t.id);

  playlistCache.set(cacheKey, { expiresAt: Date.now() + PLAYLIST_TTL_MS, songs, tracks });
  return { songs, tracks };
}

function toHttps(u: string): string {
  return u.startsWith("http://") ? "https://" + u.slice("http://".length) : u;
}

async function resolveAudioUrl(id: string, cookie?: string): Promise<string> {
  const params: Record<string, string | number> = { id, level: "exhigh", timestamp: Date.now() };
  if (REAL_IP) params.realIP = REAL_IP;
  const resp = await neteaseGet("/song/url/v1", params, cookie, "pc");
  const item = Array.isArray((resp.data as any)?.data) ? (resp.data as any).data[0] : undefined;
  const fee = Number(item?.fee || 0);
  const isPreviewOnly = item?.freeTrialInfo != null;
  if (!item?.url || (fee > 0 && isPreviewOnly)) return "";
  return toHttps(String(item.url));
}

async function fetchTrackById(id: string, cookie?: string) {
  const cacheKey = cookie ? `${id}:vip` : id;

  let entry = metaCache.get(cacheKey);
  if (!entry || entry.expiresAt <= Date.now()) {
    const [detailResp, lrcResp] = await Promise.all([
      neteaseGet("/song/detail", { ids: id, timestamp: Date.now() }, cookie, "pc"),
      neteaseGet("/lyric", { id, timestamp: Date.now() }, cookie, "pc"),
    ]);

    const detailData = detailResp.data as any;
    const lrcData = lrcResp.data as any;
    const song = Array.isArray(detailData.songs) ? detailData.songs[0] : undefined;

    entry = {
      expiresAt: Date.now() + META_TTL_MS,
      meta: {
        id,
        title: song?.name || `Song ${id}`,
        artist: Array.isArray(song?.ar) ? song.ar.map((item: any) => item?.name || "Unknown").join(", ") : "Unknown Artist",
        cover: song?.al?.picUrl || "",
        lyric: typeof lrcData.lrc?.lyric === "string" ? lrcData.lrc.lyric : "",
        tlyric: typeof lrcData.tlyric?.lyric === "string" ? lrcData.tlyric.lyric : "",
      },
    };
    metaCache.set(cacheKey, entry);
  }

  // Always fresh, never cached: browser plays this CDN link directly (fast, off our metered server).
  const audio = await resolveAudioUrl(id, cookie);

  return { ...entry.meta, audio };
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

  const [playlistResp, recentResp] = await Promise.all([
    neteaseGet("/user/playlist", { uid: userId, limit: 50, timestamp: Date.now() }, cookie, "pc"),
    neteaseGet("/record/recent/song", { limit: 100, timestamp: Date.now() }, cookie, "pc"),
  ]);

  const playlistsRaw = Array.isArray(playlistResp.data.playlist)
    ? (playlistResp.data.playlist as Array<{ id?: number; name?: string; trackCount?: number; specialType?: number }>)
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
  return {
    userId,
    username: profile.nickname || "NetEase User",
    avatarUrl: profile.avatarUrl || "",
    playlists: playlistsRaw
      .filter((pl) => Number(pl.specialType) !== 5)
      .map((pl) => ({
        id: pl.id ? String(pl.id) : "",
        name: pl.name || "Playlist",
        songCount: pl.trackCount || 0,
      })),
    recentHistory,
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
    ? (playlistResp.data.playlist as Array<{ id?: number; name?: string; trackCount?: number; specialType?: number }>)
    : [];

  return {
    userId: resolvedUserId,
    username: profile.nickname || "NetEase User",
    avatarUrl: profile.avatarUrl || "",
    playlists: playlistsRaw
      .filter((pl) => Number(pl.specialType) !== 5)
      .map((pl) => ({
        id: pl.id ? String(pl.id) : "",
        name: pl.name || "Playlist",
        songCount: pl.trackCount || 0,
      })),
    recentHistory: [],
    source: "public-profile",
  };
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

    const { songs, tracks } = await fetchPlaylistTracks(playlistId, undefined, MAX_PLAYLIST_TRACKS);

    ctx.body = {
      code: 200,
      message: "Public playlist songs retrieved",
      data: {
        playlistId,
        songs,
        tracks,
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

    const { songs, tracks } = await fetchPlaylistTracks(playlistId, cookie, MAX_PLAYLIST_TRACKS);

    ctx.body = {
      code: 200,
      message: "Cookie playlist songs retrieved",
      data: {
        playlistId,
        songs,
        tracks,
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

    const envCookie = String(process.env.NETEASE_MUSIC_COOKIE || "").trim();
    const track = await fetchTrackById(id, envCookie || undefined);
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

export async function getUserRecord(ctx: Context) {
  try {
    const cookie = String(process.env.NETEASE_MUSIC_COOKIE || "").trim();
    if (!cookie) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "NETEASE_MUSIC_COOKIE is not configured" };
      return;
    }

    const [accountResp, realtimeResp, recentResp] = await Promise.all([
      neteaseGet("/user/account", { timestamp: Date.now() }, cookie, "pc"),
      neteaseGet("/listen/data/realtime/report", { timestamp: Date.now() }, cookie, "pc"),
      neteaseGet("/record/recent/song", { limit: "5", timestamp: Date.now() }, cookie, "pc"),
    ]);

    const uid = String((accountResp.data.profile || {}).userId || "");
    const recordResp = await neteaseGet("/user/record", { uid, type: "1", timestamp: Date.now() }, cookie, "pc");

    const rtData = (realtimeResp.data && realtimeResp.data.data) || {};
    const block = rtData.listenTimeDistributionBlock || {};
    const weekDurationMs = (Number(block.playDuration) || 0) * 60000;
    const listeningDays = Number(block.listenDays) || 0;

    const details = Array.isArray(block.durationDetails) ? block.durationDetails : [];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const today = details.find((d: any) => d.period === todayStr);
    const todayDurationMs = (Number(today?.duration) || 0) * 60000;
    let todaySongs = 0;
    try {
      const todayResp = await neteaseGet("/listen/data/today/song", { timestamp: Date.now() }, cookie, "pc");
      const tdData = (todayResp.data && todayResp.data.data) || todayResp.data || {};
      const songList = Array.isArray(tdData.songDTOs) ? tdData.songDTOs : [];
      todaySongs = songList.length;
    } catch (e) {}

    const requestType = String(ctx.query.type || "1");
    let sourceData: any[] = [];
    if (requestType === "0" && uid) {
      const allResp = await neteaseGet("/user/record", { uid, type: "0", timestamp: Date.now() }, cookie, "pc");
      sourceData = Array.isArray(allResp.data?.allData) ? allResp.data.allData : [];
    } else {
      sourceData = Array.isArray(recordResp.data?.weekData) ? recordResp.data.weekData : [];
    }

    const top = sourceData.slice(0, 100).map((item: any) => ({
      id: item.song?.id ? String(item.song.id) : "",
      title: item.song?.name || "Unknown",
      artist: Array.isArray(item.song?.ar) ? item.song.ar.map((a: any) => a.name).join(", ") : "Unknown",
      cover: item.song?.al?.picUrl || "",
      playCount: Number(item.playCount) || 0,
    }));

    const recentData = (recentResp.data && recentResp.data.data) || {};
    const recentList = Array.isArray(recentData.list) ? recentData.list : [];
    const recent = recentList.slice(0, 5).map((item: any) => ({
      id: item.data?.id ? String(item.data.id) : "",
      title: item.data?.name || "Unknown",
      artist: Array.isArray(item.data?.ar) ? item.data.ar.map((a: any) => a.name).join(", ") : "Unknown",
      cover: item.data?.al?.picUrl || "",
      playedAt: Number(item.playTime || item.data?.playTime) || 0,
    }));

    ctx.body = {
      code: 200,
      message: "User record retrieved",
      data: {
        top,
        recent,
        weekDurationMs,
        listeningDays,
        todaySongs,
        todayDurationMs,
      },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { code: 500, message: "Failed to get user record", error: (error as Error).message };
  }
}

export async function getUserAlbums(ctx: Context) {
  try {
    const cookie = String(process.env.NETEASE_MUSIC_COOKIE || "").trim();
    if (!cookie) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "NETEASE_MUSIC_COOKIE is not configured" };
      return;
    }
    const resp = await neteaseGet("/album/sublist", { limit: "100", timestamp: Date.now() }, cookie, "pc");
    const data = resp.data || {};
    const albums = Array.isArray(data.data) ? data.data : [];
    const list = albums.map((a: any) => ({
      id: String(a.id || ""),
      name: a.name || "Unknown",
      artist: a.artist?.name || "",
      cover: a.picUrl || "",
      size: Number(a.size) || 0,
    }));
    ctx.body = { code: 200, message: "Albums retrieved", data: list };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { code: 500, message: "Failed to get albums", error: (error as Error).message };
  }
}

export async function getAlbum(ctx: Context) {
  try {
    const cookie = String(process.env.NETEASE_MUSIC_COOKIE || "").trim();
    if (!cookie) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "NETEASE_MUSIC_COOKIE is not configured" };
      return;
    }
    const id = String(ctx.query.id || "").trim();
    if (!id) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "Missing id" };
      return;
    }
    const resp = await neteaseGet("/album", { id, timestamp: Date.now() }, cookie, "pc");
    const data = resp.data || {};
    const album = data.album || {};
    const songs = Array.isArray(data.songs) ? data.songs : [];
    const tracks = songs.map((s: any) => ({
      id: s.id ? String(s.id) : "",
      title: s.name || "Unknown",
      artist: Array.isArray(s.ar) ? s.ar.map((a: any) => a.name).join(", ") : "",
      cover: album.picUrl || s.al?.picUrl || "",
    }));
    ctx.body = {
      code: 200,
      message: "Album retrieved",
      data: {
        name: album.name || "",
        artist: album.artist?.name || (album.artists && album.artists[0]?.name) || "",
        cover: album.picUrl || "",
        size: Number(album.size) || songs.length,
        publishTime: album.publishTime || null,
        tracks,
      },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { code: 500, message: "Failed to get album", error: (error as Error).message };
  }
}

export async function searchSongs(ctx: Context) {
  try {
    const q = String(ctx.query.q || "").trim();
    if (!q || q.length < 2) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "Query too short" };
      return;
    }
    const cookie = String(process.env.NETEASE_MUSIC_COOKIE || "").trim();
    const resp = await neteaseGet("/cloudsearch", { keywords: q, type: "1", limit: "20", timestamp: Date.now() }, cookie || undefined, "pc");
    const data = resp.data || {};
    const result = data.result || {};
    const songs = Array.isArray(result.songs) ? result.songs : [];
    const list = songs.map((s: any) => {
      let cover = s.al?.picUrl || "";
      if (cover && cover.startsWith("http:")) cover = cover.replace("http:", "https:");
      return {
        id: s.id ? String(s.id) : "",
        title: s.name || "Unknown",
        artist: Array.isArray(s.ar) ? s.ar.map((a: any) => a.name).join(", ") : "Unknown",
        cover,
      };
    });
    ctx.body = { code: 200, message: "Search results", data: list };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { code: 500, message: "Search failed", error: (error as Error).message };
  }
}
