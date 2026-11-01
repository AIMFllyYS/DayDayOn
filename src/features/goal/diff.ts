import type { CreateGoal, Goal, UpdateGoal } from './schemas'

/*
 * 编辑抽屉提交前的对比：只把变了的字段放进 PATCH（服务端对 target / fields 也会再判断一次）。
 */

type Comparable = Pick<
  Goal,
  'title' | 'description' | 'target' | 'weekdays' | 'plannedTime' | 'fields'
>

function sortedDays(days: readonly number[]): string {
  return [...new Set(days)].sort((a, b) => a - b).join(',')
}

export function diffGoal(goal: Comparable, values: CreateGoal): UpdateGoal {
  const patch: UpdateGoal = {}
  if (values.title !== goal.title) patch.title = values.title
  const description = values.description ?? null
  if (description !== goal.description) patch.description = description
  if (values.target.kind !== goal.target.kind || values.target.value !== goal.target.value) {
    patch.target = values.target
  }
  if (sortedDays(values.weekdays) !== sortedDays(goal.weekdays)) patch.weekdays = values.weekdays
  const plannedTime = values.plannedTime ?? null
  if (plannedTime !== goal.plannedTime) patch.plannedTime = plannedTime
  if (values.fields && JSON.stringify(values.fields) !== JSON.stringify(goal.fields)) {
    patch.fields = values.fields
  }
  return patch
}
