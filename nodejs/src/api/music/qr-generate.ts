import { Context } from "koa";
import { neteaseGet } from "./neteaseClient";
import { PC_CLIENT_COOKIE } from "./neteaseClient";
import { saveQrSession } from "./sessionStore";

export default async (ctx: Context) => {
  try {
    const timestamp = Date.now();

    const keyResp = await neteaseGet("/login/qr/key", { timestamp }, undefined, "pc");
    const keyData = keyResp.data.data as { unikey?: string } | undefined;
    const qrId = keyData?.unikey;

    if (!qrId) {
      ctx.status = 502;
      ctx.body = {
        code: 502,
        message: "Failed to get QR key from NetEase API",
        data: keyResp.data,
      };
      return;
    }

    const createResp = await neteaseGet(
      "/login/qr/create",
      {
        key: qrId,
        qrimg: "true",
        timestamp,
      },
      undefined,
      "pc",
    );

    const createData = createResp.data.data as { qrimg?: string; qrurl?: string } | undefined;
    const qrDataUrl = createData?.qrimg;
    const qrUrl = createData?.qrurl;

    if (!qrDataUrl) {
      ctx.status = 502;
      ctx.body = {
        code: 502,
        message: "Failed to create QR image from NetEase API",
        data: createResp.data,
      };
      return;
    }

    saveQrSession(qrId, PC_CLIENT_COOKIE);

    ctx.body = {
      code: 200,
      message: "QR code generated successfully",
      data: {
        qrId,
        qrDataUrl,
        qrUrl,
        expiresIn: 300,
      },
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      code: 500,
      message: "Failed to generate QR code",
      error: (error as Error).message,
    };
  }
};
