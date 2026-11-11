import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountState } from '@/server/auth/account-state'
import { db, type Tx } from '@/server/db/client'
import { profiles, user } from '@/server/db/schema'
import { NotificationKindSchema, NotificationSummarySchema } from '@/features/notification/schemas'
import * as notificationsService from '@/server/services/notifications'

/*
 * /notifications 统一通知中心接口与服务测试（Issue #20 · Decision #4 · M2）
 * 1. HTTP 鉴权与参数校验（经根应用 app.request）
 * 2. 接口业务逻辑与已读标记
 * 3. 5 分钟滑动窗口打卡聚合（Checkin Aggregator）
 * 4. 24 小时静默去重造访足迹（Visit Footprint Deduplication）
 */

const mocks = vi.hoisted(() => ({
  session: null as { user: { id: string; role: string }; session: { id: string } } | null,
  state: null as AccountState | null,
  useRealService: false,
  service: {
    getNotificationSummary: vi.fn(),
    listNotifications: vi.fn(),
    markNotificationsRead: vi.fn(),
  },
}))

vi.mock('@/server/auth/session', () => ({ getSessionFromHeaders: async () => mocks.session }))
vi.mock('@/server/auth/account-state', () => ({ loadAccountState: async () => mocks.state }))
vi.mock('@/server/services/notifications', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/services/notifications')>()
  return {
    ...actual,
    getNotificationSummary: (...args: unknown[]) => {
      if (mocks.useRealService) {
        return (actual.getNotificationSummary as (...a: unknown[]) => unknown)(...args)
      }
      return mocks.service.getNotificationSummary(...args)
    },
    listNotifications: (...args: unknown[]) => {
      if (mocks.useRealService) {
        return (actual.listNotifications as (...a: unknown[]) => unknown)(...args)
      }
      return mocks.service.listNotifications(...args)
    },
    markNotificationsRead: (...args: unknown[]) => {
      if (mocks.useRealService) {
        return (actual.markNotificationsRead as (...a: unknown[]) => unknown)(...args)
      }
      return mocks.service.markNotificationsRead(...args)
    },
  }
})

const { app } = await import('../app')

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

const sampleItem = {
  id: '0192e2b0-8f96-7b24-9b88-123456789abc',
  userId: 'u1',
  actorId: 'u2',
  actorNickname: '阿柚',
  actorAvatar: 'mascot:tuan:cheer:exercise',
  kind: 'checkin_aggregate',
  title: '阿柚 完成了「晨间慢跑 30 分钟」',
  content: '阿柚 刚刚完成了「晨间慢跑 30 分钟」今日打卡！',
  metadata: { checkins: [{ title: '晨间慢跑 30 分钟', module: 'exercise', time: '08:15' }] },
  readAt: null,
  createdAt: '2026-11-02T08:15:00.000Z',
}

beforeEach(() => {
  mocks.session = null
  mocks.state = null
  for (const fn of Object.values(mocks.service)) fn.mockReset()
})

describe('/api/v1/notifications 鉴权', () => {
  it.each([
    ['GET', '/api/v1/notifications/summary', undefined],
    ['GET', '/api/v1/notifications', undefined],
    ['POST', '/api/v1/notifications/read', jsonInit('POST', { all: true })],
  ] as const)('未登录 %s %s → 401 UNAUTHENTICATED', async (_m, path, init) => {
    const res = await app.request(path, init)
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'UNAUTHENTICATED' })
  })
})

