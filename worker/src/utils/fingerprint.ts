import { Context } from 'hono'
import { Bindings } from '../bindings'

const FALLBACK_IP = '0.0.0.0'

function getClientIp(c: Context<{ Bindings: Bindings }>): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    FALLBACK_IP
  )
}

async function sha256Hex(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hash)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function getCommentFingerprint(c: Context<{ Bindings: Bindings }>): Promise<string> {
  const ip = getClientIp(c)
  const userAgent = c.req.header('user-agent') || ''
  const language = c.req.header('accept-language') || ''

  return sha256Hex(`${ip}|${userAgent}|${language}`)
}
