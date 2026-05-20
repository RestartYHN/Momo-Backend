import { Context } from 'hono'
import { Bindings } from '../../bindings'

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export const uploadImage = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return c.json({ message: 'No file provided' }, 400)
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return c.json({ message: 'Only PNG, JPEG, GIF, WebP allowed' }, 400)
    }
    if (file.size > MAX_SIZE) {
      return c.json({ message: 'Image size must be less than 5MB' }, 400)
    }

    const id = crypto.randomUUID()
    const ext = file.type.split('/')[1] || 'png'
    const key = `comments/${id}.${ext}`

    await c.env.MOMO_R2.put(key, file.stream(), {
      httpMetadata: { contentType: file.type }
    })

    const url = `https://img.restartyhn.top/${key}`
    return c.json({ success: true, url })
  } catch (err: any) {
    console.error('Upload error:', err.message || err)
    return c.json({ message: err.message || 'Upload failed' }, 500)
  }
}
