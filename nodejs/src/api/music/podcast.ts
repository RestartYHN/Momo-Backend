import { Context } from "koa";
import { neteaseGet } from "./neteaseClient";

const episodesCache = new Map<string, { expiresAt: number; data: unknown }>();
const EPISODE_TTL = 5 * 60 * 1000;

export async function getPodcastPrograms(ctx: Context) {
  try {
    const rid = String(ctx.query.rid || ctx.query.radioId || ctx.query.id || "");
    const limit = Number(ctx.query.limit || 30) || 30;
    const offset = Number(ctx.query.offset || 0) || 0;

    if (!rid) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "Missing rid/radioId/id" };
      return;
    }

    const cacheKey = `prog:${rid}:${limit}:${offset}`;
    const cached = episodesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      ctx.body = { code: 200, message: "Programs retrieved (cached)", data: cached.data };
      return;
    }

    const resp = await neteaseGet(
      "/dj/program",
      { rid, limit, offset, timestamp: Date.now() },
      undefined,
      "pc",
    );

    const data = resp.data || {};
    episodesCache.set(cacheKey, { expiresAt: Date.now() + EPISODE_TTL, data });

    ctx.body = { code: 200, message: "Programs retrieved", data };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { code: 500, message: "Failed to fetch programs", error: (error as Error).message };
  }
}

export async function getPodcastProgramDetail(ctx: Context) {
  try {
    const id = String(ctx.query.id || ctx.query.programId || "").trim();
    if (!id) {
      ctx.status = 400;
      ctx.body = { code: 400, message: "Missing id/programId" };
      return;
    }

    const cacheKey = `progdetail:${id}`;
    const cached = episodesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      ctx.body = { code: 200, message: "Program detail (cached)", data: cached.data };
      return;
    }

    const resp = await neteaseGet("/dj/program/detail", { id, timestamp: Date.now() }, undefined, "pc");
    const data = resp.data || {};

    episodesCache.set(cacheKey, { expiresAt: Date.now() + EPISODE_TTL, data });

    ctx.body = { code: 200, message: "Program detail retrieved", data };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { code: 500, message: "Failed to fetch program detail", error: (error as Error).message };
  }
}
