import { Context } from 'hono'
import { Bindings } from '../../bindings'

export const listMemoReactions = async (c: Context<{ Bindings: Bindings }>) => {
  const page = parseInt(c.req.query('page') || '1')
  const limit = 20
  const offset = (page - 1) * limit

  const { results } = await c.env.MOMO_DB.prepare(
    'SELECT memo_id, reaction_type, COUNT(*) as cnt, MAX(created_at) as last_at FROM MemoReaction GROUP BY memo_id, reaction_type ORDER BY memo_id DESC, cnt DESC LIMIT ? OFFSET ?'
  ).bind(limit, offset).all()

  const total = await c.env.MOMO_DB.prepare(
    'SELECT COUNT(DISTINCT memo_id || reaction_type) as cnt FROM MemoReaction'
  ).first<{ cnt: number }>()

  return c.json({
    data: results,
    pagination: { page, limit, totalPage: Math.ceil((total?.cnt || 0) / limit) }
  })
}

export const deleteMemoReaction = async (c: Context<{ Bindings: Bindings }>) => {
  const mid = c.req.query('memo')
  const rt = c.req.query('type')
  let sql = 'DELETE FROM MemoReaction'
  const params: any[] = []
  if (mid) { sql += ' WHERE memo_id = ?'; params.push(mid) }
  if (rt) { sql += mid ? ' AND reaction_type = ?' : ' WHERE reaction_type = ?'; params.push(rt) }
  await c.env.MOMO_DB.prepare(sql).bind(...params).run()
  return c.json({ ok: true })
}
