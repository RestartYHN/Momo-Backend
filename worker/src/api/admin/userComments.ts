import { Context } from 'hono';
import { Bindings } from '../../bindings';

export const userComments = async (c: Context<{ Bindings: Bindings }>) => {
  const author = c.req.query('author');
  const email = c.req.query('email');
  const page = parseInt(c.req.query('page') || '1');
  const limit = 10;
  const offset = (page - 1) * limit;

  if (!author || !email) {
    return c.json({ code: 400, message: "author and email are required" }, 400);
  }

  const totalCount = await c.env.MOMO_DB.prepare(
    "SELECT COUNT(*) as count FROM Comment WHERE author = ? AND email = ?"
  ).bind(author, email).first<{ count: number }>();

  const { results } = await c.env.MOMO_DB.prepare(
    "SELECT * FROM Comment WHERE author = ? AND email = ? ORDER BY pub_date DESC LIMIT ? OFFSET ?"
  ).bind(author, email, limit, offset).all();

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
    status: row.status
  }));

  return c.json({
    code: 200,
    message: "User comments fetched successfully",
    data: {
      comments,
      pagination: {
        page,
        limit,
        totalPage: Math.ceil((totalCount?.count || 0) / limit)
      }
    }
  });
};
