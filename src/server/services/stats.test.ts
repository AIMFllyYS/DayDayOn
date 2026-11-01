import { describe, expect, it } from 'vitest'
import type { GoalProgress } from '@/features/checkin/schemas'
import type { TargetOnDay } from '@/features/goal/schemas'
import {
  computeStreak,
  countRankDays,
  dayCompletion,
  goalDayProgress,
  heatmapCell,
  isPlannedOn,
  type StatCheckin,
  targetOnDay,
  type TargetVersion,
} from './stats'

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7]

function checkin(overrides: Partial<StatCheckin> = {}): StatCheckin {
  return {
    localDate: '2026-10-31',
    isMakeup: false,
    durationSeconds: null,
    count: 1,
    mealType: null,
    occurredAt: '2026-10-31T04:00:00Z',
    ...overrides,
  }
}

const progress = (value: number, target: number): GoalProgress => ({
  value,
  target,
  done: value >= target,
})

describe('targetOnDay', () => {
  const history: TargetVersion[] = [
    { effectiveFrom: '2026-11-05', kind: 'duration', value: 3600, weekdays: [1, 3, 5] },
    { effectiveFrom: '2026-10-20', kind: 'duration', value: 1800, weekdays: EVERY_DAY },
  ]

  it('取当天生效的那一行（effectiveFrom ≤ 当天里最新的）', () => {
    expect(targetOnDay(history, '2026-10-31')?.value).toBe(1800)
    expect(targetOnDay(history, '2026-11-04')?.value).toBe(1800)
    expect(targetOnDay(history, '2026-11-05')?.value).toBe(3600)
    expect(targetOnDay(history, '2026-12-01')).toEqual({
      kind: 'duration',
      value: 3600,
      weekdays: [1, 3, 5],
    })
  })

  it('早于第一行的日子用最早的一行', () => {
    expect(targetOnDay(history, '2026-10-19')?.value).toBe(1800)
  })

  it('没有历史返回 null', () => {
    expect(targetOnDay([], '2026-10-31')).toBeNull()
  })
})

describe('isPlannedOn', () => {
  const weekdaysOnly: TargetOnDay = { kind: 'count', value: 1, weekdays: [1, 2, 3, 4, 5] }

  it('按 ISO 星期判断', () => {
    expect(isPlannedOn(weekdaysOnly, '2026-10-30')).toBe(true) // 周五
    expect(isPlannedOn(weekdaysOnly, '2026-10-31')).toBe(false) // 周六
    expect(isPlannedOn(weekdaysOnly, '2026-11-01')).toBe(false) // 周日 = 7
    expect(isPlannedOn(weekdaysOnly, '2026-11-02')).toBe(true) // 周一 = 1
  })

  it('每天都计划', () => {
    expect(isPlannedOn({ kind: 'count', value: 1, weekdays: EVERY_DAY }, '2026-11-01')).toBe(true)
  })
})

describe('goalDayProgress', () => {
  it('运动：累加时长', () => {
    const target: TargetOnDay = { kind: 'duration', value: 1800, weekdays: EVERY_DAY }
    const p = goalDayProgress(target, 'exercise', [
      checkin({ durationSeconds: 1200 }),
      checkin({ durationSeconds: 720 }),
    ])
    expect(p).toEqual({ value: 1920, target: 1800, done: true })
  })

  it('运动：不足目标量未完成；没有记录为 0', () => {
    const target: TargetOnDay = { kind: 'duration', value: 1800, weekdays: EVERY_DAY }
    expect(goalDayProgress(target, 'exercise', [checkin({ durationSeconds: 1799 })]).done).toBe(
      false,
    )
    expect(goalDayProgress(target, 'exercise', [])).toEqual({ value: 0, target: 1800, done: false })
  })

  it('时长为空的记录按 0 计', () => {
    const target: TargetOnDay = { kind: 'duration', value: 600, weekdays: EVERY_DAY }
    const p = goalDayProgress(target, 'study', [checkin(), checkin({ durationSeconds: 600 })])
    expect(p.value).toBe(600)
    expect(p.done).toBe(true)
  })

  it('饮食：按不同餐次计数，同一餐多条只算一次', () => {
    const target: TargetOnDay = { kind: 'count', value: 3, weekdays: EVERY_DAY }
    const two = goalDayProgress(target, 'diet', [
      checkin({ mealType: 'breakfast' }),
      checkin({ mealType: 'lunch' }),
      checkin({ mealType: 'lunch' }),
    ])
    expect(two).toEqual({ value: 2, target: 3, done: false })
    const three = goalDayProgress(target, 'diet', [
      checkin({ mealType: 'breakfast' }),
      checkin({ mealType: 'lunch' }),
      checkin({ mealType: 'snack' }),
    ])
    expect(three.done).toBe(true)
  })

  it('睡眠：取当天那条的时长，不累加', () => {
    const target: TargetOnDay = { kind: 'duration', value: 28_800, weekdays: EVERY_DAY }
    expect(goalDayProgress(target, 'sleep', [checkin({ durationSeconds: 27_000 })])).toEqual({
      value: 27_000,
      target: 28_800,
      done: false,
    })
    expect(
      goalDayProgress(target, 'sleep', [
        checkin({ durationSeconds: 20_000 }),
        checkin({ durationSeconds: 29_000 }),
      ]).value,
    ).toBe(29_000)
  })

  it('学习、自定义：按记录数计', () => {
    const target: TargetOnDay = { kind: 'count', value: 2, weekdays: EVERY_DAY }
    expect(goalDayProgress(target, 'study', [checkin()]).done).toBe(false)
    expect(goalDayProgress(target, 'study', [checkin(), checkin()]).done).toBe(true)
    expect(goalDayProgress({ ...target, value: 1 }, 'custom', [checkin()])).toEqual({
      value: 1,
      target: 1,
      done: true,
    })
  })

  it('补卡计入进度', () => {
    const target: TargetOnDay = { kind: 'count', value: 1, weekdays: EVERY_DAY }
    expect(goalDayProgress(target, 'study', [checkin({ isMakeup: true })]).done).toBe(true)
  })
})

