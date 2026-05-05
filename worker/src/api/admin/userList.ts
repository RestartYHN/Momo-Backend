import { Context } from 'hono';
import { Bindings } from '../../bindings';

export const userList = async (c: Context<{ Bindings: Bindings }>) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = (page - 1) * limit;

  const totalCount = await c.env.MOMO_DB.prepare(
    "SELECT COUNT(*) as count FROM (SELECT DISTINCT author, email FROM Comment)"
  ).first<{ count: number }>();

  const { results } = await c.env.MOMO_DB.prepare(`
    SELECT
      author, email,
      COUNT(*) as commentCount,
      COALESCE(SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END), 0) as approvedCount,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pendingCount,
      COALESCE(SUM(CASE WHEN status = 'deleted' THEN 1 ELSE 0 END), 0) as deletedCount,
      MIN(pub_date) as firstCommentDate,
      MAX(pub_date) as lastCommentDate
    FROM Comment
    GROUP BY author, email
    ORDER BY commentCount DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  return c.json({
    code: 200,
    message: "Users fetched successfully",
    data: {
      users: results || [],
      pagination: {
        page,
        limit,
        totalPage: Math.ceil((totalCount?.count || 0) / limit)
      }
    }
  });
};
