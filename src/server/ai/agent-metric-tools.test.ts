import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMetricsOverview: vi.fn(),
  getMetricValueOnDate: vi.fn(),
}))

vi.mock('@/server/services/agent/read', () => mocks)

import { buildMetricTools, formatMetricValue } from './agent-metric-tools'

const NOW = new Date('2026-11-05T06:00:00.000Z') // 北京时间 14:00，打卡日 2026-11-05，昨天 2026-11-04
const CLOCK = { timeZone: 'Asia/Shanghai', dayStartHour: 4 }
const execCtx = { toolCallId: 'tc-1', messages: [], context: {} as never }

describe('agent-metric-tools: 体重 / 心情 / 步数读写与今日昨日 CRUD 草稿', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('formatMetricValue 统一格式化克、评分与步数', () => {
    expect(formatMetricValue('weight', 62_400)).toBe('62.4 kg')
    expect(formatMetricValue('mood', 4)).toBe('4 分 · 不错')
    expect(formatMetricValue('steps', 10_520)).toBe('10,520 步')
  })

  it('getMetrics 透传指标种类与窗口天数', async () => {
    mocks.getMetricsOverview.mockResolvedValue({
      today: '2026-11-05',
      yesterday: '2026-11-04',
      editableDates: ['2026-11-04', '2026-11-05'],
      dailyStepTarget: 8000,
    })
    const tools = buildMetricTools({ userId: 'u1', now: NOW, clock: CLOCK })
    const res = await tools.getMetrics.execute!({ kind: 'steps', days: 90 }, execCtx)
    expect(mocks.getMetricsOverview).toHaveBeenCalledWith('u1', NOW, 'steps', 90)
    expect(res).toMatchObject({ dailyStepTarget: 8000, today: '2026-11-05' })
  })

  it('draftMetric 今日新建体重时返回 create 草稿且携带 localDate 与 confirmLargeChange', async () => {
    mocks.getMetricValueOnDate.mockResolvedValue(null)
    const tools = buildMetricTools({ userId: 'u1', now: NOW, clock: CLOCK })
    const draft = await tools.draftMetric.execute!(
      { metric: 'weight', targetDay: 'today', weightKg: 62.4 },
      execCtx,
    )
    expect(draft).toEqual({
      kind: 'metric-upsert',
      metric: 'weight',
      action: 'create',
      targetDay: 'today',
      localDate: '2026-11-05',
      beforeLabel: null,
      afterLabel: '62.4 kg',
      confirmBody: {
        weightGrams: 62_400,
        confirmLargeChange: true,
        localDate: '2026-11-05',
      },
    })
  })

  it('draftMetric 昨日已有步数记录时返回 update 覆盖草稿并附改前改后对比', async () => {
    mocks.getMetricValueOnDate.mockResolvedValue(6500)
    const tools = buildMetricTools({ userId: 'u1', now: NOW, clock: CLOCK })
    const draft = await tools.draftMetric.execute!(
      {
        metric: 'steps',
        targetDay: 'yesterday',
        steps: 9800,
        reason: '手环刚同步完昨晚散步',
      },
      execCtx,
    )
    expect(mocks.getMetricValueOnDate).toHaveBeenCalledWith('u1', 'steps', '2026-11-04')
    expect(draft).toEqual({
      kind: 'metric-upsert',
      metric: 'steps',
      action: 'update',
      targetDay: 'yesterday',
      localDate: '2026-11-04',
      beforeLabel: '6,500 步',
      afterLabel: '9,800 步',
      reason: '手环刚同步完昨晚散步',
      confirmBody: {
        steps: 9800,
        localDate: '2026-11-04',
      },
    })
  })

  it('draftMetric 缺对应数值字段时返回友好错误提示而非抛出异常', async () => {
    const tools = buildMetricTools({ userId: 'u1', now: NOW, clock: CLOCK })
    const res = await tools.draftMetric.execute!({ metric: 'mood', targetDay: 'today' }, execCtx)
    expect(res).toEqual({ error: '记录心情需要传入 moodValue（1–5 整数）' })
  })

  it('draftDeleteMetric 先查库：存在返回 metric-delete 草稿，不存在返回提示', async () => {
    const tools = buildMetricTools({ userId: 'u1', now: NOW, clock: CLOCK })

    mocks.getMetricValueOnDate.mockResolvedValueOnce(null)
    const missing = await tools.draftDeleteMetric.execute!(
      { metric: 'mood', targetDay: 'yesterday', reason: '误记' },
      execCtx,
    )
    expect(missing).toEqual({ error: '昨天（2026-11-04）还没有心情记录，无需删除' })

    mocks.getMetricValueOnDate.mockResolvedValueOnce(2)
    const ok = await tools.draftDeleteMetric.execute!(
      { metric: 'mood', targetDay: 'yesterday', reason: '点错日子了' },
      execCtx,
    )
    expect(ok).toEqual({
      kind: 'metric-delete',
      metric: 'mood',
      targetDay: 'yesterday',
      localDate: '2026-11-04',
      beforeLabel: '2 分 · 不太好',
      reason: '点错日子了',
    })
  })
})