describe('dayCompletion', () => {
  it('只数计划内的目标', () => {
    const r = dayCompletion([
      { goalId: 'a', module: 'exercise', planned: true, progress: progress(1800, 1800) },
      { goalId: 'b', module: 'diet', planned: true, progress: progress(1, 3) },
      // 不在计划日但打了卡：不计入 planned，也不计入 done
      { goalId: 'c', module: 'study', planned: false, progress: progress(2, 2) },
    ])
    expect(r).toEqual({ done: 1, planned: 2 })
  })

  it('没有目标时为 0 / 0', () => {
    expect(dayCompletion([])).toEqual({ done: 0, planned: 0 })
  })
})

describe('computeStreak', () => {
  const today = '2026-11-01'

  it('今天打了卡：从今天往回数', () => {
    expect(computeStreak(['2026-11-01', '2026-10-31', '2026-10-30'], today)).toBe(3)
  })

  it('今天还没打卡：从昨天往回数', () => {
    expect(computeStreak(['2026-10-31', '2026-10-30'], today)).toBe(2)
  })

  it('断一天归零', () => {
    expect(computeStreak(['2026-10-30', '2026-10-29'], today)).toBe(0)
    expect(computeStreak(['2026-11-01', '2026-10-30'], today)).toBe(1)
  })

  it('重复、无序的日期；跨月跨年', () => {
    expect(
      computeStreak(['2026-12-31', '2027-01-01', '2026-12-31', '2026-12-30'], '2027-01-01'),
    ).toBe(3)
    expect(computeStreak(['2026-11-01', '2026-10-31', '2026-11-01'], today)).toBe(2)
  })

  it('补卡日也算（调用方传入的日期已含补卡）；晚于今天的日期不影响', () => {
    expect(computeStreak(['2026-11-02', '2026-11-01'], today)).toBe(1)
  })

  it('没有打卡为 0', () => {
    expect(computeStreak([], today)).toBe(0)
  })
})

describe('countRankDays', () => {
  it('排除补卡、同日去重', () => {
    expect(
      countRankDays([
        { localDate: '2026-10-26', isMakeup: false },
        { localDate: '2026-10-26', isMakeup: false },
        { localDate: '2026-10-27', isMakeup: true },
        { localDate: '2026-10-28', isMakeup: false },
      ]),
    ).toBe(2)
  })

  it('同一天既有补卡又有正常打卡算一天', () => {
    expect(
      countRankDays([
        { localDate: '2026-10-27', isMakeup: true },
        { localDate: '2026-10-27', isMakeup: false },
      ]),
    ).toBe(1)
  })

  it('全是补卡为 0', () => {
    expect(countRankDays([{ localDate: '2026-10-27', isMakeup: true }])).toBe(0)
    expect(countRankDays([])).toBe(0)
  })
})

describe('heatmapCell', () => {
  it('已完成的计划目标数 / 计划目标数', () => {
    expect(
      heatmapCell(
        [{ planned: true }, { planned: true }],
        [progress(1800, 1800), progress(600, 1800)],
      ),
    ).toBe(0.5)
    expect(heatmapCell([{ planned: true }], [progress(1800, 1800)])).toBe(1)
  })

  it('不在计划日的目标不计入分母', () => {
    expect(
      heatmapCell([{ planned: true }, { planned: false }], [progress(0, 1), progress(1, 1)]),
    ).toBe(0)
  })

  it('没有计划但有打卡记 1', () => {
    expect(heatmapCell([{ planned: false }], [progress(600, 1800)])).toBe(1)
  })

  it('都没有为 0', () => {
    expect(heatmapCell([], [])).toBe(0)
    expect(heatmapCell([{ planned: false }], [progress(0, 1)])).toBe(0)
  })

  it('长度不一致抛错', () => {
    expect(() => heatmapCell([{ planned: true }], [])).toThrow(RangeError)
  })
})
