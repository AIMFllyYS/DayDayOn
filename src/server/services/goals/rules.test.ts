import { describe, expect, it } from 'vitest'
import type { FieldDef } from '@/features/goal/schemas'
import {
  ACTIVE_SLEEP_CONSTRAINT,
  checkActivation,
  fieldsChanged,
  isTargetAllowed,
  isUniqueViolation,
  nextFieldVersion,
  normalizeWeekdays,
  targetChanged,
} from './rules'

const everyday = [1, 2, 3, 4, 5, 6, 7]

describe('目标量历史', () => {
  it('星期去重并排序', () => {
    expect(normalizeWeekdays([7, 1, 3, 1])).toEqual([1, 3, 7])
  })

  it('只改顺序不算改计划星期', () => {
    expect(
      targetChanged(
        { kind: 'count', value: 2, weekdays: [1, 3, 5] },
        { kind: 'count', value: 2, weekdays: [5, 3, 1] },
      ),
    ).toBe(false)
  })

  it('改目标量、类型或星期都算变化', () => {
    const base = { kind: 'duration' as const, value: 1800, weekdays: everyday }
    expect(targetChanged(base, { ...base, value: 2400 })).toBe(true)
    expect(targetChanged(base, { ...base, kind: 'count' })).toBe(true)
    expect(targetChanged(base, { ...base, weekdays: [1, 2, 3, 4, 5] })).toBe(true)
  })
})

describe('自定义字段版本', () => {
  const v1: FieldDef[] = [{ key: 'done', label: '完成了吗', type: 'boolean', required: true }]

  it('字段相同不生成新版本', () => {
    expect(fieldsChanged(v1, structuredClone(v1))).toBe(false)
  })

  it('改了字段名生成新版本', () => {
    expect(fieldsChanged(v1, [{ ...v1[0]!, label: '做到了吗' }])).toBe(true)
  })

  it('版本号递增，没有版本时从 1 开始', () => {
    expect(nextFieldVersion(null)).toBe(1)
    expect(nextFieldVersion(3)).toBe(4)
  })
})

describe('进行中目标上限', () => {
  it('已有 20 个进行中：不能再建', () => {
    expect(checkActivation('study', { activeCount: 20, hasActiveSleep: false })).toBe(
      'active-limit',
    )
  })

  it('19 个时还能建', () => {
    expect(checkActivation('study', { activeCount: 19, hasActiveSleep: false })).toBeNull()
  })

  it('已有进行中的睡眠目标：不能再建睡眠，其他板块可以', () => {
    expect(checkActivation('sleep', { activeCount: 3, hasActiveSleep: true })).toBe('active-sleep')
    expect(checkActivation('exercise', { activeCount: 3, hasActiveSleep: true })).toBeNull()
  })

  it('睡眠目标只能按时长计', () => {
    expect(isTargetAllowed('sleep', { kind: 'count', value: 1 })).toBe(false)
    expect(isTargetAllowed('sleep', { kind: 'duration', value: 28_800 })).toBe(true)
    expect(isTargetAllowed('study', { kind: 'count', value: 2 })).toBe(true)
  })

  it('饮食和自定义的打卡没有时长：只能按次数计', () => {
    expect(isTargetAllowed('diet', { kind: 'duration', value: 1800 })).toBe(false)
    expect(isTargetAllowed('custom', { kind: 'duration', value: 1800 })).toBe(false)
    expect(isTargetAllowed('diet', { kind: 'count', value: 3 })).toBe(true)
    expect(isTargetAllowed('custom', { kind: 'count', value: 1 })).toBe(true)
  })

  it('运动和学习两种都可以', () => {
    expect(isTargetAllowed('exercise', { kind: 'duration', value: 1800 })).toBe(true)
    expect(isTargetAllowed('exercise', { kind: 'count', value: 1 })).toBe(true)
    expect(isTargetAllowed('study', { kind: 'duration', value: 1800 })).toBe(true)
  })
})

describe('唯一冲突识别', () => {
  const pgError = { code: '23505', constraint: ACTIVE_SLEEP_CONSTRAINT }

  it('识别直接的 pg 错误', () => {
    expect(isUniqueViolation(pgError, ACTIVE_SLEEP_CONSTRAINT)).toBe(true)
  })

  it('识别 drizzle 包在 cause 里的 pg 错误', () => {
    const wrapped = Object.assign(new Error('Failed query'), { cause: pgError })
    expect(isUniqueViolation(wrapped, ACTIVE_SLEEP_CONSTRAINT)).toBe(true)
  })

  it('其他约束或其他错误不算', () => {
    expect(
      isUniqueViolation({ code: '23505', constraint: 'other_key' }, ACTIVE_SLEEP_CONSTRAINT),
    ).toBe(false)
    expect(isUniqueViolation(new Error('boom'))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})
