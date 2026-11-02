import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  goalRow: null as {
    id: string
    module: 'exercise' | 'diet' | 'sleep' | 'study' | 'custom'
    title: string
    status: 'active' | 'archived'
    fieldVersion: number | null
  } | null,
  customFields: null as unknown[] | null,
  searchWeb: vi.fn(),
  fetchWeb: vi.fn(),
}))

vi.mock('@/server/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (mocks.goalRow ? [mocks.goalRow] : []),
        }),
      }),
    }),
  },
}))

vi.mock('@/server/services/checkins/goal', () => ({
  loadFields: async () => mocks.customFields,
}))

vi.mock('./web-search', () => ({
  searchWeb: (...args: unknown[]) => mocks.searchWeb(...args),
  fetchWeb: (...args: unknown[]) => mocks.fetchWeb(...args),
}))

const { buildSystemPrompt } = await import('./agent')
const { buildAgentTools, MAX_SEARCHES_PER_TURN, SEARCH_FETCH_COST_MICROS } =
  await import('./agent-tools')

const NOW = new Date('2026-11-02T06:30:00.000Z') // 北京时间 2026-11-02 14:30
const CLOCK = { timeZone: 'Asia/Shanghai', dayStartHour: 4 }

const toolExecCtx = {
  toolCallId: 'tc-1',
  messages: [],
  context: {} as never,
}

beforeEach(() => {
  mocks.goalRow = null
  mocks.customFields = null
  mocks.searchWeb.mockReset()
  mocks.fetchWeb.mockReset()
})

describe('buildSystemPrompt', () => {
  it('注入当前 UTC 时间、用户时区、日切换时间与今日/昨日/明日打卡日', () => {
    const prompt = buildSystemPrompt(NOW, CLOCK)
    expect(prompt).toContain('2026-11-02T06:30:00.000Z')
    expect(prompt).toContain('Asia/Shanghai')
    expect(prompt).toContain('04:00')
    expect(prompt).toContain('2026-11-02 14:30')
    expect(prompt).toContain(
      '今日打卡日（localDate）：2026-11-02（昨天：2026-11-01，明天：2026-11-03）',
    )
  })

  it('凌晨日切换时间前（如 02:30）归属到前一天打卡日', () => {
    const lateNight = new Date('2026-11-01T18:30:00.000Z') // 北京时间 11-02 02:30 (< 04:00)
    const prompt = buildSystemPrompt(lateNight, CLOCK)
    expect(prompt).toContain(
      '今日打卡日（localDate）：2026-11-01（昨天：2026-10-31，明天：2026-11-02）',
    )
  })
})

