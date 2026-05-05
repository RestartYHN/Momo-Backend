import { Context } from 'hono'
import { Bindings } from '../../bindings'

export const deleteComment = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const data = await c.req.json();
    const id = data.id;
    const email = data.email;

    if (!id || !email) return c.json({ code: 400, message: 'id and email are required' }, 400);

    // 查询评论
    const row = await c.env.MOMO_DB.prepare('SELECT email FROM Comment WHERE id = ?').bind(id).first<{ email: string }>();
    if (!row) return c.json({ code: 404, message: 'Comment not found' }, 404);

    // 简单校验：只有邮箱一致才允许删除（逻辑删除）
    if ((row.email || '').trim().toLowerCase() !== String(email).trim().toLowerCase()) {
      return c.json({ code: 403, message: 'Permission denied' }, 403);
    }

    const { success } = await c.env.MOMO_DB.prepare('UPDATE Comment SET status = ? WHERE id = ?').bind('deleted', id).run();
    if (!success) return c.json({ code: 500, message: 'Delete failed' }, 500);

    return c.json({ code: 200, message: 'Comment deleted' });
  } catch (e: any) {
    return c.json({ code: 500, message: e.message || 'Internal error' }, 500);
  }
}
