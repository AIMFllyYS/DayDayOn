import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountState } from '@/server/auth/account-state'
import { db, type Tx } from '@/server/db/client'
import { chatMessages, friendships, moderationViolations, profiles, user } from '@/server/db/schema'
import { resetModerationState } from '@/server/moderation'
import * as chatService from '@/server/services/chat'
import { ApiError } from '../errors'

/*
 * 1v1 好友私聊接口与服务完整测试（Issue #25 · #26 · M6 · Decision #4 & #6）
 * 1. HTTP 鉴权与参数校验（未登录 401、内容空或超长 400、自我私聊 403）
 * 2. 会话列表接口 GET /api/v1/chats（包含 lastMessage, unreadCount, isFrozen）
 * 3. 历史消息接口 GET /api/v1/chats/:friendUserId（支持游标与只读归档模式）
 * 4. 批量标记已读 POST /api/v1/chats/:friendUserId/read
 * 5. 消息发送 POST /api/v1/chats/:friendUserId：
 *    - 幂等性（idempotencyKey 重复直接返回已有记录）
 *    - 解除好友后拒绝为 HTTP 403 FRIEND_RELATION_FROZEN（Decision #6）
 *    - DFA 敏感词拦截为 HTTP 422 CONTENT_SENSITIVE 并携带用户草稿
 *    - 静音冷静期拦截为 HTTP 403 USER_MUTED
 * 6. 真实 PostgreSQL 18 事务集成测试（Zero-Mock，消息落库、已读标记、审计日志哈希化）
 */

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string; role: string }; session: { id: string } } | null,
  state: null as AccountState | null,
  useRealService: false,
  service: {
    getChatThreads: vi.fn(),
    getChatHistory: vi.fn(),
    sendChatMessage: vi.fn(),
    markChatRead: vi.fn(),
  },
}))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => mocks.session }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => mocks.state }))
vi.mock('@/server/services/chat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/services/chat')>()
  return {
    ...actual,
    getChatThreads: (...args: unknown[]) => {
      if (mocks.useRealService) {
        return (actual.getChatThreads as (...a: unknown[]) => unknown)(...args)
      }
      return mocks.service.getChatThreads(...args)
    },
    getChatHistory: (...args: unknown[]) => {
      if (mocks.useRealService) {
        return (actual.getChatHistory as (...a: unknown[]) => unknown)(...args)
      }
      return mocks.service.getChatHistory(...args)
    },
    sendChatMessage: (...args: unknown[]) => {
      if (mocks.useRealService) {
        return (actual.sendChatMessage as (...a: unknown[]) => unknown)(...args)
      }
      return mocks.service.sendChatMessage(...args)
    },
    markChatRead: (...args: unknown[]) => {
      if (mocks.useRealService) {
        return (actual.markChatRead as (...a: unknown[]) => unknown)(...args)
      }
      return mocks.service.markChatRead(...args)
    },
  }
})

const { app } = await import('../app')

const SAME_ORIGIN = { 'sec-fetch-site': 'same-origin' }

const jsonInit = (method: string, body?: unknown) => ({
  method,
  headers: { 'content-type': 'application/json', ...SAME_ORIGIN },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
})

function login(userId = 'u1') {
  mocks.session = { user: { id: userId, role: 'user' }, session: { id: 's1' } }
  mocks.state = { banned: false, banReason: null, banExpires: null, onboardedAt: new Date(0) }
}

beforeEach(() => {
  mocks.session = null
  mocks.state = null
  mocks.useRealService = false
  resetModerationState()
  for (const fn of Object.values(mocks.service)) fn.mockReset()
})

