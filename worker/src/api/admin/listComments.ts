import { Context } from 'hono';
import { Bindings } from '../../bindings';

export const listComments = async (c: Context<{ Bindings: Bindings }>) => {
  const page = parseInt(c.req.query('page') || '1');
  const status = c.req.query('status') || '';
  const slug = c.req.query('post_slug') || '';
  const limit = 10;
  const offset = (page - 1) * limit;

  let countSql = "SELECT COUNT(*) as count FROM Comment WHERE 1=1";
  let listSql = "SELECT * FROM Comment WHERE 1=1";
  const bindings: any[] = [];

  if (status) { countSql += " AND status = ?"; listSql += " AND status = ?"; bindings.push(status); }
  if (slug) { countSql += " AND post_slug = ?"; listSql += " AND post_slug = ?"; bindings.push(slug); }
  listSql += " ORDER BY pub_date DESC LIMIT ? OFFSET ?";
  bindings.push(limit, offset);

  const totalCount = await c.env.MOMO_DB.prepare(countSql).bind(
    ...(status ? [status] : [])
  ).first<{ count: number }>();

  const { results } = await c.env.MOMO_DB.prepare(listSql).bind(...bindings).all();

  const comments = (results || []).map((row: any) => ({
    id: row.id,
    pubDate: row.pub_date,
    postSlug: row.post_slug,
    author: row.author,
    email: row.email,
    url: row.url,
    ipAddress: row.ip_address,
    os: row.os,
    browser: row.browser,
    contentText: row.content_text,
    contentHtml: row.content_html,
    likeCount: row.like_count,
    status: row.status,
    pinned: row.pinned || 0
  }));

  return c.json({
    code: 200,
    message: 'Comments fetched successfully',
    data: {
      comments: comments,
      pagination: {
        page,
        limit,
        totalPage: Math.ceil((totalCount?.count || 0) / limit)
      }
    }
  });
};