import { Context } from "koa";
import http from "http";
import https from "https";
import { neteaseGet } from "./neteaseClient";

const REAL_IP = (process.env.NETEASE_REAL_IP || "").trim();
const CONNECT_TIMEOUT_MS = 15000;

const STREAM_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function resolvePlayUrl(id: string, level: string, cookie?: string): Promise<string> {
  const base: Record<string, string | number> = { timestamp: Date.now() };
  if (REAL_IP) base.realIP = REAL_IP;

  try {
    const resp = await neteaseGet("/song/url/v1", { ...base, id, level }, cookie, "pc");
    const item = Array.isArray((resp.data as any)?.data) ? (resp.data as any).data[0] : null;
    const fee = Number(item?.fee || 0);
    const previewOnly = item?.freeTrialInfo != null;
    if (item?.url && !(fee > 0 && previewOnly)) return String(item.url);
  } catch {
    // fall through to legacy endpoint
  }

  try {
    const resp = await neteaseGet("/song/url", { ...base, id, br: 320000 }, cookie, "pc");
    const item = Array.isArray((resp.data as any)?.data) ? (resp.data as any).data[0] : null;
    if (item?.url) return String(item.url);
  } catch {
    // give up
  }

  return "";
}

interface UpstreamConn {
  req: http.ClientRequest;
  res: http.IncomingMessage;
}

function proxyOnce(
  targetUrl: string,
  range: string | undefined,
  redirectsLeft: number,
): Promise<UpstreamConn> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(targetUrl);
    } catch (e) {
      reject(e);
      return;
    }

    const lib = url.protocol === "https:" ? https : http;
    const headers: Record<string, string> = {
      "User-Agent": STREAM_UA,
      Accept: "*/*",
    };
    if (range) headers.Range = range;

    const req = lib.request(url, { method: "GET", headers }, (res) => {
      clearTimeout(connectTimer);
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        req.destroy();
        const next = new URL(res.headers.location, url).toString();
        proxyOnce(next, range, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      resolve({ req, res });
    });

    // Only guard the *connection* phase. Once streaming starts we must NOT kill
    // the socket on idle, or the browser pausing/buffering would drop playback.
    const connectTimer = setTimeout(() => {
      req.destroy(new Error("Upstream connect timeout"));
    }, CONNECT_TIMEOUT_MS);

    req.on("error", (e) => {
      clearTimeout(connectTimer);
      reject(e);
    });
    req.end();
  });
}

export async function streamTrack(ctx: Context) {
  const id = String(ctx.query.id || "").trim();
  if (!id) {
    ctx.status = 400;
    ctx.body = { code: 400, message: "Missing id" };
    return;
  }

  const level = String(ctx.query.level || "exhigh").trim() || "exhigh";
  const cookie = String(process.env.NETEASE_MUSIC_COOKIE || "").trim() || undefined;

  const playUrl = await resolvePlayUrl(id, level, cookie);
  if (!playUrl) {
    ctx.status = 404;
    ctx.body = { code: 404, message: "No playable URL for this track" };
    return;
  }

  let conn: UpstreamConn;
  try {
    conn = await proxyOnce(playUrl, ctx.headers.range as string | undefined, 3);
  } catch (error) {
    ctx.status = 502;
    ctx.body = { code: 502, message: "Upstream fetch failed", error: (error as Error).message };
    return;
  }

  const { req: upReq, res: upstream } = conn;
  const status = upstream.statusCode || 200;

  if (status >= 400) {
    upstream.resume();
    upReq.destroy();
    ctx.status = 502;
    ctx.body = { code: 502, message: `Upstream returned ${status}` };
    return;
  }

  // Swallow upstream errors so a mid-stream ECONNRESET never crashes the process.
  upstream.on("error", () => {
    try { upReq.destroy(); } catch {}
  });
  upReq.on("error", () => {
    try { upstream.destroy(); } catch {}
  });
  // When the browser aborts (seek / next / pause / navigate away), tear down the
  // upstream connection too, otherwise sockets leak and eventually exhaust.
  const abortUpstream = () => {
    try { upReq.destroy(); } catch {}
    try { upstream.destroy(); } catch {}
  };
  ctx.req.on("close", abortUpstream);
  ctx.req.on("aborted", abortUpstream);

  ctx.status = status; // 200 full, 206 partial (range)
  ctx.set("Accept-Ranges", "bytes");
  ctx.set("Content-Type", String(upstream.headers["content-type"] || "audio/mpeg"));
  if (upstream.headers["content-length"]) {
    ctx.set("Content-Length", String(upstream.headers["content-length"]));
  }
  if (upstream.headers["content-range"]) {
    ctx.set("Content-Range", String(upstream.headers["content-range"]));
  }
  ctx.set("Cache-Control", "public, max-age=3600");
  ctx.body = upstream;
}
