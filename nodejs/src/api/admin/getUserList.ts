import type koa from "koa";
import CommentService from "../../orm/commentService";
import { checkKey, extractToken } from "../../utils/security"
import { getQueryNumber } from "../../utils/url";

export default async (ctx: koa.Context): Promise<void> => {
  const authHeader = ctx.get("Authorization");
  const key = extractToken(authHeader);

  if (!key || !checkKey(key)) {
    ctx.status = 401;
    ctx.body = { code: 401, message: "Invalid token" };
    return;
  }

  const page = getQueryNumber(ctx.query.page as string, 1);
  const limit = getQueryNumber(ctx.query.limit as string, 20);

  const result = await CommentService.getUserList(page, limit);

  ctx.body = {
    code: 200,
    message: "Users fetched successfully",
    data: result
  };
};