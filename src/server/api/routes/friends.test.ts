import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountState } from '@/server/auth/account-state'

/*
 * /friends 接口经根应用 app.request()：鉴权、6 位配对码校验、错误码映射（ADR-0026）。
 */

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string; role: string }; session: { id: string } } | null,
  state: null as AccountState | null,
  service: {
    listFriends: vi.fn(),
    getOrCreateInviteCode: vi.fn(),
    previewInviteCode: vi.fn(),
    acceptInviteCode: vi.fn(),
    getFriendDashboard: vi.fn(),
    removeFriend: vi.fn(),
  },
}))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => mocks.session }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => mocks.state }))
vi.mock('@/server/services/friends', () => mocks.service)
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

const sampleFriend = {
  userId: 'u2',
  nickname: '阿柚',
  avatar: 'mascot:tuan:cheer:exercise',
  streak: 5,
  todayDone: 2,
  todayPlanned: 3,
  todayMood: 4,
  createdAt: '2026-11-01T00:00:00.000Z',
}

beforeEach(() => {
  mocks.session = null
  mocks.state = null
  for (const fn of Object.values(mocks.service)) fn.mockReset()
})

describe('/api/v1/friends 鉴权', () => {
  it.each([
    ['GET', '/api/v1/friends', undefined],
    ['POST', '/api/v1/friends/invite', jsonInit('POST', {})],
    ['POST', '/api/v1/friends/invite/preview', jsonInit('POST', { code: '123456' })],
    ['POST', '/api/v1/friends/accept', jsonInit('POST', { code: '123456' })],
    ['GET', '/api/v1/friends/u2/dashboard', undefined],
    ['DELETE', '/api/v1/friends/u2', { method: 'DELETE', headers: SAME_ORIGIN }],
  ] as const)('未登录 %s %s → 401 UNAUTHENTICATED', async (_m, path, init) => {
    const res = await app.request(path, init)
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  })
})

describe('/api/v1/friends 业务与校验', () => {
  beforeEach(() => login('u1'))

  it('GET /friends 返回本人与好友列表', async () => {
    const payload = {
      me: { userId: 'u1', nickname: '小满', avatar: null },
      friends: [sampleFriend],
    }
    mocks.service.listFriends.mockResolvedValue(payload)

    const res = await app.request('/api/v1/friends')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(payload)
    expect(mocks.service.listFriends.mock.calls[0]?.[1]).toBe('u1')
  })

  it('POST /friends/invite 返回 10 分钟有效的 6 位配对码', async () => {
    const invite = {
      code: '839204',
      expiresAt: '2026-11-02T04:10:00.000Z',
      serverNow: '2026-11-02T04:00:00.000Z',
    }
    mocks.service.getOrCreateInviteCode.mockResolvedValue(invite)

    const res = await app.request('/api/v1/friends/invite', jsonInit('POST', {}))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(invite)
    expect(mocks.service.getOrCreateInviteCode.mock.calls[0]?.[1]).toBe('u1')
  })

  it('POST /friends/invite/preview 非 6 位数字返回 400 VALIDATION_FAILED', async () => {
    const res = await app.request(
      '/api/v1/friends/invite/preview',
      jsonInit('POST', { code: '12a' }),
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(mocks.service.previewInviteCode).not.toHaveBeenCalled()
  })

  it('POST /friends/invite/preview 配对码过期返回 400 FRIEND_INVITE_INVALID', async () => {
    mocks.service.previewInviteCode.mockRejectedValue(new ApiError('FRIEND_INVITE_INVALID'))
    const res = await app.request(
      '/api/v1/friends/invite/preview',
      jsonInit('POST', { code: '839204' }),
    )
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'FRIEND_INVITE_INVALID' })
  })

  it('POST /friends/accept 不能使用自己的配对码 → 400 FRIEND_SELF_INVITE', async () => {
    mocks.service.acceptInviteCode.mockRejectedValue(new ApiError('FRIEND_SELF_INVITE'))
    const res = await app.request('/api/v1/friends/accept', jsonInit('POST', { code: '839204' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ code: 'FRIEND_SELF_INVITE' })
  })

  it('POST /friends/accept 成功建立双向好友关系 → 200', async () => {
    mocks.service.acceptInviteCode.mockResolvedValue({ friend: sampleFriend })
    const res = await app.request('/api/v1/friends/accept', jsonInit('POST', { code: ' 839204 ' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ friend: sampleFriend })
    expect(mocks.service.acceptInviteCode.mock.calls[0]?.slice(1, 3)).toEqual(['u1', '839204'])
  })

  it('POST /friends/accept 好友上限达到 50 人返回 422 FRIEND_LIMIT_REACHED', async () => {
    mocks.service.acceptInviteCode.mockRejectedValue(new ApiError('FRIEND_LIMIT_REACHED'))
    const res = await app.request('/api/v1/friends/accept', jsonInit('POST', { code: '839204' }))
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: 'FRIEND_LIMIT_REACHED' })
  })

  it('DELETE /friends/{friendUserId} 成功解除好友关系 → 204', async () => {
    mocks.service.removeFriend.mockResolvedValue(undefined)
    const res = await app.request('/api/v1/friends/u2', { method: 'DELETE', headers: SAME_ORIGIN })
    expect(res.status).toBe(204)
    expect(mocks.service.removeFriend).toHaveBeenCalledWith(expect.anything(), 'u1', 'u2')
  })

  it('DELETE /friends/{friendUserId} 非好友关系返回 404 FRIEND_NOT_FOUND', async () => {
    mocks.service.removeFriend.mockRejectedValue(new ApiError('FRIEND_NOT_FOUND'))
    const res = await app.request('/api/v1/friends/u999', {
      method: 'DELETE',
      headers: SAME_ORIGIN,
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'FRIEND_NOT_FOUND' })
  })

  it('GET /friends/{friendUserId}/dashboard 非好友返回 404 FRIEND_NOT_FOUND', async () => {
    mocks.service.getFriendDashboard.mockRejectedValue(new ApiError('FRIEND_NOT_FOUND'))
    const res = await app.request('/api/v1/friends/u999/dashboard')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'FRIEND_NOT_FOUND' })
  })
})

