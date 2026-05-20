import { Context } from 'hono'
import { Bindings } from '../../bindings'

export const serveImage = async (c: Context<{ Bindings: Bindings }>) => {
  const id = c.req.param('id')
  const cacheBust = c.req.query('v') || Date.now().toString()

  try {
    const raw = await c.env.MOMO_AUTH_KV.get(`img:${id}`)
    if (!raw) {
      return new Response('Image not found', { status: 404 })
    }

    const parsed = JSON.parse(raw) as { data: string; mime: string; name?: string }
    if (!parsed.data || !parsed.mime) {
      return new Response('Invalid image data', { status: 500 })
    }

    const bytes = Buffer.from(parsed.data, 'base64')

    return c.body(bytes, 200, {
      'Content-Type': parsed.mime,
      'Cache-Control': 'public, max-age=86400',
    })
  } catch (err: any) {
    console.error('Serve image error:', err?.message || err)
    return new Response('Failed to serve image', { status: 500 })
  }
}
