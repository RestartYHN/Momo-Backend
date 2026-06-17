import { Context } from 'hono'
import { Bindings } from '../../bindings'
import { parseMarkdown } from '../../utils/markdown'
import { checkContent } from '../public/postComment'

export const updateComment = async (c: Context<{ Bindings: Bindings }>) => {
  const id = parseInt(c.req.param('id'))
  if (!id) return c.json({ message: 'Invalid id' }, 400)

  const body = await c.req.json()
  const { content_text, status } = body

  if (!content_text && !status) {
    return c.json({ message: 'Nothing to update' }, 400)
  }

  try {
    const row = await c.env.MOMO_DB.prepare('SELECT id FROM Comment WHERE id = ?').bind(id).first()
    if (!row) return c.json({ message: 'Comment not found' }, 404)

    if (content_text) {
      const sanitized = checkContent(content_text)
      const contentHtml = parseMarkdown(sanitized)
      await c.env.MOMO_DB.prepare(
        'UPDATE Comment SET content_text = ?, content_html = ? WHERE id = ?'
      ).bind(sanitized, contentHtml, id).run()
    }

    if (status) {
      if (!['approved', 'pending', 'deleted'].includes(status)) {
        return c.json({ message: 'Invalid status' }, 400)
      }
      await c.env.MOMO_DB.prepare(
        'UPDATE Comment SET status = ? WHERE id = ?'
      ).bind(status, id).run()
    }

    return c.json({ code: 200, message: 'Updated' })
  } catch (e: any) {
    return c.json({ message: e.message }, 500)
  }
}
