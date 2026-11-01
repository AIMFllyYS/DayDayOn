import { describe, expect, it } from 'vitest'
import {
  detectAnomalies,
  escapeLike,
  fillSpendSeries,
  isCapReached,
  type AnomalyInput,
} from './rules'

const now = new Date('2026-11-01T04:00:00.000Z')
const empty: AnomalyInput = { dailySpend: [], hourlyCalls: [], signupIps: [], redeemFailures: [] }
const opts = { redeemFailThreshold: 5, labels: new Map([['u1', '阿柚']]), now }

describe('detectAnomalies', () => {
  it('没有数据时没有异常', () => {
    expect(detectAnomalies(empty, opts)).toEqual([])
  })

  it('单人单日花费：超过 5 元才算，正好 5 元不算', () => {
    const r = detectAnomalies(
      {
        ...empty,
        dailySpend: [
          { userId: 'u1', spentMicros: 5_000_001 },
          { userId: 'u2', spentMicros: 5_000_000 },
        ],
      },
      opts,
    )
    expect(r).toEqual([
      {
        kind: 'user-daily-spend',
        subject: 'u1',
        label: '阿柚',
        value: 5_000_001,
        detectedAt: '2026-11-01T04:00:00.000Z',
      },
    ])
  })

  it('每小时调用：超过 60 次才算，同一用户只取最高的那个小时', () => {
    const r = detectAnomalies(
      {
        ...empty,
        hourlyCalls: [
          { userId: 'u1', calls: 61 },
          { userId: 'u1', calls: 80 },
          { userId: 'u2', calls: 60 },
        ],
      },
      opts,
    )
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ kind: 'user-hourly-calls', subject: 'u1', value: 80 })
  })

  it('同一注册 IP：超过 3 个账号才算，label 为 null', () => {
    const r = detectAnomalies(
      {
        ...empty,
        signupIps: [
          { ip: '1.2.3.4', accounts: 4 },
          { ip: '5.6.7.8', accounts: 3 },
        ],
      },
      opts,
    )
    expect(r).toEqual([
      expect.objectContaining({
        kind: 'ip-multi-account',
        subject: '1.2.3.4',
        label: null,
        value: 4,
      }),
    ])
  })

  it('兑换失败：达到锁定阈值就算', () => {
    const r = detectAnomalies(
      {
        ...empty,
        redeemFailures: [
          { userId: 'u3', failures: 5 },
          { userId: 'u4', failures: 4 },
        ],
      },
      opts,
    )
    expect(r).toEqual([
      expect.objectContaining({ kind: 'redeem-failures', subject: 'u3', label: null, value: 5 }),
    ])
  })

  it('阈值跟着全站设置走', () => {
    const r = detectAnomalies(
      { ...empty, redeemFailures: [{ userId: 'u4', failures: 2 }] },
      { ...opts, redeemFailThreshold: 2 },
    )
    expect(r).toHaveLength(1)
  })

  it('按种类排序，同种按数值降序', () => {
    const r = detectAnomalies(
      {
        dailySpend: [
          { userId: 'a', spentMicros: 6_000_000 },
          { userId: 'b', spentMicros: 9_000_000 },
        ],
        hourlyCalls: [{ userId: 'c', calls: 99 }],
        signupIps: [{ ip: '1.1.1.1', accounts: 5 }],
        redeemFailures: [{ userId: 'd', failures: 7 }],
      },
      opts,
    )
    expect(r.map((a) => [a.kind, a.subject])).toEqual([
      ['user-daily-spend', 'b'],
      ['user-daily-spend', 'a'],
      ['user-hourly-calls', 'c'],
      ['ip-multi-account', '1.1.1.1'],
      ['redeem-failures', 'd'],
    ])
  })
})

describe('fillSpendSeries', () => {
  it('补满 30 天，按日期升序，缺的日子为 0', () => {
    const s = fillSpendSeries(
      [
        { dayKey: '2026-11-01', spentMicros: 300 },
        { dayKey: '2026-10-15', spentMicros: 100 },
      ],
      '2026-11-01',
    )
    expect(s).toHaveLength(30)
    expect(s[0]).toEqual({ dayKey: '2026-10-03', spentMicros: 0 })
    expect(s.at(-1)).toEqual({ dayKey: '2026-11-01', spentMicros: 300 })
    expect(s.find((d) => d.dayKey === '2026-10-15')?.spentMicros).toBe(100)
  })

  it('窗口外的行被忽略；跨年', () => {
    const s = fillSpendSeries([{ dayKey: '2025-12-01', spentMicros: 9 }], '2026-01-02', 3)
    expect(s).toEqual([
      { dayKey: '2025-12-31', spentMicros: 0 },
      { dayKey: '2026-01-01', spentMicros: 0 },
      { dayKey: '2026-01-02', spentMicros: 0 },
    ])
  })
})

describe('isCapReached', () => {
  it('达到即算到上限', () => {
    expect(isCapReached(10_000_000, 10_000_000)).toBe(true)
    expect(isCapReached(9_999_999, 10_000_000)).toBe(false)
    expect(isCapReached(0, 0)).toBe(true)
  })
})

describe('escapeLike', () => {
  it('转义通配符', () => {
    expect(escapeLike('a_b%c\\d')).toBe('a\\_b\\%c\\\\d')
    expect(escapeLike('qq.com')).toBe('qq.com')
  })
})
