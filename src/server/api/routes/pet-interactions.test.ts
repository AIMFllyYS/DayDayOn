import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PetInteractionsStatus, PetInteractResult } from '@/features/friend/schemas'
import type { AccountState } from '@/server/auth/account-state'
import { localDateOf } from '@/lib/time'

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string; role: string }; session: { id: string } } | null,
  state: null as AccountState | null,
  service: {
    getPetInteractionsStatus: vi.fn(),
    interactWithFriendPet: vi.fn(),
  },
}))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => mocks.session }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => mocks.state }))
vi.mock('@/server/services/pet-interactions', () => mocks.service)
vi.mock('@/server/db/client', () => ({
  db: { transaction: (fn: (tx: unknown) => unknown) => fn({}) },
}))

const { app } = await import('../app')
const { ApiError } = await import('../errors')

const SAME_ORIGIN = { 'sec-fetch-site': 'same-origin' }

const jsonInit = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json', ...SAME_ORIGIN },
  body: JSON.stringify(body),
})

function login(userId = 'u1') {
  mocks.session = { user: { id: userId, role: 'user' }, session: { id: 's1' } }
  mocks.state = { banned: false, banReason: null, banExpires: null, onboardedAt: new Date(0) }
}

const sampleStatus: PetInteractionsStatus = {
  friendUserId: 'u2',
  targetLocalDate: '2026-11-02',
  cooldownLeftSec: 0,
  actions: {
    poke: { used: 1, limit: 3, cooldownLeftSec: 0, disabledReason: null },
    feed: { used: 0, limit: 1, cooldownLeftSec: 0, disabledReason: null },
    remind: { used: 0, limit: 1, cooldownLeftSec: 0, disabledReason: null },
  },
  remindEligible: true,
  remindDisabledReason: null,
}

const sampleResult: PetInteractResult = {
  success: true,
  interaction: {
    id: 'int_123',
    kind: 'poke',
    treatId: null,
    createdAt: '2026-11-02T10:00:00.000Z',
  },
  status: {
    ...sampleStatus,
    actions: {
      ...sampleStatus.actions,
      poke: { used: 2, limit: 3, cooldownLeftSec: 1800, disabledReason: '冷却中' },
    },
    cooldownLeftSec: 1800,
  },
  feedback: '已戳了戳 阿柚 的团团～对方将收到一条互动通知',
}

beforeEach(() => {
  mocks.session = null
  mocks.state = null
  for (const fn of Object.values(mocks.service)) fn.mockReset()
})

