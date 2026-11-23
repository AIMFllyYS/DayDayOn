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

vi.mock('./agent-checkin-tools', () => ({ buildCheckinTools: () => ({}) }))
vi.mock('@/server/services/agent/read', () => ({}))
vi.mock('@/server/services/agent/todo-read', () => ({
  getAgentTodoOverview: vi.fn(),
  listAgentTodos: vi.fn(),
  getAgentTodoDetail: vi.fn(),
  getAgentTodoTimeline: vi.fn(),
  lookupUserTodoGroupByName: vi.fn(async () => null),
}))

vi.mock('./web-search', () => ({
  searchWeb: (...args: unknown[]) => mocks.searchWeb(...args),
  fetchWeb: (...args: unknown[]) => mocks.fetchWeb(...args),
}))

const {
  buildAgent,
  buildSystemPrompt,
  DEEP_THINK_MAX_OUTPUT_TOKENS_PER_STEP,
  MAX_OUTPUT_TOKENS_PER_STEP,
  MAX_STEPS,
} = await import('./agent')
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

  it('未传 clock 时兜底与 profiles 一致的 04:00 换日，传入 dayStartHour=0 时按零点换日', () => {
    const lateNight = new Date('2026-11-01T18:30:00.000Z') // 北京时间 11-02 02:30
    const fallbackPrompt = buildSystemPrompt(lateNight)
    expect(fallbackPrompt).toContain('每日凌晨 04:00 切换新打卡日')
    expect(fallbackPrompt).toContain('今日打卡日（localDate）：2026-11-01')

    const midnightPrompt = buildSystemPrompt(lateNight, {
      timeZone: 'Asia/Shanghai',
      dayStartHour: 0,
    })
    expect(midnightPrompt).toContain('每日凌晨 00:00 切换新打卡日')
    expect(midnightPrompt).toContain('今日打卡日（localDate）：2026-11-02')
  })
})

describe('buildAgentTools: 待办 / 体重草稿与联网工具（打卡工具见 agent-checkin-tools.test.ts）', () => {
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
        priority: 'urgent-important',
        tags: [],
      },
      toolExecCtx,
    )
    expect(todoDraft).toEqual({
      kind: 'todo',
      title: '交周报',
      note: null,
      dueAt: '2026-11-02T10:00:00.000Z',
      priority: 'urgent-important',
      groupName: '默认待办',
      isNewGroup: false,
      tags: [],
      confirmBody: {
        title: '交周报',
        note: null,
        dueAt: '2026-11-02T10:00:00.000Z',
        priority: 'urgent-important',
        tags: [],
      },
    })

    const weightDraft = await tools.draftWeight.execute!({ weightKg: 62.4 }, toolExecCtx)
    expect(weightDraft).toEqual({
      kind: 'weight',
      weightKg: 62.4,
      confirmBody: { weightGrams: 62400, confirmLargeChange: true },
    })
  })

  it('webSearch 累加联网次数与微元费用，超过上限返回上限提示', async () => {
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

describe('buildAgent: 输出上限、工具步数与思考模式配置', () => {
  it('默认关闭思考模式（4096 tokens/步）；开启深度思考保持 low 强度并放宽至 8192 tokens/步', async () => {
    const { MockLanguageModelV4 } = await import('ai/test')
    const makeModel = () =>
      new MockLanguageModelV4({
        doGenerate: async () => ({
          content: [{ type: 'text', text: '好的' }],
          finishReason: { unified: 'stop', raw: undefined },
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: undefined },
            outputTokens: { total: 5, text: 5, reasoning: undefined },
          },
          warnings: [],
        }),
      })

    expect(MAX_STEPS).toBeGreaterThanOrEqual(30)
    expect(MAX_OUTPUT_TOKENS_PER_STEP).toBeGreaterThanOrEqual(4096)
    expect(DEEP_THINK_MAX_OUTPUT_TOKENS_PER_STEP).toBeGreaterThanOrEqual(8192)

    const normalModel = makeModel()
    const normalAgent = buildAgent({
      model: normalModel,
      userId: 'u1',
      userIdHash: 'a'.repeat(64),
      deepThink: false,
      search: { used: 0, costMicros: 0 },
      now: NOW,
      clock: CLOCK,
    })
    await normalAgent.generate({ messages: [{ role: 'user', content: '你好' }] })
    expect(normalModel.doGenerateCalls[0]?.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS_PER_STEP)
    expect(normalModel.doGenerateCalls[0]?.providerOptions?.deepseek).toEqual({
      userId: 'a'.repeat(64),
      thinking: { type: 'disabled' },
    })

    const deepModel = makeModel()
    const deepAgent = buildAgent({
      model: deepModel,
      userId: 'u1',
      userIdHash: 'a'.repeat(64),
      deepThink: true,
      search: { used: 0, costMicros: 0 },
      now: NOW,
      clock: CLOCK,
    })
    await deepAgent.generate({ messages: [{ role: 'user', content: '你好' }] })
    expect(deepModel.doGenerateCalls[0]?.maxOutputTokens).toBe(
      DEEP_THINK_MAX_OUTPUT_TOKENS_PER_STEP,
    )
    expect(deepModel.doGenerateCalls[0]?.providerOptions?.deepseek).toEqual({
      userId: 'a'.repeat(64),
      thinking: { type: 'enabled' },
      reasoningEffort: 'low',
    })
  })
})
