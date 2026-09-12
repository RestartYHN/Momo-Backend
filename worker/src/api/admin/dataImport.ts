import { Context } from 'hono';
import { Bindings } from '../../bindings';
import { setSetting } from '../../utils/settings';

export const importComments = async (c: Context<{ Bindings: Bindings }>) => {
  const body = await c.req.json<{ comments: Record<string, any>[]; likes?: any[]; reactions?: any[] }>();
  if (!body?.comments || !Array.isArray(body.comments)) {
    return c.json({ code: 400, message: "请求体须包含 comments 数组" });
  }

  const likes = Array.isArray(body.likes) ? body.likes : [];
  const reactions = Array.isArray(body.reactions) ? body.reactions : [];

  let imported = 0;
  const errors: string[] = [];
  // original exported id -> newly inserted id, so likes/reactions/parents can be re-linked
  const idMap = new Map<number, number>();
  const inserted: { newId?: number; oldId?: any; oldParentId: any }[] = [];

  for (let i = 0; i < body.comments.length; i++) {
    const item = body.comments[i];
    try {
      if (!item.postSlug && !item.post_slug) { errors.push(`第 ${i + 1} 条缺少 postSlug`); continue; }
      if (!item.author) { errors.push(`第 ${i + 1} 条缺少 author`); continue; }
      if (!item.email) { errors.push(`第 ${i + 1} 条缺少 email`); continue; }
      if (!item.contentText && !item.content_text) { errors.push(`第 ${i + 1} 条缺少 contentText`); continue; }

      const postSlug = item.postSlug || item.post_slug;
      const author = item.author;
      const email = item.email;
      const contentText = item.contentText || item.content_text;
      const contentHtml = item.contentHtml || item.content_html || contentText;
      const pubDate = item.pubDate || item.pub_date || new Date().toISOString();
      const status = item.status || 'approved';
      const parentId = item.parentId || item.parent_id || null;
      const url = item.url || null;
      const ipAddress = item.ipAddress || item.ip_address || null;
      const os = item.os || null;
      const browser = item.browser || null;

      const res = await c.env.MOMO_DB.prepare(
        `INSERT INTO Comment (post_slug, author, email, url, ip_address, os, browser, content_text, content_html, parent_id, status, pub_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(postSlug, author, email, url, ipAddress, os, browser, contentText, contentHtml, parentId, status, pubDate).run();

      const newId = (res.meta as { last_row_id?: number } | null)?.last_row_id;
      if (item.id != null && newId != null) idMap.set(Number(item.id), Number(newId));
      inserted.push({ newId, oldId: item.id, oldParentId: parentId });
      imported++;
    } catch (e: any) {
      errors.push(`第 ${i + 1} 条导入失败: ${e.message}`);
    }
  }

  // Re-link parent ids to the freshly inserted rows.
  for (const rec of inserted) {
    if (!rec.newId || rec.oldParentId == null) continue;
    const mapped = idMap.get(Number(rec.oldParentId));
    if (mapped && mapped !== Number(rec.oldParentId)) {
      try {
        await c.env.MOMO_DB.prepare('UPDATE Comment SET parent_id = ? WHERE id = ?').bind(mapped, rec.newId).run();
      } catch (e: any) {
        errors.push(`父子关系修正失败: ${e.message}`);
      }
    }
  }

  // Restore likes and reactions, then rebuild the denormalised like_count.
  let restoredLikes = 0;
  let restoredReactions = 0;
  try {
    for (const l of likes) {
      const cid = idMap.get(Number(l.commentId));
      if (!cid || l.fingerprint == null) continue;
      await c.env.MOMO_DB.prepare(
        'INSERT OR IGNORE INTO CommentLike (comment_id, fingerprint, created_at) VALUES (?, ?, ?)'
      ).bind(cid, String(l.fingerprint), l.createdAt || new Date().toISOString()).run();
      restoredLikes++;
    }
    for (const r of reactions) {
      const cid = idMap.get(Number(r.commentId));
      if (!cid || r.reactionType == null) continue;
      await c.env.MOMO_DB.prepare(
        'INSERT OR IGNORE INTO CommentReaction (comment_id, fingerprint, reaction_type, created_at) VALUES (?, ?, ?, ?)'
      ).bind(cid, String(r.fingerprint ?? ''), String(r.reactionType), r.createdAt || new Date().toISOString()).run();
      restoredReactions++;
    }
    const affected = new Set<number>();
    for (const l of likes) {
      const cid = idMap.get(Number(l.commentId));
      if (cid) affected.add(cid);
    }
    for (const cid of affected) {
      await c.env.MOMO_DB.prepare(
        'UPDATE Comment SET like_count = (SELECT COUNT(*) FROM CommentLike WHERE comment_id = ?) WHERE id = ?'
      ).bind(cid, cid).run();
    }
  } catch (e: any) {
    errors.push(`点赞/表情恢复失败: ${e.message}`);
  }

  return c.json({
    code: 200,
    message: `导入完成，成功 ${imported} 条${errors.length ? `，失败 ${errors.length} 条` : ''}`,
    data: { imported, likes: restoredLikes, reactions: restoredReactions, errors: errors.length > 0 ? errors : undefined },
  });
};

export const importSettings = async (c: Context<{ Bindings: Bindings }>) => {
  const body = await c.req.json<Record<string, string>>();
  if (!body || typeof body !== "object") {
    return c.json({ code: 400, message: "请提供有效的设置数据" });
  }

  const allowList = new Set([
    "site_name", "admin_email", "admin_name",
    "smtp_host", "smtp_port", "email_user", "email_password", "email_secure",
    "allow_origin", "email_enabled",
    "reply_template", "notification_template",
  ]);

  const updated: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (allowList.has(key) && value !== undefined && value !== null) {
      await setSetting(c.env, key, String(value));
      updated.push(key);
    }
  }

  return c.json({
    code: 200,
    message: `设置导入完成，已更新 ${updated.length} 项`,
    data: { updated },
  });
};
