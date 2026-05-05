import nodemailer from 'nodemailer';
import { Bindings } from '../bindings';
import { getSetting, isEmailEnabled } from './settings';

function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 从数据库获取 SMTP 配置
 */
async function getSmtpConfig(env: Bindings) {
  const host = await getSetting(env, "smtp_host");
  const port = await getSetting(env, "smtp_port");
  const user = await getSetting(env, "email_user");
  const pass = await getSetting(env, "email_password");
  const secure = await getSetting(env, "email_secure");

  if (!host || !user || !pass) return null;

  return { host, port: parseInt(port || '465'), secure: secure === 'true', user, pass };
}

/**
 * 通用 SMTP 发送函数 (适配 Cloudflare Workers)
 */
async function smtpFetch(env: Bindings, options: { to: string, subject: string, html: string }) {
  const config = await getSmtpConfig(env);
  if (!config) {
    console.log('SMTP not configured, skipping email');
    return null;
  }

  // 创建传输对象
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  try {
    const siteName = await getSetting(env, "site_name") || 'Momo Blog';

    // 发送邮件
    const info = await transporter.sendMail({
      from: `${siteName} 评论通知 <${config.user}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    return info;
  } catch (err: any) {
    console.error('Nodemailer Error:', err);
    throw new Error(`邮件发送失败: ${err.message}`);
  }
}

/**
 * 回复通知邮件
 */
export async function sendCommentReplyNotification(
  env: Bindings,
  params: {
    toEmail: string;
    toName: string;
    postTitle: string;
    parentComment: string;
    replyAuthor: string;
    replyContent: string;
    postUrl: string;
  }
) {
  if (!(await isEmailEnabled(env))) {
    console.log("Email disabled by settings, skipping reply notification");
    return null;
  }

  const { toEmail, toName, postTitle, parentComment, replyAuthor, replyContent, postUrl } = params;
  const customTpl = await getSetting(env, "reply_template");

  let html: string;
  if (customTpl) {
    html = customTpl
      .replace(/\{\{toName\}\}/g, htmlEscape(toName))
      .replace(/\{\{replyAuthor\}\}/g, htmlEscape(replyAuthor))
      .replace(/\{\{postTitle\}\}/g, htmlEscape(postTitle))
      .replace(/\{\{parentComment\}\}/g, htmlEscape(parentComment))
      .replace(/\{\{replyContent\}\}/g, htmlEscape(replyContent))
      .replace(/\{\{postUrl\}\}/g, htmlEscape(postUrl));
  } else {
    html = `
      <div style="background-color: #f4f7f9; padding: 20px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 1px solid #e1e4e8;">
          <div style="padding: 30px;">
            <h2 style="margin-top: 0; color: #333; font-size: 18px;">Hi ${htmlEscape(toName)}，</h2>
            <p style="color: #555; line-height: 1.6;">
              <strong>${htmlEscape(replyAuthor)}</strong> 回复了你在 <span style="color: #007acc;">《${htmlEscape(postTitle)}》</span> 中的评论：
            </p>
            <div style="margin: 20px 0; padding: 12px 16px; border-left: 4px solid #dfe3e8; background-color: #fcfcfc; color: #555; font-size: 14px;">
              ${htmlEscape(parentComment)}
            </div>
            <p style="color: #333; font-weight: bold; margin-bottom: 8px;">最新回复：</p>
            <div style="margin-bottom: 30px; padding: 16px; border-radius: 6px; background-color: #f0f7ff; border-left: 4px solid #007acc; color: #2c3e50; line-height: 1.6;">
              ${htmlEscape(replyContent)}
            </div>
            <div style="text-align: center;">
              <a href="${htmlEscape(postUrl)}" style="display: inline-block; background-color: #007acc; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 5px rgba(0,122,204,0.2);">
                点击查看回复
              </a>
            </div>
          </div>
          <div style="background-color: #fafbfc; padding: 15px 30px; border-top: 1px solid #eeeeee; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #999;">此邮件由系统自动发送，请勿直接回复。</p>
          </div>
        </div>
      </div>`;
  }

  const siteName = await getSetting(env, "site_name") || 'Momo Blog';

  return await smtpFetch(env, {
    to: toEmail,
    subject: `你在 ${siteName} 上的评论有了新回复`,
    html
  });
}

/**
 * 站长通知邮件
 */
export async function sendCommentNotification(
  env: Bindings,
  params: {
    postTitle: string;
    postUrl: string;
    commentAuthor: string;
    commentContent: string;
  }
) {
  if (!(await isEmailEnabled(env))) {
    console.log("Email disabled by settings, skipping admin notification");
    return null;
  }

  const { postTitle, postUrl, commentAuthor, commentContent } = params;
  const customTpl = await getSetting(env, "notification_template");

  let html: string;
  if (customTpl) {
    html = customTpl
      .replace(/\{\{postTitle\}\}/g, htmlEscape(postTitle))
      .replace(/\{\{commentAuthor\}\}/g, htmlEscape(commentAuthor))
      .replace(/\{\{commentContent\}\}/g, htmlEscape(commentContent))
      .replace(/\{\{postUrl\}\}/g, htmlEscape(postUrl));
  } else {
    html = `
      <div style="background-color: #f6f8fa; padding: 40px 20px; min-height: 100%; font-family: 'PingFang SC', 'Microsoft YaHei', Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.05); overflow: hidden;">
          <div style="height: 4px; background: linear-gradient(90deg, #007acc, #00c6ff);"></div>
          <div style="padding: 32px;">
            <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 20px; line-height: 1.4;">有人在你的文章下发表了评论</h2>
            <p style="color: #555; font-size: 15px; margin-bottom: 24px; line-height: 1.6;">
              <strong style="color: #007acc;">${htmlEscape(commentAuthor)}</strong> 评论了你的文章 <b style="color: #1a1a1a;">《${htmlEscape(postTitle)}》</b>：
            </p>
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; border: 1px dashed #e1e4e8; margin-bottom: 32px;">
              <div style="color: #444; font-size: 15px; line-height: 1.8; word-break: break-all;">
                ${htmlEscape(commentContent)}
              </div>
            </div>
            <div style="text-align: center;">
              <a href="${htmlEscape(postUrl)}" style="display: inline-block; background-color: #007acc; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 50px; font-weight: 500; font-size: 15px; transition: all 0.3s ease;">
                立即前往查看
              </a>
            </div>
          </div>
          <div style="background-color: #fafbfc; padding: 20px; text-align: center; border-top: 1px solid #f0f0f0;">
            <p style="margin: 0; font-size: 13px; color: #99aab5; line-height: 1.5;">此邮件由系统自动发送，请勿直接回复。</p>
          </div>
        </div>
      </div>`;
  }

  const adminEmail = await getSetting(env, "admin_email");
  if (!adminEmail) {
    console.log("Admin email not configured, skipping notification");
    return null;
  }

  const siteName = await getSetting(env, "site_name") || 'Momo Blog';

  return await smtpFetch(env, {
    to: adminEmail,
    subject: `你在 ${siteName} 上有了新评论`,
    html
  });
}

export async function sendTestEmail(env: Bindings, toEmail: string): Promise<void> {
  if (!(await isEmailEnabled(env))) {
    throw new Error('The email notification feature is currently disabled. ');
  }

  const config = await getSmtpConfig(env);
  if (!config) {
    throw new Error('SMTP is not configured. ');
  }

  const siteName = await getSetting(env, "site_name") || 'Momo Blog';

  await smtpFetch(env, {
    to: toEmail,
    subject: `SMTP 配置验证`,
    html: `<div style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 30px; border: 1px solid #e1e4e8; border-radius: 8px;">
      <h2 style="color: #333; margin-top: 0;">SMTP 配置测试</h2>
      <p style="color: #555; line-height: 1.6;">这是一封来自 <strong>${htmlEscape(siteName)}</strong> 的测试邮件。</p>
      <p style="color: #555; line-height: 1.6;">如果收到此邮件，说明 SMTP 配置正确，邮件通知功能可以正常使用。</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">此邮件由系统自动发送，请勿直接回复。</p>
    </div>`,
  });
}
