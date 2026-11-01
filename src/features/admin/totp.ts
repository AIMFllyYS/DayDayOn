/*
 * 两步验证绑定（PRD 7.1）：不显示二维码、不引入二维码库，只从 totpURI 里取出密钥文本供手动输入。
 * totpURI 形如 otpauth://totp/DayDayOn:a%40qq.com?secret=JBSWY3DP…&issuer=DayDayOn&digits=6&period=30
 */

export interface TotpSetup {
  /** Base32 密钥（大写、去空白） */
  secret: string
  /** 账号名（邮箱），没有时为 null */
  account: string | null
  issuer: string | null
}

/** 解析 totpURI；不是 otpauth://totp 或没有 secret 时返回 null */
export function parseTotpUri(uri: string): TotpSetup | null {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return null
  }
  if (url.protocol !== 'otpauth:') return null
  // otpauth://totp/Label：WHATWG URL 把 totp 解析成 host
  if (url.host.toLowerCase() !== 'totp') return null
  const secret = url.searchParams.get('secret')?.replace(/\s+/g, '').toUpperCase()
  if (!secret || !/^[A-Z2-7]+=*$/.test(secret)) return null

  let label = ''
  try {
    label = decodeURIComponent(url.pathname.replace(/^\//, ''))
  } catch {
    label = ''
  }
  const colon = label.indexOf(':')
  const labelIssuer = colon >= 0 ? label.slice(0, colon) : null
  const account = (colon >= 0 ? label.slice(colon + 1) : label).trim() || null
  const issuer = url.searchParams.get('issuer') ?? labelIssuer
  return { secret, account, issuer: issuer?.trim() || null }
}

/** 密钥按 4 个一组用空格分开，方便对照手动输入 */
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, '$1 ')
}
