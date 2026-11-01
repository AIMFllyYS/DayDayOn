import { describe, expect, it } from 'vitest'
import { alertMail, escapeHtml, otpMail } from './templates'

describe('邮件模板', () => {
  it('验证码邮件包含验证码和有效期', () => {
    const m = otpMail('123456')
    expect(m.subject).toContain('123456')
    expect(m.html).toContain('123456')
    expect(m.html).toContain('5 分钟内有效')
    expect(m.text).toContain('123456')
  })

  it('告警邮件对插值做 HTML 转义', () => {
    const m = alertMail('全站日上限', { user: '<script>x</script>', spent: 10 })
    expect(m.html).not.toContain('<script>x</script>')
    expect(m.html).toContain('&lt;script&gt;')
    expect(m.text).toContain('spent: 10')
  })

  it('escapeHtml 处理五个特殊字符', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})
