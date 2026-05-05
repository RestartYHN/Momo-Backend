import type koa from "koa";
import CommentService  from "../../orm/commentService";
import { getQueryNumber, getQueryBoolean, getQueryString } from "../../utils/url";
import { checkKey, extractToken } from "../../utils/security"
import { Comment, CreateCommentInput } from "../../type/prisma"

export default async (ctx: koa.Context, next: koa.Next): Promise<void> => {
  const deleteId =  getQueryNumber(ctx.query.id as string, 0);
  // const key = getQueryString(ctx.query.key as string, "");
  const authHeader = ctx.get("Authorization");
  const key = extractToken(authHeader);

  if(!key || !checkKey(key)) {
    ctx.status = 401;
    ctx.body = { code: 401, message: "Invalid token" };
    return;
  }

  const comment = await CommentService.deleteComment(deleteId);
  ctx.body = {
    message: "Comment deleted, id: " + deleteId + "."
  };
}
