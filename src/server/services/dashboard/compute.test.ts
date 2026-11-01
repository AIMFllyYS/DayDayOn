import { describe, expect, it } from 'vitest'
import { weekDates } from '@/lib/time'
import {
  buildHeatmap,
  buildReminder,
  buildToday,
  buildWeightTrend,
  indexCheckins,
  reminderDue,
  weightReferenceDate,
  type DashboardGoal,
  type GoalCheckin,
} from './compute'

// 2026-11-01 是周日；本周 10-26（周一）到 11-01
const TODAY = '2026-11-01'
const ALL = [1, 2, 3, 4, 5, 6, 7]

function goal(over: Partial<DashboardGoal> & Pick<DashboardGoal, 'id' | 'module'>): DashboardGoal {
  return {
    title: over.id,
    sortOrder: 0,
    history: [{ effectiveFrom: '2026-10-01', kind: 'count', value: 1, weekdays: ALL }],
    ...over,
  }
}

function ck(goalId: string, localDate: string, over: Partial<GoalCheckin> = {}): GoalCheckin {
  return {
    goalId,
    localDate,
    isMakeup: false,
    durationSeconds: null,
    count: 1,
    mealType: null,
    occurredAt: `${localDate}T02:00:00.000Z`,
    ...over,
  }
}

describe('buildToday', () => {
  const run = goal({
    id: 'run',
    module: 'exercise',
    sortOrder: 1,
    history: [{ effectiveFrom: '2026-10-01', kind: 'duration', value: 1800, weekdays: ALL }],
  })
  const eat = goal({
    id: 'eat',
    module: 'diet',
    sortOrder: 0,
    history: [{ effectiveFrom: '2026-10-01', kind: 'count', value: 3, weekdays: ALL }],
  })
  // 只在工作日计划：周日不在计划内
  const study = goal({
    id: 'study',
    module: 'study',
    sortOrder: 2,
    history: [{ effectiveFrom: '2026-10-01', kind: 'count', value: 1, weekdays: [1, 2, 3, 4, 5] }],
  })

  it('只列计划内的目标，按 sortOrder；完成度只数计划内的', () => {
    const index = indexCheckins([
      ck('run', TODAY, { durationSeconds: 1200 }),
      ck('run', TODAY, { durationSeconds: 720 }),
      ck('eat', TODAY, { mealType: 'breakfast' }),
      ck('eat', TODAY, { mealType: 'breakfast' }),
      ck('study', TODAY),
    ])
    const r = buildToday([run, eat, study], index, TODAY)
    expect(r.goals.map((g) => g.goalId)).toEqual(['eat', 'run'])
    expect(r.goals[1]?.progress).toEqual({ value: 1920, target: 1800, done: true })
    // 饮食按不同餐次计：两条早餐算 1 次
    expect(r.goals[0]?.progress).toEqual({ value: 1, target: 3, done: false })
    // 学习不在今天的计划里，完成了也不计入 planned
    expect(r.completion).toEqual({ done: 1, planned: 2 })
  })

  it('用当天生效的目标量', () => {
    const changed = goal({
      id: 'run',
      module: 'exercise',
      history: [
        { effectiveFrom: '2026-10-01', kind: 'duration', value: 1800, weekdays: ALL },
        { effectiveFrom: TODAY, kind: 'duration', value: 3600, weekdays: ALL },
      ],
    })
    const r = buildToday(
      [changed],
      indexCheckins([ck('run', TODAY, { durationSeconds: 2000 })]),
      TODAY,
    )
    expect(r.goals[0]?.target).toEqual({ kind: 'duration', value: 3600 })
    expect(r.goals[0]?.progress.done).toBe(false)
  })

  it('没有目标：空列表，0 / 0', () => {
    expect(buildToday([], new Map(), TODAY)).toEqual({
      goals: [],
      completion: { done: 0, planned: 0 },
    })
  })
})

