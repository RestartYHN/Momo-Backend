import type koa from "koa";
import { getAllSettings } from "../../utils/settings";
import { CommentsModel } from "../../orm/prisma";
import { checkKey, extractToken } from "../../utils/security";
import pkg from "../../../package.json";

function checkAuth(ctx: koa.Context): boolean {
  const authHeader = ctx.get("Authorization");
  const key = extractToken(authHeader);
  if (!key || !checkKey(key)) {
    ctx.status = 401;
    ctx.body = { code: 401, message: "Invalid token" };
    return false;
  }
  return true;
}

// 导出系统设置（含 email_password，不含 admin_name/admin_password）
export async function exportSettings(ctx: koa.Context) {
  if (!checkAuth(ctx)) return;

  const all = await getAllSettings();

  const allowList: Record<string, boolean> = {
    "site_name": true, "admin_email": true,
    "smtp_host": true, "smtp_port": true, "email_user": true, "email_password": true, "email_secure": true,
    "allow_origin": true, "email_enabled": true,
    "reply_template": true, "notification_template": true,
  };

  const filtered: Record<string, string> = {};
  for (const key of Object.keys(allowList)) {
    if (key in all) {
      filtered[key] = all[key];
    }
  }
  if (!("email_enabled" in filtered)) {
    filtered.email_enabled = "true";
  }

  ctx.body = {
    code: 200,
    message: "Settings exported",
    data: {
      exportedAt: new Date().toISOString(),
      type: "settings",
      version: pkg.version,
      settings: filtered,
    },
  };
}

// 导出评论数据
export async function exportComments(ctx: koa.Context) {
  if (!checkAuth(ctx)) return;

  const comments = await CommentsModel.findMany({
    orderBy: { pub_date: "asc" },
  });

  const mapped = comments.map((c) => ({
    id: c.id,
    pubDate: c.pub_date.toISOString(),
    postSlug: c.post_slug,
    author: c.author,
    email: c.email,
    url: c.url || undefined,
    ipAddress: c.ip_address || "",
    os: c.os || "",
    browser: c.browser || "",
    contentText: c.content_text,
    contentHtml: c.content_html,
    parentId: c.parent_id || undefined,
    status: c.status,
  }));

  ctx.body = {
    code: 200,
    message: "Comments exported",
    data: {
      exportedAt: new Date().toISOString(),
      type: "comments",
      version: pkg.version,
      total: mapped.length,
      comments: mapped,
    },
  };
}
