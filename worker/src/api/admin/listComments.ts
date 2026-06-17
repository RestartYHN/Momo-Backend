import { Context } from 'hono';
import { Bindings } from '../../bindings';

export const listComments = async (c: Context<{ Bindings: Bindings }>) => {
  const page = parseInt(c.req.query('page') || '1');
  const status = c.req.query('status') || '';
  const slug = c.req.query('post_slug') || '';
  const exclude = c.req.query('exclude_slug') || '';
  const q = c.req.query('q') || '';
  const limit = parseInt(c.req.query('limit') || '10');
  const offset = (page - 1) * limit;

  let countSql = "SELECT COUNT(*) as count FROM Comment WHERE 1=1";
  let listSql = "SELECT * FROM Comment WHERE 1=1";
  const where: any[] = [];

  if (status) { countSql += " AND status = ?"; listSql += " AND status = ?"; where.push(status); }
  if (slug) { countSql += " AND post_slug = ?"; listSql += " AND post_slug = ?"; where.push(slug); }
  if (exclude) { countSql += " AND post_slug != ?"; listSql += " AND post_slug != ?"; where.push(exclude); }
  if (q) { countSql += " AND content_text LIKE ?"; listSql += " AND content_text LIKE ?"; where.push(`%${q}%`); }
  listSql += " ORDER BY pinned DESC, pub_date DESC LIMIT ? OFFSET ?";

  const totalCount = await c.env.MOMO_DB.prepare(countSql).bind(...where).first<{ count: number }>();
  const { results } = await c.env.MOMO_DB.prepare(listSql).bind(...where, limit, offset).all();

  const ids = (results || []).map((r: any) => r.id);
  const replyMap: Record<number, number> = {};
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const replies = await c.env.MOMO_DB.prepare(
      `SELECT parent_id, COUNT(*) as cnt FROM Comment WHERE parent_id IN (${placeholders}) GROUP BY parent_id`
    ).bind(...ids).all<{ parent_id: number; cnt: number }>();
    for (const r of replies.results || []) replyMap[r.parent_id] = r.cnt;
  }

  const comments = (results || []).map((row: any) => ({
    id: row.id,
    pubDate: row.pub_date,
    postSlug: row.post_slug,
    author: row.author,
    email: row.email,
    url: row.url,
    ipAddress: row.ip_address,
    contentText: row.content_text,
    contentHtml: row.content_html,
    parentId: row.parent_id,
    likeCount: row.like_count,
    status: row.status,
    pinned: row.pinned || 0,
    replyCount: replyMap[row.id] || 0
  }));

  return c.json({
    code: 200,
    message: 'Comments fetched successfully',
    data: {
      comments: comments,
      totalCount: totalCount?.count || 0,
      pagination: {
        page,
        limit,
        totalPage: Math.ceil((totalCount?.count || 0) / limit)
      }
    }
  });
};
