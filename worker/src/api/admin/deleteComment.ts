import { Context } from 'hono'
import { Bindings } from '../../bindings'

export const deleteComment = async (c: Context<{ Bindings: Bindings }>) => {
  const id = parseInt(c.req.param('id'))
  if (!id) return c.json({ message: 'Invalid id' }, 400)

  try {
    await c.env.MOMO_DB.prepare('DELETE FROM CommentReaction WHERE comment_id = ?').bind(id).run()
    await c.env.MOMO_DB.prepare('DELETE FROM CommentLike WHERE comment_id = ?').bind(id).run()
    await c.env.MOMO_DB.prepare('DELETE FROM Comment WHERE id = ?').bind(id).run()

    return c.json({ code: 200, message: 'Deleted' })
  } catch (e: any) {
    return c.json({ message: e.message }, 500)
  }
}
