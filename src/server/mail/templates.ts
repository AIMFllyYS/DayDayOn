/*
 * 邮件模板：返回字符串的函数，不引入模板库（ADR-0017）。
 * 不 import 'server-only'：纯函数，测试直接引用。插值一律经 escapeHtml。
 */

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:24px;background:#faf6f0;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#3d3027">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
    <p style="margin:0 0 16px;font-size:20px;font-weight:600">DayDayOn</p>
    ${body}
    <p style="margin:32px 0 0;font-size:12px;color:#8a7a6d">这封邮件由系统自动发送，请不要直接回复。</p>
  </div>
</body>
</html>`
}

export interface RenderedMail {
  subject: string
  html: string
  text: string
}

/** 登录验证码（PRD 2.1：6 位、5 分钟内有效） */
export function otpMail(otp: string): RenderedMail {
  const code = escapeHtml(otp)
  return {
    subject: `DayDayOn 登录验证码：${otp}`,
    html: layout(
      '登录验证码',
      `<p style="margin:0 0 8px">你的登录验证码是：</p>
    <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px">${code}</p>
    <p style="margin:0">5 分钟内有效。如果不是你本人操作，忽略这封邮件就好。</p>`,
    ),
    text: `你的 DayDayOn 登录验证码是 ${otp}，5 分钟内有效。如果不是你本人操作，忽略这封邮件就好。`,
  }
}

/** 管理员告警（PRD 7.3） */
export function alertMail(title: string, detail: Record<string, string | number>): RenderedMail {
  const rows = Object.entries(detail)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#8a7a6d">${escapeHtml(k)}</td><td style="padding:4px 0">${escapeHtml(String(v))}</td></tr>`,
    )
    .join('')
  const text = Object.entries(detail)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  return {
    subject: `[DayDayOn 告警] ${title}`,
    html: layout(
      title,
      `<p style="margin:0 0 12px;font-weight:600">${escapeHtml(title)}</p>
    <table style="border-collapse:collapse;font-size:14px">${rows}</table>`,
    ),
    text: `${title}\n\n${text}`,
  }
}