describe('buildHeatmap', () => {
  const days = weekDates(TODAY)

  it('周一到周日 × 五个板块；格值 = 当天完成的计划目标 / 计划目标', () => {
    const a = goal({ id: 'a', module: 'exercise' })
    const b = goal({ id: 'b', module: 'exercise' })
    const index = indexCheckins([
      ck('a', '2026-10-26'),
      ck('a', '2026-10-27'),
      ck('b', '2026-10-27'),
    ])
    const map = buildHeatmap([a, b], index, days, TODAY)
    expect(map.days).toEqual(days)
    expect(map.rows.map((r) => r.module)).toEqual(['exercise', 'diet', 'sleep', 'study', 'custom'])
    const exercise = map.rows[0]?.cells
    expect(exercise?.slice(0, 3)).toEqual([0.5, 1, 0])
    // 没有目标的板块全是 0
    expect(map.rows[1]?.cells).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('没有计划但有打卡：记满', () => {
    const weekend = goal({
      id: 'w',
      module: 'study',
      history: [{ effectiveFrom: '2026-10-01', kind: 'count', value: 2, weekdays: [6, 7] }],
    })
    const map = buildHeatmap([weekend], indexCheckins([ck('w', '2026-10-26')]), days, TODAY)
    expect(map.rows[3]?.cells[0]).toBe(1)
  })

  it('今天之后的格子为 0', () => {
    const a = goal({ id: 'a', module: 'exercise' })
    const midweek = '2026-10-28'
    const index = indexCheckins([ck('a', '2026-10-29'), ck('a', '2026-10-30')])
    const map = buildHeatmap([a], index, weekDates(midweek), midweek)
    expect(map.rows[0]?.cells.slice(3)).toEqual([0, 0, 0, 0])
  })

  it('目标建立之前的日子不算计划内', () => {
    const fresh = goal({
      id: 'f',
      module: 'sleep',
      history: [{ effectiveFrom: '2026-10-30', kind: 'count', value: 1, weekdays: ALL }],
    })
    const map = buildHeatmap([fresh], new Map(), days, TODAY)
    expect(map.rows[2]?.cells).toEqual([0, 0, 0, 0, 0, 0, 0])
    const done = buildHeatmap([fresh], indexCheckins([ck('f', '2026-10-30')]), days, TODAY)
    expect(done.rows[2]?.cells).toEqual([0, 0, 0, 0, 1, 0, 0])
  })
})

describe('打卡提醒', () => {
  it('过了提醒时间才提醒', () => {
    expect(reminderDue('20:59', '21:00', 4)).toBe(false)
    expect(reminderDue('21:00', '21:00', 4)).toBe(true)
    expect(reminderDue('23:30', '21:00', 4)).toBe(true)
  })

  it('按打卡日比较：4 点换日时凌晨 1 点仍算过了前一天 21:00', () => {
    expect(reminderDue('01:00', '21:00', 4)).toBe(true)
    // 4 点后是新的一天，又没到提醒时间
    expect(reminderDue('04:30', '21:00', 4)).toBe(false)
    // 零点换日时凌晨 1 点是新的一天
    expect(reminderDue('01:00', '21:00', 0)).toBe(false)
  })

  it('没设提醒、全部完成、今天没有计划：都不提醒', () => {
    expect(buildReminder(null, '22:00', 4, { done: 0, planned: 3 })).toBeNull()
    expect(buildReminder('21:00', '22:00', 4, { done: 3, planned: 3 })).toBeNull()
    expect(buildReminder('21:00', '22:00', 4, { done: 0, planned: 0 })).toBeNull()
    expect(buildReminder('21:00', '20:00', 4, { done: 0, planned: 3 })).toBeNull()
  })

  it('还剩几项没完成', () => {
    expect(buildReminder('21:00', '22:00', 4, { done: 1, planned: 3 })).toEqual({ remaining: 2 })
  })
})

describe('体重卡', () => {
  const e = (localDate: string, weightGrams: number) => ({
    localDate,
    weightGrams,
    measuredAt: `${localDate}T00:00:00.000Z`,
  })

  it('参考日是最近一次往前 7 天', () => {
    expect(weightReferenceDate('2026-11-01')).toBe('2026-10-25')
  })

  it('差值 = 最近一次 − 参考记录；没有参考为 null', () => {
    const latest = e('2026-11-01', 52_400)
    expect(buildWeightTrend([latest], latest, e('2026-10-24', 53_000)).deltaGrams7d).toBe(-600)
    expect(buildWeightTrend([latest], latest, null).deltaGrams7d).toBeNull()
    expect(buildWeightTrend([], null, null)).toEqual({
      entries: [],
      latest: null,
      deltaGrams7d: null,
    })
  })

  it('entries 按日期升序', () => {
    const t = buildWeightTrend([e('2026-11-01', 1), e('2026-10-30', 2)], null, null)
    expect(t.entries.map((x) => x.localDate)).toEqual(['2026-10-30', '2026-11-01'])
  })
})