describe('/api/v1/notifications 接口调用与参数校验', () => {
  beforeEach(() => login('u1'))

  it('GET /notifications/summary 返回未读数与红点状态', async () => {
    mocks.service.getNotificationSummary.mockResolvedValue({
      unreadCount: 3,
      hasUnread: true,
    })

    const res = await app.request('/api/v1/notifications/summary')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      unreadCount: 3,
      hasUnread: true,
    })
    expect(mocks.service.getNotificationSummary.mock.calls[0]?.[1]).toBe('u1')
  })

  it('GET /notifications 返回通知列表并透传 channel / unreadOnly 参数', async () => {
    mocks.service.listNotifications.mockResolvedValue({
      items: [sampleItem],
      nextCursor: null,
    })

    const res = await app.request('/api/v1/notifications?channel=feed&unreadOnly=true&limit=10')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      items: [sampleItem],
      nextCursor: null,
    })
    expect(mocks.service.listNotifications.mock.calls[0]?.[1]).toBe('u1')
    expect(mocks.service.listNotifications.mock.calls[0]?.[2]).toMatchObject({
      channel: 'feed',
      unreadOnly: true,
      limit: 10,
    })
  })

  it('GET /notifications 参数校验失败（如 limit 超出 50）返回 400 VALIDATION_FAILED', async () => {
    const res = await app.request('/api/v1/notifications?limit=999')
    expect(res.status).toBe(400)
    const body = (await res.json()) as { code: string; fields?: Record<string, string[]> }
    expect(body.code).toBe('VALIDATION_FAILED')
    expect(body.fields?.limit).toBeDefined()
  })

  it('POST /notifications/read 支持批量标记已读', async () => {
    mocks.service.markNotificationsRead.mockResolvedValue({
      success: true,
      markedCount: 5,
    })

    const res = await app.request(
      '/api/v1/notifications/read',
      jsonInit('POST', { channel: 'feed' }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      markedCount: 5,
    })
    expect(mocks.service.markNotificationsRead.mock.calls[0]?.[1]).toBe('u1')
    expect(mocks.service.markNotificationsRead.mock.calls[0]?.[2]).toMatchObject({
      channel: 'feed',
    })
  })

  it('POST /notifications/read 支持按 notificationIds 标记', async () => {
    const testId = '0192e2b0-8f96-7b24-9b88-123456789abc'
    mocks.service.markNotificationsRead.mockResolvedValue({
      success: true,
      markedCount: 1,
    })

    const res = await app.request(
      '/api/v1/notifications/read',
      jsonInit('POST', { notificationIds: [testId] }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      success: true,
      markedCount: 1,
    })
    expect(mocks.service.markNotificationsRead.mock.calls[0]?.[2]).toMatchObject({
      notificationIds: [testId],
    })
  })
})

describe('Notification 架构契约与角标状态（Decision #4）', () => {
  it('NotificationKindSchema 严格支持全部 5 种规范类别', () => {
    const valid = ['checkin_aggregate', 'pet_interaction', 'visit_footprint', 'system', 'friend']
    for (const k of valid) {
      expect(NotificationKindSchema.safeParse(k).success).toBe(true)
    }
    expect(NotificationKindSchema.safeParse('invalid_kind').success).toBe(false)
  })

  it('NotificationSummarySchema 校验未读计数与布尔标记', () => {
    expect(NotificationSummarySchema.safeParse({ unreadCount: 0, hasUnread: false }).success).toBe(
      true,
    )
    expect(NotificationSummarySchema.safeParse({ unreadCount: 5, hasUnread: true }).success).toBe(
      true,
    )
    expect(NotificationSummarySchema.safeParse({ unreadCount: -1, hasUnread: false }).success).toBe(
      false,
    )
  })

  it('NotificationBellBadge 角标 4 种视觉形态数值映射（0, dot, 1-99, 99+）', () => {
    const computeBadge = (unreadCount: number, hasLightDot: boolean, label = '消息与通知') => {
      const showCount = unreadCount > 0
      const showDot = !showCount && hasLightDot
      const countLabel = unreadCount > 99 ? '99+' : String(unreadCount)
      const a11yLabel = showCount
        ? `${label}（${unreadCount} 条未读）`
        : showDot
          ? `${label}（有新动态）`
          : label
      return { showCount, showDot, countLabel, a11yLabel }
    }

    // 状态 1: 干净无未读 (unread=0, lightDot=false)
    const s1 = computeBadge(0, false)
    expect(s1.showCount).toBe(false)
    expect(s1.showDot).toBe(false)
    expect(s1.a11yLabel).toBe('消息与通知')

    // 状态 2: 小红点轻提示 (unread=0, lightDot=true)
    const s2 = computeBadge(0, true)
    expect(s2.showCount).toBe(false)
    expect(s2.showDot).toBe(true)
    expect(s2.a11yLabel).toBe('消息与通知（有新动态）')

    // 状态 3: 未读数 1-99 正常气泡
    const s3 = computeBadge(5, false)
    expect(s3.showCount).toBe(true)
    expect(s3.showDot).toBe(false)
    expect(s3.countLabel).toBe('5')
    expect(s3.a11yLabel).toBe('消息与通知（5 条未读）')

    // 状态 4: 未读数 > 99 溢出截断 "99+"
    const s4 = computeBadge(120, false)
    expect(s4.showCount).toBe(true)
    expect(s4.showDot).toBe(false)
    expect(s4.countLabel).toBe('99+')
    expect(s4.a11yLabel).toBe('消息与通知（120 条未读）')
  })
})