describe('friends service unit tests', async () => {
  const actualService = await vi.importActual<typeof import('@/server/services/friends')>(
    '@/server/services/friends',
  )

  it('MAX_FRIENDS 常量为 50', () => {
    expect(actualService.MAX_FRIENDS).toBe(50)
  })

  it('removeFriend: 好友关系不存在时抛出 404 FRIEND_NOT_FOUND', async () => {
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }
    const mockDb = {
      transaction: vi
        .fn()
        .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
    }

    await expect(
      actualService.removeFriend(mockDb as never, 'user-a', 'user-b'),
    ).rejects.toThrowError(expect.objectContaining({ code: 'FRIEND_NOT_FOUND', status: 404 }))
  })

  it('removeFriend: 好友关系存在时在事务中双向原子删除', async () => {
    const mockDeleteWhere = vi.fn().mockResolvedValue([])
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'rel-1' }]),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: mockDeleteWhere,
      }),
    }
    const mockDb = {
      transaction: vi
        .fn()
        .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
    }

    await actualService.removeFriend(mockDb as never, 'user-a', 'user-b')
    expect(mockTx.delete).toHaveBeenCalled()
    expect(mockDeleteWhere).toHaveBeenCalled()
  })

  it('acceptInviteCode: 当前用户好友数已达 50 人时抛出 422 FRIEND_LIMIT_REACHED', async () => {
    const mockTx = {
      select: vi.fn().mockImplementation((fields: Record<string, unknown>) => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => {
            if ('count' in fields) {
              return Promise.resolve([{ count: 50 }])
            }
            return {
              orderBy: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockResolvedValue([{ id: 'inv-1', inviterId: 'user-inviter', code: '123456' }]),
              }),
              limit: vi.fn().mockResolvedValue([]),
            }
          }),
        })),
      })),
    }
    const mockDb = {
      transaction: vi
        .fn()
        .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx)),
    }

    await expect(
      actualService.acceptInviteCode(mockDb as never, 'user-a', '123456'),
    ).rejects.toThrowError(expect.objectContaining({ code: 'FRIEND_LIMIT_REACHED', status: 422 }))
  })
})
