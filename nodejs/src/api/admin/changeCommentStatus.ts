import type koa from "koa";
import CommentService  from "../../orm/commentService";
import { getQueryNumber, getQueryBoolean, getQueryString } from "../../utils/url";
import { checkKey, extractToken } from "../../utils/security"

export default async (ctx: koa.Context, next: koa.Next): Promise<void> => {
  const commentId =  getQueryNumber(ctx.query.id as string, 0);
  const status =  getQueryString(ctx.query.status as string, "pending");
  // const key = getQueryString(ctx.query.key as string, "");
  const authHeader = ctx.get("Authorization");
  const key = extractToken(authHeader);

  if(!key || !checkKey(key)) {
    ctx.status = 401;
    ctx.body = { 
      code: 401,
      message: "Invalid token"
    };
    return;
  }

  await CommentService.updateCommentStatus(commentId, status);

  ctx.body = {
    code: 200,
    message: `Comment status updated`
  };
}