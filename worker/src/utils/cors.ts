import { cors } from 'hono/cors'

export const customCors = (allowOriginStr: string | undefined) => {
  const allowedOrigins = allowOriginStr 
    ? allowOriginStr.split(',').map(origin => origin.trim()) 
    : []

  const allowAll = allowedOrigins.includes('*')

  return cors({
    origin: (origin) => {
      if (!origin) {
        return origin
      }
      if (allowAll || allowedOrigins.includes(origin)) {
        return origin
      }
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
  })
}