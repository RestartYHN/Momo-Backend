import cors from "@koa/cors"

const DEFAULT_ALLOWED_ORIGINS = ["https://restartyhn.github.io"];
const envAllowedOrigins = (process.env.ALLOW_ORIGIN ?? "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const allowedOrigins = new Set<string>([...DEFAULT_ALLOWED_ORIGINS, ...envAllowedOrigins]);

function isLocalOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

const CheckAllowOrigins = (requestOrigin: string): string => {
  const origin = String(requestOrigin || "").trim();
  if (!origin) return "";

  if (process.env.NODE_ENV === "development") {
    return "*";
  }

  if (process.env.ALLOW_ORIGIN === "*" || isLocalOrigin(origin) || allowedOrigins.has(origin)) {
    return origin;
  }

  return "";
};

const corsMiddleware = cors({
    origin: (ctx) => CheckAllowOrigins(ctx.get("Origin")),
    credentials: true
});

export default corsMiddleware;