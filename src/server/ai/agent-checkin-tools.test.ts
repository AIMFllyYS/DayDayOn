import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/api/errors'

/*
 * 对话 Agent 的打卡工具：只测编排（入参换算、补卡判断、事实对位、错误转成给模型看的话），
 * 预览、校验、裁判本身由 services/checkins 负责，这里 mock 掉，不连数据库。
 */

const GOAL_SLEEP = '0193f6b2-0000-7000-8000-00000000a001'
const GOAL_DIET = '0193f6b2-0000-7000-8000-00000000a002'
const CHECKIN = '0193f6b2-0000-7000-8000-00000000c001'

const mocks = vi.hoisted(() => ({
  previewCreate: vi.fn(),
  previewUpdate: vi.fn(),
  previewDelete: vi.fn(),
  getCheckinDetail: vi.fn(),
  goal: { id: '', module: 'sleep', title: '早点睡', status: 'active', fieldVersion: null } as {
    id: string
    module: string
    title: string
    status: string
    fieldVersion: number | null
  },
}))

vi.mock('@/server/db/client', () => ({ db: {} }))
vi.mock('@/server/services/checkins/clock', () => ({
  loadClock: async () => ({ timeZone: 'Asia/Shanghai', dayStartHour: 4 }),
}))
vi.mock('@/server/services/checkins/goal', () => ({ loadGoal: async () => mocks.goal }))
vi.mock('@/server/services/checkins/preview', () => ({
  previewCreate: (...a: unknown[]) => mocks.previewCreate(...a),
  previewUpdate: (...a: unknown[]) => mocks.previewUpdate(...a),
  previewDelete: (...a: unknown[]) => mocks.previewDelete(...a),
}))
vi.mock('@/server/services/agent/read', () => ({
  getCheckinDetail: (...a: unknown[]) => mocks.getCheckinDetail(...a),
  getCheckinHistory: async () => ({ revisions: [] }),
}))
vi.mock('@/server/services/metrics/weight', () => ({ latestWeightGrams: async () => 60_000 }))
vi.mock('@/server/services/referee/read', () => ({
  recentSleep: async () => ({ nights: [], regularityMinutes: null }),
  todayStudyMinutes: async () => 0,
}))

const { buildCheckinTools } = await import('./agent-checkin-tools')

const NOW = new Date('2026-11-05T06:30:00.000Z') // 北京时间 11-05 14:30，打卡日 11-05
const ctx = { toolCallId: 't', messages: [], context: {} as never }

const verdict = {
  version: 1 as const,
  isValid: true,
  score: null,
  scoreMax: null,
  detail: '睡够了',
  checks: [{ id: 'c', text: '7–9.5 小时', ok: true }],
  metrics: {},
  facts: null,
  citations: [],
  advice: [],
  refereeRunId: null,
  offline: true,
}

function sleepCheckin(localDate: string) {
  return {
    id: CHECKIN,
    goalId: GOAL_SLEEP,
    module: 'sleep',
    localDate,
    occurredAt: '2026-11-04T23:00:00.000Z',
    source: 'manual',
    isMakeup: false,
    durationSeconds: 28_800,
    count: 1,
    intakeKcal: null,
    burnKcal: null,
    note: null,
    parsedText: null,
    payload: {
      module: 'sleep',
      bedAt: '2026-11-04T15:00:00.000Z',
      wakeAt: '2026-11-04T23:00:00.000Z',
      quality: 4,
    },
    fieldVersion: null,
    aiRunId: null,
    score: null,
    isValid: true,
    verdict,
    createdAt: '2026-11-04T23:00:00.000Z',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.goal = {
    id: GOAL_SLEEP,
    module: 'sleep',
    title: '早点睡',
    status: 'active',
    fieldVersion: null,
  }
  mocks.previewCreate.mockImplementation(async (_db, _u, goalId: string) => ({
    goal: { ...mocks.goal, id: goalId },
    input: {},
    checkin: sleepCheckin('2026-11-05'),
    verdict,
    fields: null,
  }))
})