describe('buildAgentTools: 草稿与联网工具', () => {
  it('draftCheckin (sleep) 归一化为 UTC ISO 字符串并按用户时区格式化展示字段', async () => {
    mocks.goalRow = {
      id: 'g-sleep',
      module: 'sleep',
      title: '早睡早起',
      status: 'active',
      fieldVersion: null,
    }
    const tools = buildAgentTools({
      userId: 'u1',
      now: NOW,
      search: { used: 0, costMicros: 0 },
      clock: CLOCK,
    })

    // 模型传入带 +08:00 偏移的 ISO 时间
    const draft = await tools.draftCheckin.execute!(
      {
        goalId: 'g-sleep',
        confidence: 0.9,
        isMakeup: false,
        data: {
          module: 'sleep',
          bedAt: '2026-11-01T23:30:00+08:00',
          wakeAt: '2026-11-02T07:30:00+08:00',
          quality: 4,
        },
      },
      toolExecCtx,
    )

    expect(draft).toMatchObject({
      kind: 'checkin',
      goalId: 'g-sleep',
      module: 'sleep',
      summary: '睡眠约 8.0 小时',
      fields: [
        { label: '入睡', value: '11月1日 23:30' },
        { label: '起床', value: '11月2日 07:30' },
        { label: '质量', value: '4/5' },
      ],
      confirmBody: {
        module: 'sleep',
        bedAt: '2026-11-01T15:30:00.000Z',
        wakeAt: '2026-11-01T23:30:00.000Z',
        quality: 4,
        isMakeup: false,
      },
    })
  })

  it('draftCheckin (sleep) 起床时间在昨天打卡日时自动标记 isMakeup=true', async () => {
    mocks.goalRow = {
      id: 'g-sleep',
      module: 'sleep',
      title: '早睡早起',
      status: 'active',
      fieldVersion: null,
    }
    const tools = buildAgentTools({
      userId: 'u1',
      now: NOW,
      search: { used: 0, costMicros: 0 },
      clock: CLOCK,
    })

    const draft = await tools.draftCheckin.execute!(
      {
        goalId: 'g-sleep',
        confidence: 0.85,
        isMakeup: false,
        data: {
          module: 'sleep',
          bedAt: '2026-10-31T23:00:00+08:00',
          wakeAt: '2026-11-01T07:00:00+08:00',
          quality: 5,
        },
      },
      toolExecCtx,
    )

    expect(draft).toMatchObject({
      kind: 'checkin',
      confirmBody: {
        module: 'sleep',
        isMakeup: true,
      },
    })
  })

  it('draftCheckin (custom) 校验自定义目标字段并生成草稿', async () => {
    mocks.goalRow = {
      id: 'g-custom',
      module: 'custom',
      title: '每天喝水',
      status: 'active',
      fieldVersion: 2,
    }
    mocks.customFields = [
      { key: 'cups', label: '杯数', type: 'number', required: true, min: 1, max: 20, unit: '杯' },
    ]
    const tools = buildAgentTools({
      userId: 'u1',
      now: NOW,
      search: { used: 0, costMicros: 0 },
      clock: CLOCK,
    })

    const draft = await tools.draftCheckin.execute!(
      {
        goalId: 'g-custom',
        confidence: 0.95,
        isMakeup: false,
        data: {
          module: 'custom',
          values: { cups: 8 },
        },
      },
      toolExecCtx,
    )

    expect(draft).toMatchObject({
      kind: 'checkin',
      goalId: 'g-custom',
      module: 'custom',
      summary: '杯数：8 杯',
      fields: [{ label: '杯数', value: '8 杯' }],
      confirmBody: {
        module: 'custom',
        fieldVersion: 2,
        values: { cups: 8 },
        isMakeup: false,
      },
    })
  })

  it('draftTodo 归一化 dueAt 为 UTC ISO，draftWeight 默认开启 confirmLargeChange', async () => {
    const tools = buildAgentTools({
      userId: 'u1',
      now: NOW,
      search: { used: 0, costMicros: 0 },
      clock: CLOCK,
    })

    const todoDraft = await tools.draftTodo.execute!(
      {
        title: '交周报',
        dueAt: '2026-11-02T18:00:00+08:00',
        priority: 'important',
      },
      toolExecCtx,
    )
    expect(todoDraft).toEqual({
      kind: 'todo',
      title: '交周报',
      dueAt: '2026-11-02T10:00:00.000Z',
      priority: 'important',
      confirmBody: {
        title: '交周报',
        dueAt: '2026-11-02T10:00:00.000Z',
        priority: 'important',
      },
    })

    const weightDraft = await tools.draftWeight.execute!({ weightKg: 62.4 }, toolExecCtx)
    expect(weightDraft).toEqual({
      kind: 'weight',
      weightKg: 62.4,
      confirmBody: { weightGrams: 62400, confirmLargeChange: true },
    })
  })

  it('webSearch 累加联网次数与微元费用，超过 10 次返回上限提示', async () => {
    mocks.searchWeb.mockResolvedValue({
      ok: true,
      results: [{ title: '番茄炒蛋', url: 'https://example.com', snippet: '150 kcal' }],
    })
    const searchBudget = { used: MAX_SEARCHES_PER_TURN - 1, costMicros: 0 }
    const tools = buildAgentTools({
      userId: 'u1',
      now: NOW,
      search: searchBudget,
      clock: CLOCK,
    })

    const first = await tools.webSearch.execute!({ query: '番茄炒蛋热量', count: 3 }, toolExecCtx)
    expect(first).toEqual({
      results: [{ title: '番茄炒蛋', url: 'https://example.com', snippet: '150 kcal' }],
    })
    expect(searchBudget.used).toBe(MAX_SEARCHES_PER_TURN)
    expect(searchBudget.costMicros).toBe(SEARCH_FETCH_COST_MICROS)

    const overLimit = await tools.webSearch.execute!({ query: '米饭热量', count: 3 }, toolExecCtx)
    expect(overLimit).toEqual({
      error: `本轮联网搜索已达 ${MAX_SEARCHES_PER_TURN} 次上限，用已有信息回答`,
    })
  })
})