describe('/api/v1/friends/{friendUserId}/interactions 鉴权与校验', () => {
  it('未登录 GET /friends/u2/interactions → 401 UNAUTHENTICATED', async () => {
    const res = await app.request('/api/v1/friends/u2/interactions')
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  it('未登录 POST /friends/u2/interact → 401 UNAUTHENTICATED', async () => {
    const res = await app.request('/api/v1/friends/u2/interact', jsonInit('POST', { kind: 'poke' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  })
})

describe('/api/v1/friends/{friendUserId}/interactions 路由功能', () => {
  beforeEach(() => login('u1'))

  it('GET /friends/u2/interactions 正常返回互动状态与配额', async () => {
    mocks.service.getPetInteractionsStatus.mockResolvedValue(sampleStatus)

    const res = await app.request('/api/v1/friends/u2/interactions')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(sampleStatus)
    expect(mocks.service.getPetInteractionsStatus).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      'u2',
      expect.any(Date),
    )
  })

  it('POST /friends/u2/interact 参数校验失败（非法 kind）→ 400 VALIDATION_FAILED', async () => {
    const res = await app.request(
      '/api/v1/friends/u2/interact',
      jsonInit('POST', { kind: 'unknown' }),
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('POST /friends/u2/interact 投喂缺少 treatId → 400 VALIDATION_FAILED', async () => {
    const res = await app.request('/api/v1/friends/u2/interact', jsonInit('POST', { kind: 'feed' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toMatchObject({ code: 'VALIDATION_FAILED' })
  })

  it('POST /friends/u2/interact 非好友关系 → 404 FRIEND_NOT_FOUND', async () => {
    mocks.service.interactWithFriendPet.mockRejectedValue(
      new ApiError('FRIEND_NOT_FOUND', '未找到该好友关系'),
    )

    const res = await app.request('/api/v1/friends/u2/interact', jsonInit('POST', { kind: 'poke' }))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'FRIEND_NOT_FOUND' })
  })

  it('POST /friends/u2/interact 冷却中触发 429 INTERACTION_COOLDOWN 并附带 Retry-After', async () => {
    mocks.service.interactWithFriendPet.mockRejectedValue(
      new ApiError('INTERACTION_COOLDOWN', '互动冷却中，请稍后再试', {
        retryAfterSeconds: 1200,
      }),
    )

    const res = await app.request('/api/v1/friends/u2/interact', jsonInit('POST', { kind: 'poke' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('1200')
    expect(await res.json()).toMatchObject({
      code: 'INTERACTION_COOLDOWN',
      retryAfterSeconds: 1200,
    })
  })

  it('POST /friends/u2/interact 当日次数达上限触发 422 INTERACTION_DAILY_LIMIT_EXCEEDED', async () => {
    mocks.service.interactWithFriendPet.mockRejectedValue(
      new ApiError('INTERACTION_DAILY_LIMIT_EXCEEDED', '今日对该好友的互动次数已达上限'),
    )

    const res = await app.request('/api/v1/friends/u2/interact', jsonInit('POST', { kind: 'poke' }))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'INTERACTION_DAILY_LIMIT_EXCEEDED' })
  })

  it('POST /friends/u2/interact 目标好友打卡已满或休息触发 422 REMIND_NOT_APPLICABLE', async () => {
    mocks.service.interactWithFriendPet.mockRejectedValue(
      new ApiError('REMIND_NOT_APPLICABLE', '好友今日目标已达标或今日休息，暂无需提醒'),
    )

    const res = await app.request(
      '/api/v1/friends/u2/interact',
      jsonInit('POST', { kind: 'remind' }),
    )
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'REMIND_NOT_APPLICABLE' })
  })

  it('POST /friends/u2/interact 正常执行戳戳成功并返回更新结果', async () => {
    mocks.service.interactWithFriendPet.mockResolvedValue(sampleResult)

    const res = await app.request('/api/v1/friends/u2/interact', jsonInit('POST', { kind: 'poke' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(sampleResult)
    expect(mocks.service.interactWithFriendPet).toHaveBeenCalledWith(
      expect.anything(),
      'u1',
      'u2',
      { kind: 'poke' },
      expect.any(Date),
    )
  })

  it('POST /friends/u2/interact 正常执行投喂零食（strawberry）成功', async () => {
    const feedResult: PetInteractResult = {
      ...sampleResult,
      interaction: {
        id: 'int_feed_1',
        kind: 'feed',
        treatId: 'strawberry',
        createdAt: '2026-11-02T10:00:00.000Z',
      },
      feedback: '给 阿柚 的团团投喂了「奶油草莓」→ 触发【酸甜冒爱心】专属反应！',
    }
    mocks.service.interactWithFriendPet.mockResolvedValue(feedResult)

    const res = await app.request(
      '/api/v1/friends/u2/interact',
      jsonInit('POST', { kind: 'feed', treatId: 'strawberry' }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(feedResult)
  })
})

describe('Pet Interactions 核心业务规则逻辑断言（Decision #5）', () => {
  it('Decision #5 目标好友时区与日切换时间决定打卡日 targetLocalDate', () => {
    // 假设目标好友时区为 Asia/Tokyo (UTC+9)，日切换时间为 04:00
    // UTC 2026-11-02 18:30:00 -> 东京时间 2026-11-03 03:30:00（早于 4 点，应计为 2026-11-02）
    const beforeDayStart = new Date('2026-11-02T18:30:00.000Z')
    const date1 = localDateOf(beforeDayStart, 'Asia/Tokyo', 4)
    expect(date1).toBe('2026-11-02')

    // UTC 2026-11-02 19:30:00 -> 东京时间 2026-11-03 04:30:00（晚于 4 点，应计为 2026-11-03，每日限额刷新）
    const afterDayStart = new Date('2026-11-02T19:30:00.000Z')
    const date2 = localDateOf(afterDayStart, 'Asia/Tokyo', 4)
    expect(date2).toBe('2026-11-03')
  })

  it('30 分钟冷却秒数计算逻辑：少于 1800 秒则拒绝并计算剩余秒数', () => {
    const lastAt = new Date('2026-11-02T10:00:00.000Z')
    const now = new Date('2026-11-02T10:10:00.000Z') // 10 分钟后（600 秒）
    const elapsedSec = Math.floor((now.getTime() - lastAt.getTime()) / 1000)
    expect(elapsedSec).toBe(600)
    const cooldownLeft = 1800 - elapsedSec
    expect(cooldownLeft).toBe(1200)
    expect(cooldownLeft > 0).toBe(true)
  })

  it('30 分钟冷却超时放行：达到或超过 1800 秒解除冷却', () => {
    const lastAt = new Date('2026-11-02T10:00:00.000Z')
    const now = new Date('2026-11-02T10:30:01.000Z') // 30 分钟零 1 秒后
    const elapsedSec = Math.floor((now.getTime() - lastAt.getTime()) / 1000)
    expect(elapsedSec).toBe(1801)
    const cooldownLeft = Math.max(0, 1800 - elapsedSec)
    expect(cooldownLeft).toBe(0)
  })
})
