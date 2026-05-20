import { Hono } from 'hono'
import { Bindings } from './bindings'
import { customCors } from './utils/cors'
import { getSetting } from './utils/settings'
import { adminAuth } from './utils/auth'

import { getComments } from './api/public/getComments'
import { postComment } from './api/public/postComment'
import { likeComment } from './api/public/likeComment'
import { unlikeComment } from './api/public/unlikeComment'
import { reactComment } from './api/public/reactComment'
import { unreactComment } from './api/public/unreactComment'
import { uploadImage } from './api/public/uploadImage'
import { serveImage } from './api/public/serveImage'
import { adminLogin } from './api/admin/login'
import { getSettings, updateSettings, testEmail } from './api/admin/settings'
import { changePassword } from './api/admin/password'
import { listComments } from './api/admin/listComments'
import { updateStatus } from './api/admin/updateStatus'
import { clearLikes } from './api/admin/clearLikes'
import { statsOverview } from './api/admin/statsOverview'
import { userList } from './api/admin/userList'
import { userComments } from './api/admin/userComments'
import { exportSettings, exportComments } from './api/admin/dataExport'
import { importComments, importSettings } from './api/admin/dataImport'
import { pinComment } from './api/admin/pinComment'

const app = new Hono<{ Bindings: Bindings }>()

// 全局跨域（从数据库读取允许的来源）
app.use('*', async (c, next) => {
  const allowOriginStr = await getSetting(c.env, "allow_origin") || '*'
  const corsMiddleware = customCors(allowOriginStr)
  return corsMiddleware(c, next)
})

// API
app.get('/api/comments', getComments)
app.post('/api/comments', postComment)
app.post('/api/comments/:id/like', likeComment)
app.post('/api/comments/:id/unlike', unlikeComment)
app.post('/api/comments/:id/react', reactComment)
app.delete('/api/comments/:id/react', unreactComment)
app.post('/api/upload', uploadImage)
app.get('/api/img/:id', serveImage)

app.post('/admin/login', adminLogin)
app.use('/admin/*', adminAuth)
app.get('/admin/settings', getSettings);
app.put('/admin/settings', updateSettings);
app.post('/admin/settings/test-email', testEmail);
app.put('/admin/password', changePassword);
app.get('/admin/comments/list', listComments);
app.put('/admin/comments/status', updateStatus);
app.delete('/admin/comments/likes', clearLikes);
app.get('/admin/stats/overview', statsOverview);
app.get('/admin/stats/users', userList);
app.get('/admin/stats/users/comments', userComments);
app.get('/admin/data/export/settings', exportSettings);
app.get('/admin/data/export/comments', exportComments);
app.post('/admin/data/import/comments', importComments);
app.post('/admin/data/import/settings', importSettings);
app.put('/admin/comments/:id/pin', pinComment);

export default app