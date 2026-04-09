import http from "http";
import https from "https";

export type NeteaseClientProfile = "pc" | "web";

export const PC_CLIENT_COOKIE =
  "os=pc; appver=2.10.2; channel=netease; __remember_me=true;";
export const WEB_CLIENT_COOKIE =
  "os=ios; appver=8.10.30; channel=netease; __remember_me=true;";

const DEFAULT_API_BASE = "http://127.0.0.1:3000";
const API_BASE = (process.env.NETEASE_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");

const PC_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const WEB_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";

function getAgent(protocol: string) {
  if (protocol === "https:") {
    return new https.Agent({ keepAlive: true });
  }
  return new http.Agent({ keepAlive: true });
}

export function mergeCookies(...cookies: Array<string | undefined>): string {
  const map = new Map<string, string>();

  for (const cookie of cookies) {
    if (!cookie) continue;
    const parts = cookie
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => x.includes("="));

    for (const part of parts) {
      const idx = part.indexOf("=");
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (!key) continue;
      map.set(key, value);
    }
  }

  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function fromSetCookieHeader(setCookie: string[] | undefined): string {
  if (!setCookie || !setCookie.length) return "";
  const pairs = setCookie
    .map((item) => item.split(";")[0])
    .filter(Boolean)
    .join("; ");
  return pairs;
}

function toQuery(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, String(value));
  }
  return search.toString();
}

interface NeteaseResponse {
  data: any;
  setCookie: string;
  statusCode: number;
}

export async function neteaseGet(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  cookie?: string,
  profile: NeteaseClientProfile = "pc",
): Promise<NeteaseResponse> {
  const query = toQuery(params);
  const requestUrl = `${API_BASE}${path}${query ? `?${query}` : ""}`;
  const url = new URL(requestUrl);
  const agent = getAgent(url.protocol);

  const seedCookie = profile === "web" ? WEB_CLIENT_COOKIE : PC_CLIENT_COOKIE;
  const cookieHeader = mergeCookies(seedCookie, cookie);

  const headers: Record<string, string> = {
    "User-Agent": profile === "web" ? WEB_UA : PC_UA,
    Accept: "application/json, text/plain, */*",
  };
  if (cookieHeader) headers.Cookie = cookieHeader;

  const response = await new Promise<{
    statusCode: number;
    body: string;
    setCookieHeader: string[] | undefined;
  }>((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        headers,
        agent,
        timeout: 12000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            body: Buffer.concat(chunks).toString("utf8"),
            setCookieHeader: res.headers["set-cookie"] as string[] | undefined,
          });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("Netease API request timeout"));
    });
    req.on("error", reject);
    req.end();
  });

  let data: any;
  try {
    data = JSON.parse(response.body || "{}");
  } catch {
    data = {
      code: response.statusCode || 500,
      message: "Invalid JSON from NetEase upstream",
      raw: response.body,
    };
  }

  return {
    data,
    setCookie: fromSetCookieHeader(response.setCookieHeader),
    statusCode: response.statusCode,
  };
}
