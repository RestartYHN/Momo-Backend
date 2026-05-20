import { Context } from 'hono'
import { Bindings } from '../../bindings'

export const serveImage = async (c: Context<{ Bindings: Bindings }>) => {
  const id = c.req.param('id')

  try {
    const { value, metadata } = await c.env.MOMO_AUTH_KV.getWithMetadata(`img:${id}`, { type: 'arrayBuffer' }) as any
    if (!value) return c.notFound()

    const mime = (metadata as any)?.mime || 'image/png'

    return c.body(value, 200, {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=86400',
    })
  } catch (err: any) {
    console.error('Serve image error:', err?.message || err)
    return new Response('Failed to serve image', { status: 500 })
  }
}