describe('draftCheckin', () => {
  it('起床落在昨天打卡日：自动按补昨天处理，请求体带 origin=agent，草稿带结论预览', async () => {
    const tools = buildCheckinTools({ userId: 'u1', now: NOW })
    const draft = await tools.draftCheckin.execute!(
      {
        goalId: GOAL_SLEEP,
        entry: {
          module: 'sleep',
          bedAt: '2026-11-03T23:00:00+08:00',
          wakeAt: '2026-11-04T07:00:00+08:00',
          quality: 4,
        },
        isMakeup: false,
        confidence: 0.9,
      },
      ctx,
    )
    const raw = mocks.previewCreate.mock.calls[0]![3]
    expect(raw).toMatchObject({ module: 'sleep', isMakeup: true, origin: 'agent' })
    expect(draft).toMatchObject({
      kind: 'checkin',
      goalId: GOAL_SLEEP,
      verdict: { isValid: true, detail: '睡够了', offline: true },
      confirmBody: { module: 'sleep', isMakeup: true, origin: 'agent' },
    })
  })

  it('事实和内容对不上：不调预览，直接让模型重填', async () => {
    mocks.goal = {
      id: GOAL_DIET,
      module: 'diet',
      title: '好好吃饭',
      status: 'active',
      fieldVersion: null,
    }
    const tools = buildCheckinTools({ userId: 'u1', now: NOW })
    await expect(
      tools.draftCheckin.execute!(
        {
          goalId: GOAL_DIET,
          entry: {
            module: 'diet',
            mealType: 'lunch',
            method: 'manual',
            items: [{ name: '米饭', portion: '一碗', kcal: 230 }],
          },
          facts: { module: 'sleep', regularityMinutes: null, recentNights: 0 },
          isMakeup: false,
          confidence: 0.8,
        },
        ctx,
      ),
    ).rejects.toThrow('事实和内容对不上')
    expect(mocks.previewCreate).not.toHaveBeenCalled()
  })

  it('业务错误带着字段原因转给模型', async () => {
    mocks.previewCreate.mockRejectedValueOnce(
      new ApiError('VALIDATION_FAILED', '自定义字段校验失败', { fields: { cups: ['至少 1 杯'] } }),
    )
    const tools = buildCheckinTools({ userId: 'u1', now: NOW })
    await expect(
      tools.draftCheckin.execute!(
        {
          goalId: GOAL_SLEEP,
          entry: { module: 'study', what: '英语' },
          isMakeup: false,
          confidence: 0.8,
        },
        ctx,
      ),
    ).rejects.toThrow('自定义字段校验失败\ncups: 至少 1 杯')
  })
})

describe('draftUpdateCheckin / draftDeleteCheckin', () => {
  it('既没有 entry 也没有 note：报错', async () => {
    const tools = buildCheckinTools({ userId: 'u1', now: NOW })
    await expect(
      tools.draftUpdateCheckin.execute!({ checkinId: CHECKIN, reason: '记错了' }, ctx),
    ).rejects.toThrow('没有要改的内容')
  })

  it('超出可改范围：CHECKIN_LOCKED 的说明原样告诉模型', async () => {
    mocks.previewDelete.mockRejectedValueOnce(
      new ApiError('CHECKIN_LOCKED', '只能改、删今天和昨天的打卡'),
    )
    const tools = buildCheckinTools({ userId: 'u1', now: NOW })
    await expect(
      tools.draftDeleteCheckin.execute!({ checkinId: CHECKIN, reason: '不想要了' }, ctx),
    ).rejects.toThrow('只能改、删今天和昨天的打卡')
  })

  it('改备注：确认请求体只带 note、origin=agent 和原因', async () => {
    const current = sleepCheckin('2026-11-05')
    mocks.getCheckinDetail.mockResolvedValueOnce({ found: true, goalId: GOAL_SLEEP })
    mocks.previewUpdate.mockResolvedValueOnce({
      goal: mocks.goal,
      current,
      next: { ...current, note: '午睡补了一会' },
      verdict: null,
      fields: null,
    })
    const tools = buildCheckinTools({ userId: 'u1', now: NOW })
    const draft = await tools.draftUpdateCheckin.execute!(
      { checkinId: CHECKIN, note: '午睡补了一会', reason: '补个备注' },
      ctx,
    )
    expect(draft).toMatchObject({
      kind: 'checkin-update',
      checkinId: CHECKIN,
      reason: '补个备注',
      before: { note: null },
      after: { note: '午睡补了一会' },
      confirmBody: { note: '午睡补了一会', origin: 'agent', reason: '补个备注' },
    })
    expect(draft).not.toHaveProperty('confirmBody.replace')
  })

  it('删除草稿带改前快照和日期', async () => {
    mocks.previewDelete.mockResolvedValueOnce({
      goal: mocks.goal,
      current: sleepCheckin('2026-11-04'),
      fields: null,
    })
    const tools = buildCheckinTools({ userId: 'u1', now: NOW })
    const draft = await tools.draftDeleteCheckin.execute!(
      { checkinId: CHECKIN, reason: '重复记了' },
      ctx,
    )
    expect(draft).toMatchObject({
      kind: 'checkin-delete',
      localDate: '2026-11-04',
      reason: '重复记了',
      before: { summary: '睡了 8小时 · 质量 4 分', isValid: true },
    })
  })
})
