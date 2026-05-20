import { Context } from 'hono'
import { Bindings } from '../../bindings'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

function generateId(): string {
  return crypto.randomUUID()
}

export const uploadImage = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return c.json({ message: 'No file provided' }, 400)
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json({ message: 'Only PNG, JPEG, GIF, WebP images are allowed' }, 400)
    }

    if (file.size > MAX_SIZE) {
      return c.json({ message: 'Image size must be less than 5MB' }, 400)
    }

    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = '';
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.slice(i, i + CHUNK));
    }
    const base64 = btoa(binary)

    const imgId = generateId()
    const mimeType = file.type

    await c.env.MOMO_AUTH_KV.put(
      `img:${imgId}`,
      JSON.stringify({ data: base64, mime: mimeType, name: file.name }),
      { expirationTtl: 60 * 60 * 24 * 365 }
    )

    return c.json({ success: true, url: `/api/img/${imgId}` })
  } catch (err: any) {
    console.error('Upload error:', err.message || err)
    return c.json({ message: err.message || 'Upload failed' }, 500)
  }
}
