import { Context } from 'hono'
import { Bindings } from '../../bindings'
import { verifyToken } from '../../utils/auth'

export const pinComment = async (c: Context<{ Bindings: Bindings }>) => {
  const id = parseInt(c.req.param('id'))
  if (!id) return c.json({ message: 'Invalid id' }, 400)

  try {
    const row = await c.env.MOMO_DB.prepare('SELECT pinned FROM Comment WHERE id = ?').bind(id).first<{ pinned: number }>()
    if (!row) return c.json({ message: 'Comment not found' }, 404)

    const newPinned = row.pinned ? 0 : 1
    await c.env.MOMO_DB.prepare('UPDATE Comment SET pinned = ? WHERE id = ?').bind(newPinned, id).run()

    return c.json({ code: 200, message: 'OK', data: { pinned: newPinned === 1 } })
  } catch (e: any) {
    return c.json({ message: e.message }, 500)
  }
}
