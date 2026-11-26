import { describe, expect, it } from 'vitest'
import type { Goal } from '@/features/goal/schemas'
import {
  computeModuleSelectionDiff,
  modulesDockSummary,
  periodDockSummary,
} from './goal-settings-logic'

function mkGoal(over: Partial<Goal> & { id: string; module: Goal['module'] }): Goal {
  return {
    title: over.module,
    description: null,
    target: { kind: 'count', value: 1 },
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    plannedTime: null,
    status: 'active',
    sortOrder: 0,
    fields: null,
    fieldVersion: null,
    refereeRules: null,
    deadlineDate: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...over,
  }
}

describe('computeModuleSelectionDiff', () => {
  it('未变更勾选时 hasChanges 为 false', () => {
    const active = [
      mkGoal({ id: 'g1', module: 'exercise', deadlineDate: '2026-12-01' }),
      mkGoal({ id: 'g2', module: 'diet', deadlineDate: '2026-12-01' }),
    ]
    const diff = computeModuleSelectionDiff(active, [], ['exercise', 'diet'])
    expect(diff.hasChanges).toBe(false)
    expect(diff.toArchive).toEqual([])
    expect(diff.toRestore).toEqual([])
    expect(diff.toCreate).toEqual([])
    expect(diff.sharedDeadline).toBe('2026-12-01')
  })

  it('取消勾选自定义板块时归档全部同板块目标，新增勾选优先恢复最近更新的归档记录，无归档则新建', () => {
    const active = [
      mkGoal({ id: 'g-ex', module: 'exercise', deadlineDate: '2026-12-10' }),
      mkGoal({ id: 'g-c1', module: 'custom', title: '多喝水' }),
      mkGoal({ id: 'g-c2', module: 'custom', title: '练琴' }),
    ]
    const archived = [
      mkGoal({
        id: 'g-sl-old',
        module: 'sleep',
        status: 'archived',
        updatedAt: '2026-11-02T00:00:00.000Z',
      }),
      mkGoal({
        id: 'g-sl-new',
        module: 'sleep',
        status: 'archived',
        updatedAt: '2026-11-08T00:00:00.000Z',
      }),
    ]

    const diff = computeModuleSelectionDiff(active, archived, ['exercise', 'sleep', 'study'])
    expect(diff.hasChanges).toBe(true)
    expect(diff.toArchive.map((g) => g.id)).toEqual(['g-c1', 'g-c2'])
    expect(diff.toRestore.map((g) => g.id)).toEqual(['g-sl-new'])
    expect(diff.toCreate).toEqual(['study'])
    expect(diff.sharedDeadline).toBe('2026-12-10')
  })
})

describe('设置 Dock 摘要文案', () => {
  it('periodDockSummary 与 modulesDockSummary 按当前状态格式化', () => {
    expect(
      periodDockSummary({
        hasDeadline: true,
        targetDays: 30,
        remindMode: 'in-app',
        remindAt: '21:00',
      }),
    ).toBe('共 30 天 · 21:00')
    expect(
      periodDockSummary({
        hasDeadline: false,
        targetDays: 7,
        remindMode: 'off',
        remindAt: '21:00',
      }),
    ).toBe('里程碑 7 天 · 未开提醒')
    expect(
      modulesDockSummary([
        mkGoal({ id: '1', module: 'exercise' }),
        mkGoal({ id: '2', module: 'custom' }),
        mkGoal({ id: '3', module: 'custom' }),
      ]),
    ).toBe('已选 2 / 5 项')
  })
})
