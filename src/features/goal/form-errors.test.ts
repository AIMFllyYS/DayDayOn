import { describe, expect, it } from 'vitest'
import { clearChangedErrors, goalFormErrors, serverFormErrors } from './form-errors'
import { CreateGoalSchema } from './schemas'

describe('目标表单错误', () => {
  it('第一层字段按键分组', () => {
    const r = CreateGoalSchema.safeParse({
      module: 'study',
      title: '',
      target: { kind: 'count', value: 0 },
      weekdays: [],
    })
    expect(r.success).toBe(false)
    if (r.success) return
    const e = goalFormErrors(r.error)
    expect(e.top.title).toEqual(['给目标起个名字吧'])
    expect(e.top.target).toEqual(['目标量至少为 1'])
    expect(e.top.weekdays).toEqual(['至少选一天'])
    expect(e.fieldsByIndex).toBeUndefined()
  })

  it('自定义字段的错误落到对应下标', () => {
    const r = CreateGoalSchema.safeParse({
      module: 'custom',
      title: '喝水',
      target: { kind: 'count', value: 1 },
      fields: [
        { key: 'f1', label: '杯数', type: 'number' },
        { key: 'f2', label: '', type: 'boolean' },
      ],
    })
    expect(r.success).toBe(false)
    if (r.success) return
    const e = goalFormErrors(r.error)
    expect(e.fieldsByIndex).toEqual({ 1: ['请填写字段名'] })
    expect(e.top).toEqual({})
  })

  it('字段标识重复是整体错误', () => {
    const r = CreateGoalSchema.safeParse({
      module: 'custom',
      title: '喝水',
      target: { kind: 'count', value: 1 },
      fields: [
        { key: 'f1', label: 'a', type: 'boolean' },
        { key: 'f1', label: 'b', type: 'boolean' },
      ],
    })
    if (r.success) throw new Error('应当失败')
    expect(goalFormErrors(r.error).fieldsForm).toEqual(['字段标识不能重复'])
  })

  it('改过的字段清掉错误，没改的保留', () => {
    const errors = { f1: ['杯数要填数字'], f2: ['请填写感受'] }
    expect(clearChangedErrors(errors, {}, { f1: 6 })).toEqual({ f2: ['请填写感受'] })
  })

  it('全部改过或本来没有错误时返回 undefined', () => {
    expect(clearChangedErrors({ f1: ['杯数要填数字'] }, {}, { f1: 6 })).toBeUndefined()
    expect(clearChangedErrors(undefined, {}, { f1: 6 })).toBeUndefined()
    expect(clearChangedErrors({ f1: [] }, {}, {})).toBeUndefined()
  })

  it('服务端的 fields 错误拆出自定义字段部分', () => {
    expect(serverFormErrors({ title: ['太长'], fields: ['只有自定义目标需要字段定义'] })).toEqual({
      top: { title: ['太长'] },
      fieldsForm: ['只有自定义目标需要字段定义'],
    })
  })
})
