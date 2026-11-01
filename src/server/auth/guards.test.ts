import { describe, expect, it } from 'vitest'
import { checkAccount, checkAdmin, checkOnboarded, isBanned } from './guards'

const NOW = new Date('2026-11-01T08:00:00Z')

interface State {
  banned: boolean
  banReason: string | null
  banExpires: Date | null
  onboardedAt: Date | null
}

const state = (over: Partial<State> = {}): State => ({
  banned: false,
  banReason: null,
  banExpires: null,
  onboardedAt: new Date('2026-10-30T00:00:00Z'),
  ...over,
})

describe('isBanned', () => {
  it('未封禁', () => {
    expect(isBanned({ banned: false }, NOW)).toBe(false)
    expect(isBanned({ banned: null }, NOW)).toBe(false)
  })

  it('永久封禁', () => {
    expect(isBanned({ banned: true, banExpires: null }, NOW)).toBe(true)
  })

  it('到期前仍封禁，到期后不算', () => {
    expect(isBanned({ banned: true, banExpires: new Date('2026-11-02T00:00:00Z') }, NOW)).toBe(true)
    expect(isBanned({ banned: true, banExpires: new Date('2026-11-01T07:59:59Z') }, NOW)).toBe(
      false,
    )
  })
})

describe('checkAccount（requireUser）', () => {
  it('用户不存在：401 UNAUTHENTICATED', () => {
    expect(checkAccount(null, NOW)?.code).toBe('UNAUTHENTICATED')
  })

  it('被封禁：403 ACCOUNT_BANNED，带原因和到期时间', () => {
    const err = checkAccount(
      state({ banned: true, banReason: '刷额度', banExpires: new Date('2026-11-08T00:00:00Z') }),
      NOW,
    )
    expect(err?.status).toBe(403)
    expect(err?.toBody()).toEqual({
      code: 'ACCOUNT_BANNED',
      detail: '账号已被停用',
      ban: { reason: '刷额度', expiresAt: '2026-11-08T00:00:00.000Z' },
    })
  })

  it('永久封禁时 expiresAt 为 null', () => {
    const err = checkAccount(state({ banned: true }), NOW)
    expect(err?.extras.ban).toEqual({ reason: null, expiresAt: null })
  })

  it('封禁已过期：通过', () => {
    expect(
      checkAccount(state({ banned: true, banExpires: new Date('2026-10-01T00:00:00Z') }), NOW),
    ).toBeNull()
  })

  it('正常用户：通过', () => {
    expect(checkAccount(state(), NOW)).toBeNull()
  })
})

describe('checkOnboarded（requireOnboarded）', () => {
  it('未完成引导：403 ONBOARDING_REQUIRED', () => {
    const err = checkOnboarded(state({ onboardedAt: null }))
    expect(err?.code).toBe('ONBOARDING_REQUIRED')
    expect(err?.status).toBe(403)
  })

  it('已完成：通过', () => {
    expect(checkOnboarded(state())).toBeNull()
  })
})

describe('checkAdmin（requireAdmin）', () => {
  it('非管理员：403 FORBIDDEN', () => {
    expect(checkAdmin({ role: 'user', twoFactorEnabled: true })?.code).toBe('FORBIDDEN')
    expect(checkAdmin({ role: null })?.code).toBe('FORBIDDEN')
  })

  it('管理员未开两步验证：403 TWO_FACTOR_REQUIRED', () => {
    expect(checkAdmin({ role: 'admin', twoFactorEnabled: false })?.code).toBe('TWO_FACTOR_REQUIRED')
    expect(checkAdmin({ role: 'admin', twoFactorEnabled: null })?.code).toBe('TWO_FACTOR_REQUIRED')
  })

  it('管理员已开两步验证：通过', () => {
    expect(checkAdmin({ role: 'admin', twoFactorEnabled: true })).toBeNull()
  })
})
