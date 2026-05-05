import type koa from "koa";
import CommentService from "../../orm/commentService";
import { checkKey, extractToken } from "../../utils/security"
import { getQueryNumber, getQueryString } from "../../utils/url";

export default async (ctx: koa.Context): Promise<void> => {
  const authHeader = ctx.get("Authorization");
  const key = extractToken(authHeader);

  if (!key || !checkKey(key)) {
    ctx.status = 401;
    ctx.body = { code: 401, message: "Invalid token" };
    return;
  }

  const author = getQueryString(ctx.query.author as string, "");
  const email = getQueryString(ctx.query.email as string, "");
  const page = getQueryNumber(ctx.query.page as string, 1);

  if (!author || !email) {
    ctx.status = 400;
    ctx.body = { code: 400, message: "author and email are required" };
    return;
  }

  const result = await CommentService.getUserComments(author, email, page);

  ctx.body = {
    code: 200,
    message: "User comments fetched successfully",
    data: result
  };
};