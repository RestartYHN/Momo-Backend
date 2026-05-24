import { Context } from 'hono'
import { Bindings } from '../../bindings'
import { getCommentFingerprint } from '../../utils/fingerprint'

export const listMemoReactions = async (c: Context<{ Bindings: Bindings }>) => {
  const page = parseInt(c.req.query('page') || '1')
  const limit = 20
  const offset = (page - 1) * limit

  const { results } = await c.env.MOMO_DB.prepare(
    'SELECT memo_id, reaction_type, COUNT(*) as cnt, COUNT(CASE WHEN fingerprint = \'admin\' THEN 1 END) as admin_cnt, MAX(datetime(created_at, "+8 hours")) as last_at FROM MemoReaction GROUP BY memo_id, reaction_type ORDER BY memo_id DESC, cnt DESC LIMIT ? OFFSET ?'
  ).bind(limit, offset).all()

  const total = await c.env.MOMO_DB.prepare(
    'SELECT COUNT(DISTINCT memo_id || reaction_type) as cnt FROM MemoReaction'
  ).first<{ cnt: number }>()

  return c.json({
    data: (results || []).map((r: any) => ({ ...r, user_cnt: (r.cnt || 0) - (r.admin_cnt || 0) })),
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

export const updateMemoReaction = async (c: Context<{ Bindings: Bindings }>) => {
  const body = await c.req.json().catch(() => null)
  const mid = body?.memo
  const rt = body?.type
  const target = body?.count
  if (!mid || !rt || target == null) return c.json({ message: 'Invalid' }, 400)

  const row = await c.env.MOMO_DB.prepare(
    'SELECT COUNT(*) as cnt, COUNT(CASE WHEN fingerprint = \'admin\' THEN 1 END) as admin_cnt FROM MemoReaction WHERE memo_id = ? AND reaction_type = ?'
  ).bind(mid, rt).first<{ cnt: number, admin_cnt: number }>()
  const current = row?.cnt || 0
  const adminCount = row?.admin_cnt || 0

  if (target > current) {
    for (let i = current; i < target; i++) {
      await c.env.MOMO_DB.prepare(
        'INSERT INTO MemoReaction (memo_id, fingerprint, reaction_type) VALUES (?, \'admin\', ?)'
      ).bind(mid, rt).run()
    }
  } else if (target < current) {
    const toDelete = current - target
    if (toDelete >= adminCount) {
      await c.env.MOMO_DB.prepare(
        'DELETE FROM MemoReaction WHERE memo_id = ? AND reaction_type = ? AND fingerprint = \'admin\''
      ).bind(mid, rt).run()
      const remaining = toDelete - adminCount
      if (remaining > 0) {
        await c.env.MOMO_DB.prepare(
          `DELETE FROM MemoReaction WHERE memo_id = ? AND reaction_type = ? AND fingerprint != 'admin' AND rowid IN (SELECT rowid FROM MemoReaction WHERE memo_id = ? AND reaction_type = ? AND fingerprint != 'admin' LIMIT ?)`
        ).bind(mid, rt, mid, rt, remaining).run()
      }
    } else {
      await c.env.MOMO_DB.prepare(
        `DELETE FROM MemoReaction WHERE memo_id = ? AND reaction_type = ? AND fingerprint = 'admin' AND rowid IN (SELECT rowid FROM MemoReaction WHERE memo_id = ? AND reaction_type = ? AND fingerprint = 'admin' LIMIT ?)`
      ).bind(mid, rt, mid, rt, toDelete).run()
    }
  }

  return c.json({ ok: true })
}
