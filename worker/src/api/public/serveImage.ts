import { Context } from 'hono'
import { Bindings } from '../../bindings'

export const serveImage = async (c: Context<{ Bindings: Bindings }>) => {
  const id = c.req.param('id')

  try {
    const raw = await c.env.MOMO_AUTH_KV.get(`img:${id}`)
    if (!raw) {
      return c.notFound()
    }

    const { data, mime } = JSON.parse(raw) as { data: string; mime: string; name?: string }

    const binary = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))

    c.header('Content-Type', mime)
    c.header('Cache-Control', 'public, max-age=31536000, immutable')
    return c.body(binary)
  } catch {
    return c.notFound()
  }
}
