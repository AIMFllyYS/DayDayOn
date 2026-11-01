import { describe, expect, it } from 'vitest'
import { diffGoal } from './diff'
import type { CreateGoal } from './schemas'

const goal = {
  title: '动一动',
  description: null,
  target: { kind: 'duration' as const, value: 1800 },
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  plannedTime: null,
  fields: null,
}

const same: CreateGoal = {
  module: 'exercise',
  title: goal.title,
  description: null,
  target: goal.target,
  weekdays: [7, 6, 5, 4, 3, 2, 1],
  plannedTime: null,
}

describe('编辑目标只提交改了的部分', () => {
  it('什么都没改：空对象（星期顺序不同不算改）', () => {
    expect(diffGoal(goal, same)).toEqual({})
  })

  it('改了目标量和计划时间', () => {
    expect(
      diffGoal(goal, { ...same, target: { kind: 'duration', value: 2400 }, plannedTime: '07:00' }),
    ).toEqual({ target: { kind: 'duration', value: 2400 }, plannedTime: '07:00' })
  })

  it('清空说明提交 null', () => {
    expect(diffGoal({ ...goal, description: '慢慢来' }, same)).toEqual({ description: null })
  })

  it('自定义字段变了才提交 fields', () => {
    const fields = [{ key: 'f1', label: '心情', type: 'rating' as const, required: false }]
    const custom = { ...goal, fields }
    expect(diffGoal(custom, { ...same, module: 'custom', fields })).toEqual({})
    const changed = [{ ...fields[0]!, label: '几分' }]
    expect(diffGoal(custom, { ...same, module: 'custom', fields: changed })).toEqual({
      fields: changed,
    })
  })
})
