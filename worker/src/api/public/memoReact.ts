import { Context } from 'hono'
import { Bindings } from '../../bindings'
import { getCommentFingerprint } from '../../utils/fingerprint'

const VALID = ['❤️','😂','😅','👀','🎉','😮','😆','😉','😭','🍀']

export const reactMemo = async (c: Context<{ Bindings: Bindings }>) => {
  const mid = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const rt = body?.reaction_type
  if (!VALID.includes(rt)) return c.json({ message: 'Invalid' }, 400)
  const fp = await getCommentFingerprint(c)

  try {
    await c.env.MOMO_DB.prepare(
      'INSERT OR IGNORE INTO MemoReaction (memo_id, fingerprint, reaction_type) VALUES (?, ?, ?)'
    ).bind(mid, fp, rt).run()

    return await getMemoReactionsResponse(c, mid, fp)
  } catch (e: any) {
    return c.json({ message: e.message }, 500)
  }
}

export const unreactMemo = async (c: Context<{ Bindings: Bindings }>) => {
  const mid = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const rt = body?.reaction_type
  const fp = await getCommentFingerprint(c)

  try {
    if (rt === 'all') {
      await c.env.MOMO_DB.prepare('DELETE FROM MemoReaction WHERE memo_id = ? AND fingerprint = ?').bind(mid, fp).run()
    } else {
      if (!VALID.includes(rt)) return c.json({ message: 'Invalid' }, 400)
      await c.env.MOMO_DB.prepare(
        'DELETE FROM MemoReaction WHERE memo_id = ? AND fingerprint = ? AND reaction_type = ?'
      ).bind(mid, fp, rt).run()
    }
    return await getMemoReactionsResponse(c, mid, fp)
  } catch (e: any) {
    return c.json({ message: e.message }, 500)
  }
}

async function getMemoReactionsResponse(c: Context<{ Bindings: Bindings }>, mid: string, fp: string) {
  const counts = await c.env.MOMO_DB.prepare(
    'SELECT reaction_type, COUNT(*) as cnt FROM MemoReaction WHERE memo_id = ? GROUP BY reaction_type'
  ).bind(mid).all<{ reaction_type: string, cnt: number }>()

  const reactions: Record<string, number> = {}
  for (const r of counts.results || []) reactions[r.reaction_type] = r.cnt

  const my = await c.env.MOMO_DB.prepare(
    'SELECT reaction_type FROM MemoReaction WHERE memo_id = ? AND fingerprint = ?'
  ).bind(mid, fp).all<{ reaction_type: string }>()

  return c.json({ reactions, myReactions: (my.results || []).map(r => r.reaction_type) })
}
