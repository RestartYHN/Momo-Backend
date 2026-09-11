import { Context } from 'hono'
import { Bindings } from '../../bindings'

const MAX_SIZE = 10 * 1024 * 1024
const RATE_LIMIT_SECONDS = 30
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export const uploadImage = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    // Soft per-IP rate limit (KV); keep it gentle so normal commenting isn't blocked.
    const ip = c.req.header('cf-connecting-ip') || '127.0.0.1'
    const rateKey = `upload:${ip}`
    const last = await c.env.MOMO_AUTH_KV.get(rateKey)
    if (last) {
      const elapsed = Date.now() - Number(last)
      const waitMs = RATE_LIMIT_SECONDS * 1000 - elapsed
      if (waitMs > 0) {
        return c.json({ message: `Please wait ${Math.ceil(waitMs / 1000)}s before uploading again` }, 429)
      }
    }

    const formData = await c.req.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return c.json({ message: 'No file provided' }, 400)
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json({ message: 'Only PNG, JPEG, GIF, WebP allowed' }, 400)
    }
    if (file.size > MAX_SIZE) {
      return c.json({ message: 'Image size must be less than 10MB' }, 400)
    }

    const id = crypto.randomUUID()
    const ext = file.type.split('/')[1] || 'png'
    const key = `comments/${id}.${ext}`

    await c.env.MOMO_R2.put(key, file.stream(), {
      httpMetadata: { contentType: file.type }
    })

    // Only count successful uploads against the limit (KV min TTL is 60s).
    await c.env.MOMO_AUTH_KV.put(rateKey, String(Date.now()), { expirationTtl: 60 })

    const url = `https://img.restartyhn.top/${key}`
    return c.json({ success: true, url })
  } catch (err: any) {
    console.error('Upload error:', err.message || err)
    return c.json({ message: err.message || 'Upload failed' }, 500)
  }
}
