import { describe, expect, it } from 'vitest'
import {
  fieldOfType,
  formatGoalPlan,
  formatTarget,
  formatWeekdays,
  minutesToSeconds,
  nextFieldKey,
  secondsToMinutes,
} from './format'

describe('分钟与秒', () => {
  it('互相换算', () => {
    expect(minutesToSeconds(30)).toBe(1800)
    expect(secondsToMinutes(28_800)).toBe(480)
  })

  it('不整的秒数四舍五入到分钟', () => {
    expect(secondsToMinutes(89)).toBe(1)
    expect(secondsToMinutes(90)).toBe(2)
  })
})

describe('目标文案', () => {
  it('时长按小时分钟显示，次数带单位', () => {
    expect(formatTarget({ kind: 'duration', value: 1800 })).toBe('30分钟')
    expect(formatTarget({ kind: 'duration', value: 28_800 })).toBe('8小时')
    expect(formatTarget({ kind: 'count', value: 3 })).toBe('3 次')
  })

  it('计划星期的常见写法', () => {
    expect(formatWeekdays([7, 6, 5, 4, 3, 2, 1])).toBe('每天')
    expect(formatWeekdays([1, 2, 3, 4, 5])).toBe('工作日')
    expect(formatWeekdays([6, 7])).toBe('周末')
    expect(formatWeekdays([5, 1, 3])).toBe('周一、三、五')
  })

  it('副标题省略空的计划时间', () => {
    expect(
      formatGoalPlan({
        target: { kind: 'count', value: 2 },
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        plannedTime: null,
      }),
    ).toBe('每天 · 2 次')
    expect(
      formatGoalPlan({
        target: { kind: 'duration', value: 1800 },
        weekdays: [6, 7],
        plannedTime: '07:30',
      }),
    ).toBe('周末 · 30分钟 · 07:30')
  })
})

describe('自定义字段', () => {
  it('新标识取最大序号 + 1，忽略不是 fN 形式的标识', () => {
    expect(nextFieldKey([])).toBe('f1')
    expect(nextFieldKey([{ key: 'done' }, { key: 'f2' }, { key: 'f7' }])).toBe('f8')
  })

  it('切换类型保留标识、名称和必填', () => {
    const base = { key: 'f1', label: '心情', required: true }
    expect(fieldOfType('single-select', base)).toEqual({
      ...base,
      type: 'single-select',
      options: ['选项一', '选项二'],
    })
    expect(fieldOfType('rating', base)).toEqual({ ...base, type: 'rating' })
  })
})