/* ============================================================================
 * 真实数据库事务回滚集成测试（验证聚合与去重真实算法）
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

describe.runIf(hasDb)('真实数据库集成：通知服务与动态聚合', () => {
  beforeEach(() => {
    mocks.useRealService = true
  })
  afterEach(() => {
    mocks.useRealService = false
  })

  it('5 分钟滑动窗口打卡动态聚合（Feature 15）', async () => {
    await inRolledBackTx(async (tx) => {
      const u1 = 'test_notify_user_1'
      const u2 = 'test_notify_user_2'
      const now = new Date('2026-11-02T08:10:00.000Z')

      // 创建测试用户与个人资料
      await tx.insert(user).values([
        { id: u1, name: 'User 1', email: 'u1@test.local', createdAt: now, updatedAt: now },
        { id: u2, name: 'User 2', email: 'u2@test.local', createdAt: now, updatedAt: now },
      ])
      await tx.insert(profiles).values([
        { userId: u1, nickname: '小满', avatar: 'mascot:tuan:cheer:exercise' },
        { userId: u2, nickname: '阿柚', avatar: 'mascot:you:happy:diet' },
      ])

      // 记录当前全局公告产生的基线未读数（例如种子库中的已发布官方公告）
      const baselineSummary = await notificationsService.getNotificationSummary(tx, u1, now)

      // 1. 首次打卡：创建一条打卡动态
      const id1 = await notificationsService.recordCheckinNotification(
        tx,
        u1,
        u2,
        { goalTitle: '晨间慢跑 30 分钟', module: 'exercise', occurredAt: now },
        now,
      )
      expect(id1).toBeTruthy()

      // 验证未读数 +1
      const summary1 = await notificationsService.getNotificationSummary(tx, u1, now)
      expect(summary1.unreadCount).toBe(baselineSummary.unreadCount + 1)
      expect(summary1.hasUnread).toBe(true)

      // 2. 2 分钟后第 2 次打卡（在 5 分钟窗口内）：合并为同一张卡片
      const after2Min = new Date(now.getTime() + 2 * 60 * 1000)
      const id2 = await notificationsService.recordCheckinNotification(
        tx,
        u1,
        u2,
        { goalTitle: '无糖燕麦早餐', module: 'diet', occurredAt: after2Min },
        after2Min,
      )
      expect(id2).toBe(id1) // 同一条通知 ID

      // 未读数仍为 baseline + 1
      const summary2 = await notificationsService.getNotificationSummary(tx, u1, after2Min)
      expect(summary2.unreadCount).toBe(baselineSummary.unreadCount + 1)

      // 3. 验证通知内容已更新为聚合卡片
      const list = await notificationsService.listNotifications(
        tx,
        u1,
        { channel: 'feed' },
        after2Min,
      )
      expect(list.items).toHaveLength(1)
      const card = list.items[0]
      expect(card.title).toContain('连打 2 项')
      expect((card.metadata as { checkins?: unknown[] }).checkins).toHaveLength(2)

      // 4. 标记已读
      const markResult = await notificationsService.markNotificationsRead(
        tx,
        u1,
        { channel: 'feed' },
        after2Min,
      )
      expect(markResult.markedCount).toBe(1)

      const summaryAfterRead = await notificationsService.getNotificationSummary(tx, u1, after2Min)
      expect(summaryAfterRead.unreadCount).toBe(baselineSummary.unreadCount)
      expect(summaryAfterRead.hasUnread).toBe(baselineSummary.unreadCount > 0)
    })
  })

  it('数据库官方公告模块（announcements + announcement_reads）：发布即可见、支持定时与独立已读（Issue #80）', async () => {
    await inRolledBackTx(async (tx) => {
      const u1 = 'test_announce_user_1'
      const u2 = 'test_announce_user_2'
      const now = new Date('2026-11-12T08:00:00.000Z')
      const future = new Date('2026-11-20T08:00:00.000Z')

      await tx.insert(user).values([
        { id: u1, name: 'Ann User 1', email: 'ann1@test.local', createdAt: now, updatedAt: now },
        { id: u2, name: 'Ann User 2', email: 'ann2@test.local', createdAt: now, updatedAt: now },
      ])

      const baseU1 = await notificationsService.getNotificationSummary(tx, u1, now)
      const baseU2 = await notificationsService.getNotificationSummary(tx, u2, now)

      // 1. 直接向 announcements 插入一条已生效公告与一条未来定时公告
      const liveAnnId = await notificationsService.createAnnouncement(tx, {
        tag: '版本更新',
        version: '0.1.9',
        title: 'DayDayOn v0.1.9 公告测试',
        content: '1. 智能上传直传\n2. 全屏通知重构',
        pinned: true,
        publishedAt: now,
        now,
      })
      await notificationsService.createAnnouncement(tx, {
        tag: '预告',
        title: '未来定时发布的活动公告',
        content: '不到时间不会展示',
        publishedAt: future,
        now,
      })

      // 2. 两位用户无需扇出即可立即看到未读数 +1，未来定时公告不计入
      const s1 = await notificationsService.getNotificationSummary(tx, u1, now)
      const s2 = await notificationsService.getNotificationSummary(tx, u2, now)
      expect(s1.unreadCount).toBe(baseU1.unreadCount + 1)
      expect(s2.unreadCount).toBe(baseU2.unreadCount + 1)

      // 3. system 频道返回新公告且带置顶与版本元数据
      const sysList = await notificationsService.listNotifications(
        tx,
        u1,
        { channel: 'system' },
        now,
      )
      const matched = sysList.items.find((item) => item.id === liveAnnId)
      expect(matched).toBeDefined()
      expect(matched?.title).toBe('DayDayOn v0.1.9 公告测试')
      expect(matched?.readAt).toBeNull()
      expect(matched?.metadata).toMatchObject({
        source: 'announcement',
        tag: '版本更新',
        version: '0.1.9',
        pinned: true,
      })
      expect(sysList.items.some((item) => item.title === '未来定时发布的活动公告')).toBe(false)

      // 4. u1 标记 system 频道已读后，u1 未读清零，而 u2 仍保持未读
      const readRes = await notificationsService.markNotificationsRead(
        tx,
        u1,
        { channel: 'system' },
        now,
      )
      expect(readRes.markedCount).toBeGreaterThanOrEqual(1)

      const s1After = await notificationsService.getNotificationSummary(tx, u1, now)
      const s2After = await notificationsService.getNotificationSummary(tx, u2, now)
      expect(s1After.unreadCount).toBe(0)
      expect(s2After.unreadCount).toBe(baseU2.unreadCount + 1)
    })
  })

  it('24 小时静默去重造访足迹（Feature 16）', async () => {
    await inRolledBackTx(async (tx) => {
      const u1 = 'test_visit_user_1'
      const u2 = 'test_visit_user_2'
      const now = new Date('2026-11-02T10:00:00.000Z')

      await tx.insert(user).values([
        { id: u1, name: 'User 1', email: 'v1@test.local', createdAt: now, updatedAt: now },
        { id: u2, name: 'User 2', email: 'v2@test.local', createdAt: now, updatedAt: now },
      ])
      await tx.insert(profiles).values([
        { userId: u1, nickname: '小满', avatar: 'mascot:tuan:cheer:exercise' },
        { userId: u2, nickname: '豆豆', avatar: 'mascot:dun:happy:study' },
      ])

      // 1. 首次造访：插入足迹
      const id1 = await notificationsService.recordVisitFootprint(tx, u1, u2, '墩墩', now)
      expect(id1).toBeTruthy()

      const list1 = await notificationsService.listNotifications(tx, u1, { channel: 'feed' })
      expect(list1.items).toHaveLength(1)
      expect(list1.items[0].kind).toBe('visit_footprint')
      expect((list1.items[0].metadata as { visitCount?: number }).visitCount).toBe(1)

      // 2. 6 小时后再次造访（在 24 小时窗口内）：静默合并更新
      const after6h = new Date(now.getTime() + 6 * 3600 * 1000)
      const id2 = await notificationsService.recordVisitFootprint(tx, u1, u2, '墩墩', after6h)
      expect(id2).toBe(id1)

      const list2 = await notificationsService.listNotifications(tx, u1, { channel: 'feed' })
      expect(list2.items).toHaveLength(1)
      expect((list2.items[0].metadata as { visitCount?: number }).visitCount).toBe(2)

      // 3. 访问自己小窝不产生足迹
      const selfId = await notificationsService.recordVisitFootprint(tx, u1, u1, '团团', now)
      expect(selfId).toBeNull()
    })
  })
})
