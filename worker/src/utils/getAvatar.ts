/**
 * 辅助函数：生成头像地址
 * QQ 邮箱使用 QQ 头像接口，其他邮箱使用 Cravatar
 */
export const getCravatar = async (email: string): Promise<string> => {
  try {
    const cleanEmail = email.trim().toLowerCase();

    const qqMatch = cleanEmail.match(/^(\d{5,11})@qq\.com$/);
    if (qqMatch) {
      const qqNumber = qqMatch[1];
      return `https://q1.qlogo.cn/g?b=qq&nk=${qqNumber}&s=100`;
    }

    const msgUint8 = new TextEncoder().encode(cleanEmail);
    const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return `https://open.motues.top/avatar?name=${hashHex}&mode=cravatar&variant=beam`;
  } catch {
    return '';
  }
};