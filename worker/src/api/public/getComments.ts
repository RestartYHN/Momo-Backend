import { Context } from 'hono'
import { Bindings } from '../../bindings'
import { getCravatar } from '../../utils/getAvatar'
import { getCommentFingerprint } from '../../utils/fingerprint'

export const getComments = async (c: Context<{ Bindings: Bindings }>) => {
    const post_slug = c.req.query('post_slug')
  const page = parseInt(c.req.query('page') || '1')
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50)
  const nested = c.req.query('nested') !== 'false'
  const sort_by = c.req.query('sort_by') === 'likes' ? 'like_count DESC, pub_date DESC' : 'pinned DESC, pub_date DESC'
  const offset = (page - 1) * limit

  if (!post_slug) return c.json({ message: "post_slug is required" }, 400)

  try {
    const query = `
      SELECT id, author, email, url, content_text as contentText,
             content_html as contentHtml, pub_date as pubDate, parent_id as parentId,
             like_count as likeCount, pinned
      FROM Comment
      WHERE post_slug = ? AND status = "approved"
      ORDER BY ${sort_by}
    `
    const { results } = await c.env.MOMO_DB.prepare(query).bind(post_slug).all()

    const fingerprint = await getCommentFingerprint(c)
    const likedRows = await c.env.MOMO_DB.prepare(
      'SELECT comment_id FROM CommentLike WHERE fingerprint = ?'
    ).bind(fingerprint).all<{ comment_id: number }>()
    const likedCommentIds = new Set((likedRows.results || []).map((item) => item.comment_id))

    // Load reactions
    const reactionRows = await c.env.MOMO_DB.prepare(
      'SELECT comment_id, reaction_type, COUNT(*) as cnt FROM CommentReaction GROUP BY comment_id, reaction_type'
    ).all<{ comment_id: number, reaction_type: string, cnt: number }>()
    const reactionMap = new Map<number, Record<string, number>>()
    for (const r of reactionRows.results || []) {
      if (!reactionMap.has(r.comment_id)) reactionMap.set(r.comment_id, {})
      reactionMap.get(r.comment_id)![r.reaction_type] = r.cnt
    }

    const myReactions = await c.env.MOMO_DB.prepare(
      'SELECT comment_id, reaction_type FROM CommentReaction WHERE fingerprint = ?'
    ).bind(fingerprint).all<{ comment_id: number, reaction_type: string }>()

    const authorMap = new Map<number, string>()
    for (const row of results) {
      authorMap.set(row.id, row.author)
    }
    const allComments = await Promise.all(results.map(async (row: any) => ({
      ...row,
      pinned: Number(row.pinned || 0),
      likeCount: Number(row.likeCount || 0),
      likedByMe: likedCommentIds.has(row.id),
      reactions: reactionMap.get(row.id) || {},
      myReactions: (myReactions.results || []).filter(r => r.comment_id === row.id).map(r => r.reaction_type),
      parentAuthor: row.parentId ? authorMap.get(row.parentId) || null : null,
      avatar: await getCravatar(row.email),
      replies: []
    })))

    if (nested) {
      const commentMap = new Map()
      const rootComments: any[] = []

      allComments.forEach(comment => commentMap.set(comment.id, comment))
      allComments.forEach(comment => {
        if (comment.parentId && commentMap.has(comment.parentId)) {
          commentMap.get(comment.parentId).replies.push(comment)
        } else if (!comment.parentId) {
          rootComments.push(comment)
        }
      })

      const paginatedData = rootComments.slice(offset, offset + limit)
      return c.json({ 
        code: 200,
        message: 'Comments fetched successfully',
        data: {
          comments: paginatedData,
          pagination: {
            page,
            limit,
            totalPage: Math.ceil(rootComments.length / limit),
            totalCount: rootComments.length,
          }
        } 
      })
    } else {
      const paginatedData = allComments.slice(offset, offset + limit)
      return c.json({
        code: 200,
        message: 'Comments fetched successfully',
        data: {
          comments: paginatedData,
          pagination: {
            page,
            limit,
            totalPage: Math.ceil(allComments.length / limit),
            totalCount: allComments.length
          }
        }
      })
    }
  } catch (e: any) {
    return c.json({ message: e.message }, 500)
  }
}
