import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '../defaults'
import { judgeCustom, type CustomSubject } from './custom'
import { judgeStudy } from './study'

const studyCtx = { rules: DEFAULT_RULES.study, tier: 'balanced-glycemic' as const, facts: null }

describe('学习双核验', () => {
  it('A 二叉树 45 分钟 + 3 条要点：有效', () => {
    const v = judgeStudy(
      {
        topic: '二叉树遍历',
        minutes: 45,
        points: ['BFS 用队列，时间复杂度 O(V+E)', 'DFS 用栈或递归', '层序遍历按层入队'],
      },
      studyCtx,
    )
    expect(v.isValid).toBe(true)
  })

  it('B 背单词 5 分钟：未满番茄钟', () => {
    const v = judgeStudy({ topic: '背单词', minutes: 5, points: [] }, studyCtx)
    expect(v.isValid).toBe(false)
    expect(v.detail).toContain('碎片学习')
  })

  it('C 时长够、内容空：仅存档', () => {
    const v = judgeStudy({ topic: '数学错题', minutes: 30, points: ['看了'] }, studyCtx)
    expect(v.isValid).toBe(false)
  })

  it('碎片累加：今天之前 20 分钟 + 这次 10 分钟 = 达标', () => {
    const v = judgeStudy(
      { topic: '英语', minutes: 10, points: ['虚拟语气 if 从句用过去完成时'] },
      {
        ...studyCtx,
        facts: {
          module: 'study',
          substantive: true,
          subject: '英语',
          summary: '',
          keyPoints: [],
          todayMinutesBefore: 20,
        },
      },
    )
    expect(v.isValid).toBe(true)
    expect(v.metrics.totalMinutes).toBe(30)
  })

  it('Agent 判定内容不实质时不通过', () => {
    const v = judgeStudy(
      { topic: '阅读', minutes: 40, points: ['啊啊啊啊啊啊啊啊啊啊啊啊'] },
      {
        ...studyCtx,
        facts: {
          module: 'study',
          substantive: false,
          subject: '阅读',
          summary: '',
          keyPoints: [],
          todayMinutesBefore: 0,
        },
      },
    )
    expect(v.isValid).toBe(false)
  })
})

const water: CustomSubject = {
  fields: [
    { key: 'water', label: '温水', type: 'number', unit: '杯' },
    { key: 'sugar', label: '含糖饮料', type: 'number', unit: '杯' },
    { key: 'bed', label: '入睡时间', type: 'time' },
  ],
  values: { water: 7, sugar: 0, bed: '23:10' },
}
const customRules = {
  module: 'custom' as const,
  conditions: [
    { key: 'water', op: 'gte' as const, value: 6 },
    { key: 'sugar', op: 'eq' as const, value: 0 },
    { key: 'bed', op: 'lte' as const, value: '23:30' },
  ],
}
const customCtx = { rules: customRules, tier: 'balanced-glycemic' as const, facts: null }

describe('自定义条件', () => {
  it('全部满足：有效', () => {
    expect(judgeCustom(water, customCtx).isValid).toBe(true)
  })

  it('踩红线（喝了 1 杯奶茶）：诚实存档', () => {
    const v = judgeCustom({ ...water, values: { ...water.values, sugar: 1 } }, customCtx)
    expect(v.isValid).toBe(false)
    expect(v.detail).toContain('含糖饮料')
  })

  it('没有条件时填了就算', () => {
    const v = judgeCustom(water, { ...customCtx, rules: { module: 'custom', conditions: [] } })
    expect(v.isValid).toBe(true)
  })

  it('Agent 判卷不通过时未达标', () => {
    const v = judgeCustom(water, {
      ...customCtx,
      rules: { ...customRules, aiCriteria: '写清喝水时间' },
      facts: { module: 'custom', aiPass: false, aiComment: '没写时间' },
    })
    expect(v.isValid).toBe(false)
  })
})
