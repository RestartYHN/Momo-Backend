import { Context } from 'hono'
import { Bindings } from '../../bindings'
import { getCommentFingerprint } from '../../utils/fingerprint'

const VALID_REACTIONS = ['❤️','😂','😅','👀','🎉','😮','😆','😉','😭','🍀']

export const unreactComment = async (c: Context<{ Bindings: Bindings }>) => {
  const id = parseInt(c.req.param('id'))
  if (!id) return c.json({ message: 'Invalid id' }, 400)

  const body = await c.req.json().catch(() => null)
  const reaction_type = body?.reaction_type
  if (!VALID_REACTIONS.includes(reaction_type)) return c.json({ message: 'Invalid reaction' }, 400)

  const fingerprint = await getCommentFingerprint(c)

  try {
    await c.env.MOMO_DB.prepare(
      'DELETE FROM CommentReaction WHERE comment_id = ? AND fingerprint = ? AND reaction_type = ?'
    ).bind(id, fingerprint, reaction_type).run()

    const counts = await c.env.MOMO_DB.prepare(
      'SELECT reaction_type, COUNT(*) as cnt FROM CommentReaction WHERE comment_id = ? GROUP BY reaction_type'
    ).bind(id).all<{ reaction_type: string, cnt: number }>()

    const reactions: Record<string, number> = {}
    for (const r of counts.results || []) reactions[r.reaction_type] = r.cnt

    const myReactions = await c.env.MOMO_DB.prepare(
      'SELECT reaction_type FROM CommentReaction WHERE comment_id = ? AND fingerprint = ?'
    ).bind(id, fingerprint).all<{ reaction_type: string }>()

    return c.json({ code: 200, data: { reactions, myReactions: (myReactions.results || []).map(r => r.reaction_type) } })
  } catch (e: any) {
    return c.json({ message: e.message }, 500)
  }
}
