import { describe, expect, it } from 'vitest'
import { analysisPrompt, inputBrief } from './format'

/* 「让 Agent 分析」时存进对话历史的那句话 */

describe('analysisPrompt', () => {
  it('学习：主题 + 时长 + 要点数', () => {
    expect(
      analysisPrompt(
        '学一点',
        {
          module: 'study',
          what: '二叉树遍历',
          durationSeconds: 1800,
          points: ['前序根左右', '中序左根右'],
        },
        'Asia/Shanghai',
      ),
    ).toBe('帮我分析这条「学一点」打卡：二叉树遍历 · 30分钟 · 2 条要点')
  })

  it('饮食：餐次 + 菜名，带备注', () => {
    expect(
      analysisPrompt(
        '好好吃饭',
        {
          module: 'diet',
          method: 'manual',
          mealType: 'lunch',
          items: [{ name: '米饭' }, { name: '番茄炒蛋' }],
          note: '有点咸',
        } as never,
        'Asia/Shanghai',
      ),
    ).toBe('帮我分析这条「好好吃饭」打卡：午餐：米饭、番茄炒蛋（备注：有点咸）')
  })

  it('睡眠：按用户时区写入睡和起床时刻', () => {
    expect(
      inputBrief(
        {
          module: 'sleep',
          bedAt: '2026-11-04T15:00:00Z',
          wakeAt: '2026-11-04T23:00:00Z',
          quality: 4,
        },
        'Asia/Shanghai',
      ),
    ).toBe('23:00 入睡，07:00 起床，质量 4 分')
  })

  it('超长截断到 500 字', () => {
    const text = analysisPrompt(
      '学一点',
      { module: 'study', what: '长'.repeat(200), note: '注'.repeat(400) } as never,
      'Asia/Shanghai',
    )
    expect(text.length).toBe(500)
    expect(text.endsWith('…')).toBe(true)
  })
})
