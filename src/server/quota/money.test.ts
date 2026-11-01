import { describe, expect, it } from 'vitest'
import { resetForPeriod, settleSplit, splitCharge, topUpDelta, weeklyRemaining } from './money'

const account = (weeklyLimitMicros: number, weeklyUsedMicros: number, bonusMicros: number) => ({
  weeklyLimitMicros,
  weeklyUsedMicros,
  bonusMicros,
})

describe('splitCharge（预占）', () => {
  it('本周额度够时只扣本周', () => {
    expect(splitCharge(account(10_000_000, 0, 5_000_000), 7000)).toEqual({
      weeklyMicros: 7000,
      bonusMicros: 0,
    })
  })

  it('本周额度用完再扣加购余额', () => {
    expect(splitCharge(account(10_000_000, 9_995_000, 5_000_000), 7000)).toEqual({
      weeklyMicros: 5000,
      bonusMicros: 2000,
    })
  })

  it('本周额度为 0 时全部扣加购', () => {
    expect(splitCharge(account(2_000_000, 2_000_000, 10_000), 7000)).toEqual({
      weeklyMicros: 0,
      bonusMicros: 7000,
    })
  })

  it('两个桶加起来不够时返回 null', () => {
    expect(splitCharge(account(10_000, 9_000, 500), 2000)).toBeNull()
  })

  it('正好用完两个桶', () => {
    expect(splitCharge(account(10_000, 9_000, 1000), 2000)).toEqual({
      weeklyMicros: 1000,
      bonusMicros: 1000,
    })
  })

  it('已用超过上限（例如管理员调低）时本周剩余按 0 算', () => {
    expect(weeklyRemaining(account(1000, 3000, 0))).toBe(0)
    expect(splitCharge(account(1000, 3000, 0), 1)).toBeNull()
  })

  it('非法金额返回 null', () => {
    expect(splitCharge(account(10_000, 0, 0), -1)).toBeNull()
    expect(splitCharge(account(10_000, 0, 0), 1.5)).toBeNull()
  })
})

describe('settleSplit（结算 / 释放）', () => {
  it('实际费用少于预占时多退', () => {
    expect(settleSplit({ weeklyMicros: 10_400, bonusMicros: 0 }, 7000)).toEqual({
      chargedMicros: 7000,
      weeklyRefundMicros: 3400,
      bonusRefundMicros: 0,
    })
  })

  it('跨两个桶时先算本周部分，加购部分优先退回', () => {
    expect(settleSplit({ weeklyMicros: 5000, bonusMicros: 5400 }, 7000)).toEqual({
      chargedMicros: 7000,
      weeklyRefundMicros: 0,
      bonusRefundMicros: 3400,
    })
  })

  it('实际费用小于本周部分时加购部分全退', () => {
    expect(settleSplit({ weeklyMicros: 5000, bonusMicros: 5400 }, 3000)).toEqual({
      chargedMicros: 3000,
      weeklyRefundMicros: 2000,
      bonusRefundMicros: 5400,
    })
  })

  it('失败释放（费用 0）全额退回', () => {
    expect(settleSplit({ weeklyMicros: 5000, bonusMicros: 5400 }, 0)).toEqual({
      chargedMicros: 0,
      weeklyRefundMicros: 5000,
      bonusRefundMicros: 5400,
    })
  })

  it('实际费用超过预占时按预占封顶，不超扣', () => {
    expect(settleSplit({ weeklyMicros: 1000, bonusMicros: 0 }, 5000)).toEqual({
      chargedMicros: 1000,
      weeklyRefundMicros: 0,
      bonusRefundMicros: 0,
    })
  })

  it('退回 + 扣下 = 预占合计', () => {
    const reserved = { weeklyMicros: 3333, bonusMicros: 7777 }
    for (const actual of [0, 1, 3333, 3334, 9999, 11_110, 20_000]) {
      const r = settleSplit(reserved, actual)
      expect(r.chargedMicros + r.weeklyRefundMicros + r.bonusRefundMicros).toBe(11_110)
    }
  })
})

describe('resetForPeriod（周期切换）', () => {
  it('本周额度重置为新上限，没用完的清零不累积', () => {
    expect(resetForPeriod(account(10_000_000, 4_000_000, 3_000_000), 10_000_000)).toEqual({
      weeklyLimitMicros: 10_000_000,
      weeklyUsedMicros: 0,
      deltaMicros: 4_000_000,
    })
  })

  it('新账号首周 2 元，下一周按 10 元发放', () => {
    expect(resetForPeriod(account(2_000_000, 2_000_000, 0), 10_000_000)).toEqual({
      weeklyLimitMicros: 10_000_000,
      weeklyUsedMicros: 0,
      deltaMicros: 10_000_000,
    })
  })
})

describe('topUpDelta（引导完成补额度）', () => {
  it('2 元补到 10 元，流水 +8 元', () => {
    expect(topUpDelta({ weeklyLimitMicros: 2_000_000 }, 10_000_000)).toBe(8_000_000)
  })

  it('已经不低于目标时不变', () => {
    expect(topUpDelta({ weeklyLimitMicros: 10_000_000 }, 10_000_000)).toBe(0)
    expect(topUpDelta({ weeklyLimitMicros: 12_000_000 }, 10_000_000)).toBe(0)
  })
})
