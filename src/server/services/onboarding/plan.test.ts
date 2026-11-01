import { describe, expect, it } from 'vitest'
import { DEFAULT_GOALS } from '@/features/goal/defaults'
import { OnboardingSchema } from '@/features/me/schemas'
import { planOnboarding } from './plan'

const NOW = new Date('2026-11-01T02:00:00Z')

function input(over: Record<string, unknown> = {}) {
  return OnboardingSchema.parse({
    nickname: '  小满  ',
    modules: ['study', 'exercise'],
    healthConsent: true,
    ...over,
  })
}

describe('planOnboarding', () => {
  it('昵称去首尾空白，同意时间与完成时间都是 now', () => {
    const plan = planOnboarding(input(), NOW)
    expect(plan.profile.nickname).toBe('小满')
    expect(plan.profile.healthConsentAt).toEqual(NOW)
    expect(plan.profile.onboardedAt).toEqual(NOW)
  })

  it('默认值：不上榜、北京时区、无头像、无体重', () => {
    const plan = planOnboarding(input(), NOW)
    expect(plan.profile).toMatchObject({
      leaderboardOptIn: false,
      timeZone: 'Asia/Shanghai',
      avatar: null,
      gender: null,
      birthYear: null,
      heightCm: null,
    })
    expect(plan.weightGrams).toBeNull()
  })

  it('每个选中的板块一个默认目标，按固定板块顺序，与勾选顺序无关', () => {
    const plan = planOnboarding(input({ modules: ['custom', 'study', 'exercise'] }), NOW)
    expect(plan.goals.map((g) => g.module)).toEqual(['exercise', 'study', 'custom'])
    expect(plan.goals[0]).toEqual(DEFAULT_GOALS.exercise)
  })

  it('返回的是拷贝：改计划不影响共享的默认目标', () => {
    const plan = planOnboarding(input({ modules: ['custom'] }), NOW)
    const goal = plan.goals[0]
    if (!goal) throw new Error('应当有一个目标')
    goal.title = '改掉了'
    goal.weekdays.push(1)
    expect(DEFAULT_GOALS.custom.title).toBe('我的小目标')
    expect(DEFAULT_GOALS.custom.weekdays).toHaveLength(7)
  })

  it('填了体重就带上（克）', () => {
    const plan = planOnboarding(input({ weightGrams: 62_500 }), NOW)
    expect(plan.weightGrams).toBe(62_500)
  })

  it('schema 层：没有同意健康数据、没选板块、重复板块都不通过', () => {
    expect(OnboardingSchema.safeParse({ nickname: 'a', modules: ['diet'] }).success).toBe(false)
    expect(
      OnboardingSchema.safeParse({ nickname: 'a', modules: [], healthConsent: true }).success,
    ).toBe(false)
    expect(
      OnboardingSchema.safeParse({ nickname: 'a', modules: ['diet', 'diet'], healthConsent: true })
        .success,
    ).toBe(false)
  })

  it('schema 层：昵称最多 12 个字符（按码点计），不能含换行', () => {
    const ok = (nickname: string) =>
      OnboardingSchema.safeParse({ nickname, modules: ['diet'], healthConsent: true }).success
    expect(ok('一二三四五六七八九十一二')).toBe(true)
    expect(ok('一二三四五六七八九十一二三')).toBe(false)
    expect(ok('😀😀😀😀😀😀😀😀😀😀😀😀')).toBe(true)
    expect(ok('小\n满')).toBe(false)
    expect(ok('   ')).toBe(false)
  })
})