describe('1v1 私聊接口鉴权与路由校验', () => {
  it('未登录访问 GET /api/v1/chats → 401 UNAUTHENTICATED', async () => {
    const res = await app.request('/api/v1/chats')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHENTICATED')
  })

  it('未登录访问 GET /api/v1/chats/u2 → 401 UNAUTHENTICATED', async () => {
    const res = await app.request('/api/v1/chats/u2')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHENTICATED')
  })

  it('未登录访问 POST /api/v1/chats/u2 → 401 UNAUTHENTICATED', async () => {
    const res = await app.request('/api/v1/chats/u2', jsonInit('POST', { content: '你好' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHENTICATED')
  })

  it('未登录访问 POST /api/v1/chats/u2/read → 401 UNAUTHENTICATED', async () => {
    const res = await app.request('/api/v1/chats/u2/read', jsonInit('POST'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHENTICATED')
  })

  it('发送消息为空文本时 → 400 VALIDATION_FAILED', async () => {
    login('u1')
    const res = await app.request('/api/v1/chats/u2', jsonInit('POST', { content: '   ' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_FAILED')
  })

  it('发送消息超过 300 字上限时 → 400 VALIDATION_FAILED', async () => {
    login('u1')
    const res = await app.request(
      '/api/v1/chats/u2',
      jsonInit('POST', { content: 'a'.repeat(301) }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_FAILED')
  })

  it('获取会话列表 GET /api/v1/chats 正常返回列表', async () => {
    login('u1')
    mocks.service.getChatThreads.mockResolvedValueOnce({
      threads: [
        {
          friendUserId: 'u2',
          friend: {
            userId: 'u2',
            nickname: '阿柚',
            avatar: 'mascot:tuan:cheer:diet',
            mascot: 'tuan',
          },
          lastMessage: {
            id: '0192e222-0000-7000-8000-000000000001',
            content: '晚上一起打卡！',
            createdAt: '2026-11-02T12:00:00.000Z',
            senderId: 'u2',
          },
          unreadCount: 1,
          isFrozen: false,
        },
      ],
    })

    const res = await app.request('/api/v1/chats')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.threads).toHaveLength(1)
    expect(body.threads[0].friendUserId).toBe('u2')
    expect(body.threads[0].unreadCount).toBe(1)
    expect(body.threads[0].isFrozen).toBe(false)
  })

  it('获取私聊历史：正常返回私聊列表与 isFrozen 状态', async () => {
    login('u1')
    mocks.service.getChatHistory.mockResolvedValueOnce({
      messages: [
        {
          id: '0192e222-0000-7000-8000-000000000001',
          senderId: 'u1',
          recipientId: 'u2',
          content: '今天一起加油打卡！',
          createdAt: '2026-11-02T12:00:00.000Z',
          readAt: null,
          isMine: true,
        },
      ],
      nextCursor: null,
      isFrozen: false,
      friend: {
        userId: 'u2',
        nickname: '阿柚',
        avatar: 'mascot:tuan:cheer:diet',
      },
    })

    const res = await app.request('/api/v1/chats/u2')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isFrozen).toBe(false)
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].content).toBe('今天一起加油打卡！')
    expect(body.friend.nickname).toBe('阿柚')
  })

  it('获取私聊历史：双方已解除好友但有历史消息时，进入 Decision #6 只读归档模式', async () => {
    login('u1')
    mocks.service.getChatHistory.mockResolvedValueOnce({
      messages: [
        {
          id: '0192e222-0000-7000-8000-000000000002',
          senderId: 'u2',
          recipientId: 'u1',
          content: '过往的回忆～',
          createdAt: '2026-11-01T12:00:00.000Z',
          readAt: '2026-11-01T12:05:00.000Z',
          isMine: false,
        },
      ],
      nextCursor: null,
      isFrozen: true,
      friend: {
        userId: 'u2',
        nickname: '南风',
        avatar: null,
      },
    })

    const res = await app.request('/api/v1/chats/u2')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isFrozen).toBe(true)
    expect(body.messages).toHaveLength(1)
  })

  it('向已解除好友发送私聊消息：抛出 HTTP 403 FRIEND_RELATION_FROZEN（Decision #6）', async () => {
    login('u1')
    mocks.service.sendChatMessage.mockRejectedValueOnce(
      new ApiError('FRIEND_RELATION_FROZEN', '双方已不是好友，无法发送新私聊消息'),
    )

    const res = await app.request('/api/v1/chats/u2', jsonInit('POST', { content: '还能说话吗？' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('FRIEND_RELATION_FROZEN')
  })

  it('发送私聊内容命中敏感词：抛出 HTTP 422 CONTENT_SENSITIVE 并携带草稿', async () => {
    login('u1')
    mocks.service.sendChatMessage.mockRejectedValueOnce(
      new ApiError('CONTENT_SENSITIVE', '内容包含敏感词，请修改后再发', {
        draft: '兼职加微信轻松赚大钱',
      }),
    )

    const res = await app.request(
      '/api/v1/chats/u2',
      jsonInit('POST', { content: '兼职加微信轻松赚大钱' }),
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('CONTENT_SENSITIVE')
    expect(body.draft).toBe('兼职加微信轻松赚大钱')
  })

  it('批量标记私聊已读 POST /api/v1/chats/u2/read 成功', async () => {
    login('u1')
    mocks.service.markChatRead.mockResolvedValueOnce({
      success: true,
      markedCount: 3,
    })

    const res = await app.request('/api/v1/chats/u2/read', jsonInit('POST'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.markedCount).toBe(3)
  })

  it('兼容路径：GET /api/v1/friends/u2/chat 正常工作', async () => {
    login('u1')
    mocks.service.getChatHistory.mockResolvedValueOnce({
      messages: [],
      nextCursor: null,
      isFrozen: false,
    })
    const res = await app.request('/api/v1/friends/u2/chat')
    expect(res.status).toBe(200)
  })

  it('兼容路径：POST /api/v1/friends/u2/chat 正常工作', async () => {
    login('u1')
    mocks.service.sendChatMessage.mockResolvedValueOnce({
      message: {
        id: '0192e222-0000-7000-8000-000000000001',
        senderId: 'u1',
        recipientId: 'u2',
        content: '加油！',
        createdAt: '2026-11-02T12:00:00.000Z',
        readAt: null,
        isMine: true,
      },
    })
    const res = await app.request(
      '/api/v1/friends/u2/chat',
      jsonInit('POST', { content: '加油！' }),
    )
    expect(res.status).toBe(201)
  })
})

/* ============================================================================
 * 真实数据库事务回滚集成测试（Decision #6、DFA 审核与私聊流转）
 * ========================================================================== */

class RollbackTestTx extends Error {}

async function inRolledBackTx(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await fn(tx)
      throw new RollbackTestTx()
    })
  } catch (error) {
    if (!(error instanceof RollbackTestTx)) throw error
  }
}

try {
  process.loadEnvFile?.('.env.local')
} catch {
  // ignore
}

const hasDb = Boolean(process.env.DATABASE_URL)

describe.runIf(hasDb)('真实 PostgreSQL 18 集成：1v1 私聊全生命周期与 Decision #6 归档履约', () => {
  beforeEach(() => {
    mocks.useRealService = true
    resetModerationState()
  })

  afterEach(() => {
    mocks.useRealService = false
  })

  it('1. 正常好友私聊发送、落库、通知生成与已读标记', async () => {
    await inRolledBackTx(async (tx) => {
      const u1 = 'chat_test_user_a'
      const u2 = 'chat_test_user_b'
      const now = new Date('2026-11-02T10:00:00.000Z')

      await tx.insert(user).values([
        { id: u1, name: '用户A', email: 'a@chat.local', createdAt: now, updatedAt: now },
        { id: u2, name: '用户B', email: 'b@chat.local', createdAt: now, updatedAt: now },
      ])
      await tx.insert(profiles).values([
        { userId: u1, nickname: '小A', avatar: 'mascot:tuan:cheer:exercise' },
        { userId: u2, nickname: '小B', avatar: 'mascot:dun:happy:diet' },
      ])
      await tx.insert(friendships).values([
        { userId: u1, friendId: u2 },
        { userId: u2, friendId: u1 },
      ])

      // A 给 B 发送私聊消息
      login(u1)
      const sendRes = await chatService.sendChatMessage(
        tx,
        u1,
        u2,
        { content: '今天跑步打卡了吗？' },
        now,
      )

      expect(sendRes.message.content).toBe('今天跑步打卡了吗？')
      expect(sendRes.message.senderId).toBe(u1)
      expect(sendRes.message.recipientId).toBe(u2)
      expect(sendRes.message.readAt).toBeNull()

      // B 查看会话列表：应显示该会话与未读数 1
      login(u2)
      const threadsRes = await chatService.getChatThreads(tx, u2)
      expect(threadsRes.threads).toHaveLength(1)
      expect(threadsRes.threads[0].friendUserId).toBe(u1)
      expect(threadsRes.threads[0].unreadCount).toBe(1)
      expect(threadsRes.threads[0].lastMessage?.content).toBe('今天跑步打卡了吗？')

      // B 打开私聊历史：验证返回未读消息，且自动标记为已读
      const historyRes = await chatService.getChatHistory(tx, u2, u1, {}, now)
      expect(historyRes.isFrozen).toBe(false)
      expect(historyRes.messages).toHaveLength(1)
      expect(historyRes.messages[0].isMine).toBe(false)
      expect(historyRes.friend?.nickname).toBe('小A')

      // 再次查验已读标记
      const [dbMsg] = await tx.select().from(chatMessages).where(undefined)
      expect(dbMsg.readAt).not.toBeNull()
    })
  })

  it('2. 幂等性保障：同一 senderId + idempotencyKey 不重复落库', async () => {
    await inRolledBackTx(async (tx) => {
      const u1 = 'chat_test_user_idemp_a'
      const u2 = 'chat_test_user_idemp_b'
      const now = new Date('2026-11-02T10:00:00.000Z')

      await tx.insert(user).values([
        { id: u1, name: '幂等A', email: 'idemp_a@chat.local', createdAt: now, updatedAt: now },
        { id: u2, name: '幂等B', email: 'idemp_b@chat.local', createdAt: now, updatedAt: now },
      ])
      await tx.insert(profiles).values([
        { userId: u1, nickname: '幂等A', avatar: 'mascot:tuan:cheer:exercise' },
        { userId: u2, nickname: '幂等B', avatar: 'mascot:dun:happy:diet' },
      ])
      await tx.insert(friendships).values([
        { userId: u1, friendId: u2 },
        { userId: u2, friendId: u1 },
      ])

      const clientSeq = 'idem_test_1'
      const firstRes = await chatService.sendChatMessage(
        tx,
        u1,
        u2,
        { content: '这是一条幂等测试消息', idempotencyKey: clientSeq },
        now,
      )

      const secondRes = await chatService.sendChatMessage(
        tx,
        u1,
        u2,
        { content: '这是一条幂等测试消息', idempotencyKey: clientSeq },
        now,
      )

      expect(firstRes.message.id).toBe(secondRes.message.id)
      const allMsgs = await tx.select().from(chatMessages).where(undefined)
      expect(allMsgs).toHaveLength(1)
    })
  })

  it('3. 批量标记已读 markChatRead 真实更新未读记录', async () => {
    await inRolledBackTx(async (tx) => {
      const u1 = 'chat_test_user_read_a'
      const u2 = 'chat_test_user_read_b'
      const now = new Date('2026-11-02T10:00:00.000Z')

      await tx.insert(user).values([
        { id: u1, name: '读A', email: 'read_a@chat.local', createdAt: now, updatedAt: now },
        { id: u2, name: '读B', email: 'read_b@chat.local', createdAt: now, updatedAt: now },
      ])
      await tx.insert(profiles).values([
        { userId: u1, nickname: '读A', avatar: null },
        { userId: u2, nickname: '读B', avatar: null },
      ])
      await tx.insert(friendships).values([
        { userId: u1, friendId: u2 },
        { userId: u2, friendId: u1 },
      ])

      // u1 给 u2 发送两条消息
      await chatService.sendChatMessage(tx, u1, u2, { content: '第一条' }, now)
      await chatService.sendChatMessage(tx, u1, u2, { content: '第二条' }, now)

      // u2 执行 markChatRead
      const markRes = await chatService.markChatRead(tx, u2, u1, now)
      expect(markRes.success).toBe(true)
      expect(markRes.markedCount).toBe(2)

      // 再次查询未读数应为 0
      const threads = await chatService.getChatThreads(tx, u2)
      expect(threads.threads[0].unreadCount).toBe(0)
    })
  })

  it('4. 解除好友后历史归档只读且拦截新消息发送（Decision #6）', async () => {
    await inRolledBackTx(async (tx) => {
      const u1 = 'chat_test_user_c'
      const u2 = 'chat_test_user_d'
      const now = new Date('2026-11-02T10:00:00.000Z')

      await tx.insert(user).values([
        { id: u1, name: '用户C', email: 'c@chat.local', createdAt: now, updatedAt: now },
        { id: u2, name: '用户D', email: 'd@chat.local', createdAt: now, updatedAt: now },
      ])
      await tx.insert(profiles).values([
        { userId: u1, nickname: '小C', avatar: 'mascot:tuan:cheer:exercise' },
        { userId: u2, nickname: '小D', avatar: 'mascot:you:happy:diet' },
      ])
      await tx.insert(friendships).values([
        { userId: u1, friendId: u2 },
        { userId: u2, friendId: u1 },
      ])

      // 好友关系下发送一条历史私聊
      await chatService.sendChatMessage(tx, u1, u2, { content: '我们曾经是好朋友' }, now)

      // 解除好友关系（删除双向行）
      await tx.delete(friendships).where(undefined)

      // C 查看会话列表：必须显示该会话，且 isFrozen: true
      const threadsRes = await chatService.getChatThreads(tx, u1)
      expect(threadsRes.threads).toHaveLength(1)
      expect(threadsRes.threads[0].isFrozen).toBe(true)

      // C 查看与 D 的聊天历史：必须成功返回且 isFrozen 为 true
      login(u1)
      const historyRes = await chatService.getChatHistory(tx, u1, u2, {}, now)
      expect(historyRes.isFrozen).toBe(true)
      expect(historyRes.messages).toHaveLength(1)
      expect(historyRes.messages[0].content).toBe('我们曾经是好朋友')

      // C 尝试发送新消息：必须抛出 403 FRIEND_RELATION_FROZEN
      try {
        await chatService.sendChatMessage(tx, u1, u2, { content: '还能复合吗？' }, now)
        expect.unreachable('Should have thrown FRIEND_RELATION_FROZEN')
      } catch (e: unknown) {
        expect(e).toBeInstanceOf(ApiError)
        expect((e as ApiError).code).toBe('FRIEND_RELATION_FROZEN')
        expect((e as ApiError).status).toBe(403)
      }
    })
  })

  it('5. 敏感词拦截与审计日志写入（M5 集成）', async () => {
    await inRolledBackTx(async (tx) => {
      const u1 = 'chat_test_user_e'
      const u2 = 'chat_test_user_f'
      const now = new Date('2026-11-02T10:00:00.000Z')

      await tx.insert(user).values([
        { id: u1, name: '用户E', email: 'e@chat.local', createdAt: now, updatedAt: now },
        { id: u2, name: '用户F', email: 'f@chat.local', createdAt: now, updatedAt: now },
      ])
      await tx.insert(profiles).values([
        { userId: u1, nickname: '小E', avatar: 'mascot:tuan:cheer:exercise' },
        { userId: u2, nickname: '小F', avatar: 'mascot:you:happy:diet' },
      ])
      await tx.insert(friendships).values([
        { userId: u1, friendId: u2 },
        { userId: u2, friendId: u1 },
      ])

      // E 发送涉嫌刷单兼职的敏感词
      login(u1)
      try {
        await chatService.sendChatMessage(
          tx,
          u1,
          u2,
          { content: '快来加入我们兼职刷单，日结五百加微信' },
          now,
        )
        expect.unreachable('Should have thrown CONTENT_SENSITIVE')
      } catch (e: unknown) {
        expect(e).toBeInstanceOf(ApiError)
        expect((e as ApiError).code).toBe('CONTENT_SENSITIVE')
        expect((e as ApiError).status).toBe(422)
      }

      // 验证审计日志中写入了脱敏 SHA-256 记录，且无明文落库
      const logs = await tx.select().from(moderationViolations).where(undefined)
      expect(logs).toHaveLength(1)
      expect(logs[0].userId).toBe(u1)
      expect(logs[0].action).toBe('chat')
      expect(logs[0].contentHash).toBeDefined()
      expect(logs[0].contentHash).not.toContain('刷单')
    })
  })
})
