import type { Module } from '../shared/schemas'
import type { CreateGoal } from './schemas'
import { ALL_WEEKDAYS } from '../shared/schemas'

/*
 * 各板块的默认目标（PRD 2.3 表）。引导选板块时（D1）与新建目标的预填（D2）共用。
 * 自定义板块的默认字段只有一个"完成了吗"布尔字段：每条记录计 1 次。
 */
export const DEFAULT_GOALS: Record<Module, CreateGoal> = {
  exercise: {
    module: 'exercise',
    title: '动一动',
    target: { kind: 'duration', value: 1800 },
    weekdays: [...ALL_WEEKDAYS],
  },
  diet: {
    module: 'diet',
    title: '好好吃饭',
    target: { kind: 'count', value: 3 },
    weekdays: [...ALL_WEEKDAYS],
  },
  sleep: {
    module: 'sleep',
    title: '早点睡',
    target: { kind: 'duration', value: 28_800 },
    weekdays: [...ALL_WEEKDAYS],
  },
  study: {
    module: 'study',
    title: '学一点',
    target: { kind: 'count', value: 2 },
    weekdays: [...ALL_WEEKDAYS],
  },
  custom: {
    module: 'custom',
    title: '我的小目标',
    target: { kind: 'count', value: 1 },
    weekdays: [...ALL_WEEKDAYS],
    fields: [{ key: 'done', label: '完成了吗', type: 'boolean', required: true }],
  },
}
