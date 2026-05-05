import { Context } from 'hono';
import { Bindings } from '../../bindings';

export const statsOverview = async (c: Context<{ Bindings: Bindings }>) => {
  const rangeParam = c.req.query('range');
  const range = rangeParam ? parseInt(rangeParam) : 7;
  const isAll = rangeParam === 'all' || range === 0;

  // 1. 总评论数
  const totalComments = await c.env.MOMO_DB.prepare(
    "SELECT COUNT(*) as count FROM Comment"
  ).first<{ count: number }>();

  // 2. 总用户数
  const totalUsers = await c.env.MOMO_DB.prepare(
    "SELECT COUNT(*) as count FROM (SELECT DISTINCT author, email FROM Comment)"
  ).first<{ count: number }>();

  // 3. 总文章数
  const totalPosts = await c.env.MOMO_DB.prepare(
    "SELECT COUNT(DISTINCT post_slug) as count FROM Comment"
  ).first<{ count: number }>();

  // 4. 状态分布
  const statusRows = await c.env.MOMO_DB.prepare(
    "SELECT status, COUNT(*) as count FROM Comment GROUP BY status"
  ).all<{ status: string; count: number }>();

  const statusDistribution = { approved: 0, pending: 0, deleted: 0 };
  for (const row of statusRows.results || []) {
    if (row.status === 'approved') statusDistribution.approved = row.count;
    else if (row.status === 'pending') statusDistribution.pending = row.count;
    else if (row.status === 'deleted') statusDistribution.deleted = row.count;
  }

  // 5. 最近趋势
  const recentComments: { date: string; count: number }[] = [];

  if (isAll) {
    // 最近 12 个月：按月聚合
    const monthlyMap = new Map<string, number>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, 0);
    }
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const monthlyRows = await c.env.MOMO_DB.prepare(
      "SELECT substr(pub_date, 1, 7) as month_str, COUNT(*) as count FROM Comment WHERE pub_date >= ? GROUP BY month_str ORDER BY month_str ASC"
    ).bind(twelveMonthsAgo.toISOString()).all<{ month_str: string; count: number }>();
    for (const row of monthlyRows.results || []) {
      if (monthlyMap.has(row.month_str)) {
        monthlyMap.set(row.month_str, row.count);
      }
    }
    for (const [date, count] of monthlyMap.entries()) {
      recentComments.push({ date, count });
    }
  } else {
    const daysBack = range - 1;
    const dateCountMap = new Map<string, number>();
    for (let i = daysBack; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dateCountMap.set(key, 0);
    }
    const sd = new Date();
    sd.setDate(sd.getDate() - daysBack);
    const recentRows = await c.env.MOMO_DB.prepare(
      "SELECT substr(pub_date, 1, 10) as date_str, COUNT(*) as count FROM Comment WHERE pub_date >= ? GROUP BY date_str ORDER BY date_str ASC"
    ).bind(sd.toISOString()).all<{ date_str: string; count: number }>();

    for (const row of recentRows.results || []) {
      if (dateCountMap.has(row.date_str)) {
        dateCountMap.set(row.date_str, row.count);
      }
    }
    for (const [date, count] of dateCountMap.entries()) {
      recentComments.push({ date, count });
    }
  }

  // 6. 热门评论者 Top 5
  const topRows = await c.env.MOMO_DB.prepare(
    "SELECT author, email, COUNT(*) as count, MAX(pub_date) as last_date FROM Comment GROUP BY author, email ORDER BY count DESC LIMIT 5"
  ).all<{ author: string; email: string; count: number; last_date: string }>();

  const topCommenters = (topRows.results || []).map(r => ({
    author: r.author,
    email: r.email,
    count: r.count,
    lastCommentDate: r.last_date
  }));

  return c.json({
    code: 200,
    message: "Stats fetched successfully",
    data: {
      totalComments: totalComments?.count || 0,
      totalUsers: totalUsers?.count || 0,
      totalPosts: totalPosts?.count || 0,
      statusDistribution,
      recentComments,
      topCommenters
    }
  });
};
