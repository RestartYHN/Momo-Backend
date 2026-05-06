import { Context } from 'hono';
import { Bindings } from '../../bindings';

export const clearLikes = async (c: Context<{ Bindings: Bindings }>) => {
  const commentId = Number(c.req.query('id'));
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return c.json({ message: 'Invalid comment id' }, 400);
  }

  await c.env.MOMO_DB.prepare('DELETE FROM CommentLike WHERE comment_id = ?').bind(commentId).run();
  await c.env.MOMO_DB.prepare('UPDATE Comment SET like_count = 0 WHERE id = ?').bind(commentId).run();

  return c.json({ code: 200, message: 'Likes cleared' });
};
