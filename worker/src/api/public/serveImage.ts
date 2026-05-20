import { Context } from 'hono'
import { Bindings } from '../../bindings'

export const serveImage = async (c: Context<{ Bindings: Bindings }>) => {
  return c.redirect('https://img.restartyhn.top/comments/', 301)
}
