import { Context } from 'hono'
import { Bindings } from '../../bindings'
import { getCommentFingerprint } from '../../utils/fingerprint'

export const getMemoReactions = async (c: Context<{ Bindings: Bindings }>) => {
  const mid = c.req.param('id')
  const fingerprint = await getCommentFingerprint(c)

  const counts = await c.env.MOMO_DB.prepare(
    'SELECT reaction_type, COUNT(*) as cnt FROM MemoReaction WHERE memo_id = ? GROUP BY reaction_type'
  ).bind(mid).all<{ reaction_type: string, cnt: number }>()

  const reactions: Record<string, number> = {}
  for (const r of counts.results || []) reactions[r.reaction_type] = r.cnt

  const my = await c.env.MOMO_DB.prepare(
    'SELECT reaction_type FROM MemoReaction WHERE memo_id = ? AND fingerprint = ?'
  ).bind(mid, fingerprint).all<{ reaction_type: string }>()

  return c.json({ reactions, myReactions: (my.results || []).map(r => r.reaction_type) })
}
