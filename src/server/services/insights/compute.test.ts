import { describe, expect, it, vi } from 'vitest'
import type { Verdict } from '@/features/referee/schemas'

vi.mock('server-only', () => ({}))
const { computeGoalInsight, nightMinutes, topFailureOf } = await import('./compute')

/* 板块近况的口径：只认入库时算好的 isValid / score / verdict */

const TODAY = '2026-11-05'
const TZ = 'Asia/Shanghai'

function verdict(checks: { id: string; text: string; ok: boolean }[]): Verdict {
  return {
    version: 1,
    isValid: checks.every((c) => c.ok),
    score: null,
    scoreMax: null,
    detail: '',
    checks,
    metrics: {},
    facts: null,
    citations: [],
    advice: [],
    refereeRunId: null,
    offline: true,
  }
}

const row = (over: Partial<Parameters<typeof computeGoalInsight>[0]['rows'][number]>) => ({
  localDate: TODAY,
  isValid: true,
  score: null,
  durationSeconds: null,
  intakeKcal: null,
  burnKcal: null,
  payload: {},
  verdict: null,
  ...over,
})

const goal = (
  module: 'diet' | 'sleep' | 'study' | 'exercise' | 'custom',
  deadlineDate: string | null = null,
) => ({
  id: 'g1',
  module,
  title: '目标',
  refereeRules: null,
  deadlineDate,
})

describe('nightMinutes', () => {
  it('中午以前算作次日凌晨，跨零点也能比较', () => {
    expect(nightMinutes('23:30')).toBe(1410)
    expect(nightMinutes('00:30')).toBe(1470)
    expect(nightMinutes('13:00')).toBe(780)
  })
})

describe('topFailureOf', () => {
  it('取出现最多的未通过项，of 是有结论的条数', () => {
    const rows = [
      row({ verdict: verdict([{ id: 'sodium', text: '钠 ≤ 1500mg', ok: false }]) }),
      row({
        verdict: verdict([
          { id: 'sodium', text: '钠 ≤ 1500mg', ok: false },
          { id: 'fiber', text: '膳食纤维 ≥ 5g', ok: false },
        ]),
      }),
      row({ verdict: null }),
    ]
    expect(topFailureOf(rows)).toEqual({ text: '钠 ≤ 1500mg', count: 2, of: 2 })
  })

  it('全都通过时为 null', () => {
    expect(topFailureOf([row({ verdict: verdict([{ id: 'a', text: 'a', ok: true }]) })])).toBeNull()
  })
})

describe('computeGoalInsight', () => {
  it('饮食：平均分、有效线、达标条数、每天平均分', () => {
    const r = computeGoalInsight({
      goal: goal('diet'),
      rows: [
        row({ localDate: '2026-11-04', score: 3.7, intakeKcal: 600 }),
        row({ localDate: '2026-11-05', score: 2.5, isValid: false, intakeKcal: 800 }),
        row({ localDate: '2026-11-05', score: 4.1, intakeKcal: 500 }),
        // 范围外的不算
        row({ localDate: '2026-10-01', score: 1 }),
      ],
      today: TODAY,
      days: 7,
      timeZone: TZ,
    })
    expect(r.total).toBe(3)
    expect(r.valid).toBe(2)
    expect(r.validDays).toBe(2)
    expect(r.avgScore).toBe(3.4)
    expect(r.passScore).toBe(3)
    expect(r.kcal).toBe(633)
    expect(r.series).toHaveLength(7)
    expect(r.series.at(-1)).toEqual({ date: TODAY, value: 3.3 })
    expect(r.series[0]?.value).toBeNull()
  })

  it('睡眠：平均入睡跨零点，晚于红线的晚数', () => {
    const r = computeGoalInsight({
      goal: goal('sleep'),
      rows: [
        // 北京时间 23:00 入睡
        row({
          localDate: '2026-11-04',
          durationSeconds: 8 * 3600,
          payload: { bedAt: '2026-11-03T15:00:00Z' },
        }),
        // 北京时间 01:00 入睡
        row({
          localDate: '2026-11-05',
          durationSeconds: 6 * 3600,
          payload: { bedAt: '2026-11-04T17:00:00Z' },
        }),
      ],
      today: TODAY,
      days: 7,
      timeZone: TZ,
    })
    expect(r.avgSleepSeconds).toBe(7 * 3600)
    expect(r.avgBedMinutes).toBe(0) // 23:00 与 01:00 的平均是 00:00
    expect(r.lateNights).toBe(1)
    expect(r.bedtimeBy).toBe('23:30')
  })

  it('学习：碎片累加时长，每日下限来自规则', () => {
    const r = computeGoalInsight({
      goal: goal('study'),
      rows: [row({ durationSeconds: 600, isValid: false }), row({ durationSeconds: 1200 })],
      today: TODAY,
      days: 7,
      timeZone: TZ,
    })
    expect(r.totalSeconds).toBe(1800)
    expect(r.dailyTargetSeconds).toBe(25 * 60)
    expect(r.series.at(-1)?.value).toBe(1800)
  })

  it('期限：剩余天数，过期按 0', () => {
    const later = computeGoalInsight({
      goal: goal('custom', '2026-11-15'),
      rows: [],
      today: TODAY,
      days: 7,
      timeZone: TZ,
    })
    expect(later.deadline).toEqual({ date: '2026-11-15', daysLeft: 10 })
    const past = computeGoalInsight({
      goal: goal('custom', '2026-11-01'),
      rows: [],
      today: TODAY,
      days: 7,
      timeZone: TZ,
    })
    expect(past.deadline?.daysLeft).toBe(0)
  })

  it('30 天范围：series 30 个点', () => {
    const r = computeGoalInsight({
      goal: goal('exercise'),
      rows: [],
      today: TODAY,
      days: 30,
      timeZone: TZ,
    })
    expect(r.series).toHaveLength(30)
    expect(r.series[0]?.date).toBe('2026-10-07')
  })
})
