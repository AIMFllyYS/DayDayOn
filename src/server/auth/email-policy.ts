/*
 * 邮箱白名单与规范化（auth.md 第 4 节、ADR-0002 第 3 节）。纯函数，带单元测试。
 * 不 import 'server-only'：没有任何服务端依赖，测试与 hooks 共用。
 * 新增域名只改 ALLOWED_EMAIL_DOMAINS。
 */

export const ALLOWED_EMAIL_DOMAINS = [
  'qq.com',
  'foxmail.com',
  'vip.qq.com',
  '163.com',
  '126.com',
  'yeah.net',
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'hust.edu.cn',
] as const

export type EmailRejectReason = 'invalid' | 'plus-address' | 'domain-not-allowed'

export type EmailCheck = { ok: true; email: string } | { ok: false; reason: EmailRejectReason }

/** 只做形状检查：一个 @、两边非空、没有空白；更细的校验交给发信 */
const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 规范化：去首尾空白、转小写；本地部分含 `+` 拒绝；gmail.com 去掉本地部分的 `.`。
 * 不检查白名单（见 checkEmail）。
 */
export function normalizeEmail(input: string): EmailCheck {
  const lowered = input.trim().toLowerCase()
  if (!SHAPE.test(lowered)) return { ok: false, reason: 'invalid' }
  const at = lowered.lastIndexOf('@')
  let local = lowered.slice(0, at)
  const domain = lowered.slice(at + 1)
  if (local.includes('+')) return { ok: false, reason: 'plus-address' }
  if (domain === 'gmail.com') local = local.replaceAll('.', '')
  if (local.length === 0) return { ok: false, reason: 'invalid' }
  return { ok: true, email: `${local}@${domain}` }
}

/** 域名是否在白名单内：精确匹配，子域名（如 mail.qq.com）不算 */
export function isAllowedDomain(email: string): boolean {
  const domain = email.slice(email.lastIndexOf('@') + 1)
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain)
}

/** 规范化 + 白名单。hooks.before 对发送验证码和验证码登录两个端点调用 */
export function checkEmail(input: string): EmailCheck {
  const normalized = normalizeEmail(input)
  if (!normalized.ok) return normalized
  if (!isAllowedDomain(normalized.email)) return { ok: false, reason: 'domain-not-allowed' }
  return normalized
}
