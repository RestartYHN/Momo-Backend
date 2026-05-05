import { Context } from 'hono'
import { Bindings } from '../../bindings'

export const serveImage = async (c: Context<{ Bindings: Bindings }>) => {
  const id = c.req.param('id')

  try {
    const raw = await c.env.MOMO_AUTH_KV.get(`img:${id}`)
    if (!raw) {
      return new Response('Image not found', { status: 404 })
    }

    const parsed = JSON.parse(raw) as { data: string; mime: string; name?: string }
    if (!parsed.data || !parsed.mime) {
      return new Response('Invalid image data', { status: 500 })
    }

    const binaryStr = atob(parsed.data)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    return new Response(bytes, {
      headers: {
        'Content-Type': parsed.mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err: any) {
    console.error('Serve image error:', err?.message || err)
    return new Response('Failed to serve image', { status: 500 })
  }
}
