import { describe, expect, it } from 'vitest'
import { QuotaViewSchema } from '@/features/quota/schemas'
import { toAiRunItem, toQuotaView } from './view'

describe('toQuotaView', () => {
  it('剩余 = 上限 - 已用（已用含本周预占），时间转 ISO，符合接口 schema', () => {
    const view = toQuotaView(
      {
        periodKey: '2026-W44',
        weeklyLimitMicros: 10_000_000,
        weeklyUsedMicros: 3_420_000,
        bonusMicros: 10_000_000,
        reservedMicros: 10_400,
      },
      new Date('2026-11-01T16:00:00.000Z'),
    )
    expect(view).toEqual({
      periodKey: '2026-W44',
      weeklyLimitMicros: 10_000_000,
      weeklyUsedMicros: 3_420_000,
      weeklyRemainingMicros: 6_580_000,
      bonusMicros: 10_000_000,
      reservedMicros: 10_400,
      periodEndsAt: '2026-11-01T16:00:00.000Z',
    })
    expect(QuotaViewSchema.safeParse(view).success).toBe(true)
  })

  it('超用时剩余不小于 0', () => {
    const view = toQuotaView(
      {
        periodKey: 'k',
        weeklyLimitMicros: 2_000_000,
        weeklyUsedMicros: 2_100_000,
        bonusMicros: 0,
        reservedMicros: 0,
      },
      new Date(0),
    )
    expect(view.weeklyRemainingMicros).toBe(0)
  })
})

describe('toAiRunItem', () => {
  it('只保留用途、状态、花费、时间', () => {
    expect(
      toAiRunItem({
        id: '0193f6b2-0000-7000-8000-000000000001',
        purpose: 'diet-recognition',
        status: 'succeeded',
        costMicros: 7000,
        createdAt: new Date('2026-11-01T04:30:00.000Z'),
      }),
    ).toEqual({
      id: '0193f6b2-0000-7000-8000-000000000001',
      purpose: 'diet-recognition',
      status: 'succeeded',
      costMicros: 7000,
      createdAt: '2026-11-01T04:30:00.000Z',
    })
  })
})
