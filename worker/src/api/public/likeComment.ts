import { Context } from 'hono'
import { Bindings } from '../../bindings'
import { getCommentFingerprint } from '../../utils/fingerprint'

export const likeComment = async (c: Context<{ Bindings: Bindings }>) => {
  const commentId = Number(c.req.param('id'))
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return c.json({ message: 'Invalid comment id' }, 400)
  }

  try {
    const exists = await c.env.MOMO_DB.prepare('SELECT id FROM Comment WHERE id = ?').bind(commentId).first()
    if (!exists) {
      return c.json({ message: 'Comment not found' }, 404)
    }

    const fingerprint = await getCommentFingerprint(c)

    const insertRes = await c.env.MOMO_DB.prepare(
      'INSERT OR IGNORE INTO CommentLike (comment_id, fingerprint) VALUES (?, ?)'
    )
      .bind(commentId, fingerprint)
      .run()

    const inserted = (insertRes.meta?.changes ?? 0) > 0
    if (inserted) {
      await c.env.MOMO_DB.prepare(
        'UPDATE Comment SET like_count = like_count + 1 WHERE id = ?'
      )
        .bind(commentId)
        .run()
    }

    const row = await c.env.MOMO_DB.prepare('SELECT like_count FROM Comment WHERE id = ?').bind(commentId).first<{ like_count: number }>()

    return c.json({
      success: true,
      liked: true,
      like_count: row?.like_count ?? 0,
    })
  } catch (error: any) {
    return c.json({ message: error?.message || 'Like failed' }, 500)
  }
}
