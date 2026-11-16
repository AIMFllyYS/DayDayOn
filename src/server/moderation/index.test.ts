import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { ApiError } from '@/server/api/errors'
import { db, type Tx } from '@/server/db/client'
import { moderationViolations, user } from '@/server/db/schema'
import { assertTextClean, getUserMuteStatus, hashContent, resetModerationState } from './index'

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

beforeEach(() => {
  resetModerationState()
})

describe('Moderation 隐私哈希算法', () => {
  it('hashContent: 正确生成 64 位 SHA-256 十六进制哈希且严禁明文暴露', () => {
    const raw = '这是一段包含违规内容的敏感文本'
    const hash1 = hashContent(raw)
    const hash2 = hashContent(raw)

    expect(hash1).toHaveLength(64)
    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^[a-f0-9]{64}$/)
    expect(hash1).not.toContain('敏感文本')
  })
})

describe.runIf(hasDb)('真实数据库集成：敏感词拦截与隐私审计日志写入', () => {
  it('干净文本放行且不产生违规记录', async () => {
    await inRolledBackTx(async (tx) => {
      const testUserId = 'test_clean_user'
      const now = new Date('2026-11-02T12:00:00.000Z')

      await tx.insert(user).values({
        id: testUserId,
        name: 'Clean User',
        email: 'clean@test.local',
        createdAt: now,
        updatedAt: now,
      })

      await expect(
        assertTextClean('今天打卡完成了，开心！', {
          userId: testUserId,
          action: 'chat',
          now,
          db: tx,
        }),
      ).resolves.toBeUndefined()

      const records = await tx
        .select()
        .from(moderationViolations)
        .where(eq(moderationViolations.userId, testUserId))

      expect(records).toHaveLength(0)
    })
  })

  it('敏感文本拦截并抛出 422 CONTENT_SENSITIVE，且向 DB 写入 SHA-256 哈希记录', async () => {
    await inRolledBackTx(async (tx) => {
      const testUserId = 'test_violation_user'
      const now = new Date('2026-11-02T12:00:00.000Z')

      await tx.insert(user).values({
        id: testUserId,
        name: 'Violation User',
        email: 'violation@test.local',
        createdAt: now,
        updatedAt: now,
      })

      const sensitiveText = '你这个人真是个傻*逼'
      const expectedHash = hashContent(sensitiveText)

      let caughtError: unknown
      try {
        await assertTextClean(sensitiveText, {
          userId: testUserId,
          action: 'chat',
          now,
          db: tx,
        })
      } catch (err) {
        caughtError = err
      }

      // 断言抛出 422 CONTENT_SENSITIVE 并携带原始草稿
      expect(caughtError).toBeInstanceOf(ApiError)
      const apiErr = caughtError as ApiError
      expect(apiErr.code).toBe('CONTENT_SENSITIVE')
      expect(apiErr.status).toBe(422)
      expect(apiErr.extras.draft).toBe(sensitiveText)

      // 验证 DB 审计记录：绝不明文入库，只存 SHA-256 与分类
      const records = await tx
        .select()
        .from(moderationViolations)
        .where(eq(moderationViolations.userId, testUserId))

      expect(records).toHaveLength(1)
      const log = records[0]
      expect(log.userId).toBe(testUserId)
      expect(log.action).toBe('chat')
      expect(log.category).toBe('abuse')
      expect(log.contentHash).toBe(expectedHash)
      expect(log.contentHash).not.toContain('傻')
      expect(log.contentHash).not.toContain('逼')
    })
  })

  it('24 小时内累计 5 次违规触发 24h 冷静期静音（HTTP 403 USER_MUTED）', async () => {
    await inRolledBackTx(async (tx) => {
      const testUserId = 'test_muted_user'
      const baseTime = new Date('2026-11-02T10:00:00.000Z')

      await tx.insert(user).values({
        id: testUserId,
        name: 'Muted User',
        email: 'muted@test.local',
        createdAt: baseTime,
        updatedAt: baseTime,
      })

      // 预先插入 5 条 24 小时内的违规记录
      for (let i = 0; i < 5; i++) {
        const violationTime = new Date(baseTime.getTime() + i * 60_000)
        await tx.insert(moderationViolations).values({
          userId: testUserId,
          action: 'chat',
          category: 'abuse',
          contentHash: hashContent(`violation ${i}`),
          createdAt: violationTime,
        })
      }

      // 此时用户尝试发送正常合规内容，因处于静音冷静期应被直接拦截
      const checkTime = new Date(baseTime.getTime() + 10 * 60_000)
      let caughtError: unknown
      try {
        await assertTextClean('这是一条完全干净正常的消息', {
          userId: testUserId,
          action: 'chat',
          now: checkTime,
          db: tx,
        })
      } catch (err) {
        caughtError = err
      }

      expect(caughtError).toBeInstanceOf(ApiError)
      const apiErr = caughtError as ApiError
      expect(apiErr.code).toBe('USER_MUTED')
      expect(apiErr.status).toBe(403)
      expect(apiErr.extras.retryAfterSeconds).toBeGreaterThan(0)

      // 查询静音状态
      const status = await getUserMuteStatus(testUserId, checkTime, tx)
      expect(status.isMuted).toBe(true)
      expect(status.retryAfterSeconds).toBeGreaterThan(0)

      // 24 小时冷静期过后自动解禁
      const after24h = new Date(baseTime.getTime() + 25 * 60 * 60 * 1000)
      const statusAfter = await getUserMuteStatus(testUserId, after24h, tx)
      expect(statusAfter.isMuted).toBe(false)

      await expect(
        assertTextClean('冷静期结束后发送正常消息', {
          userId: testUserId,
          action: 'chat',
          now: after24h,
          db: tx,
        }),
      ).resolves.toBeUndefined()
    })
  })
})

describe('防刷频控（10s 内 >5 条消息）与静音逻辑', () => {
  it('10 秒内连续发送超过 5 条消息触发 403 USER_MUTED 并进入冷静期', async () => {
    const testUserId = 'test_spam_user'
    const now = new Date('2026-11-02T12:00:00.000Z')

    // 模拟 mockDb（空记录）
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([]),
          }),
        }),
      }),
    } as unknown as Tx

    // 前 5 条消息：放行通过
    for (let i = 0; i < 5; i++) {
      const msgTime = new Date(now.getTime() + i * 1000)
      await expect(
        assertTextClean(`消息 ${i}`, {
          userId: testUserId,
          action: 'chat',
          now: msgTime,
          db: mockDb,
        }),
      ).resolves.toBeUndefined()
    }

    // 第 6 条消息（仍在 10 秒窗口内）：触发频控静音
    const sixthMsgTime = new Date(now.getTime() + 6000)
    let caughtError: unknown
    try {
      await assertTextClean('消息 6 刷屏', {
        userId: testUserId,
        action: 'chat',
        now: sixthMsgTime,
        db: mockDb,
      })
    } catch (err) {
      caughtError = err
    }

    expect(caughtError).toBeInstanceOf(ApiError)
    const apiErr = caughtError as ApiError
    expect(apiErr.code).toBe('USER_MUTED')
    expect(apiErr.status).toBe(403)
    expect(apiErr.extras.retryAfterSeconds).toBeGreaterThan(0)

    // 冷静期内的后续请求即使隔了几秒依然被拦截
    const nextMsgTime = new Date(now.getTime() + 15000)
    await expect(
      assertTextClean('还在冷静期内', {
        userId: testUserId,
        action: 'chat',
        now: nextMsgTime,
        db: mockDb,
      }),
    ).rejects.toMatchObject({
      code: 'USER_MUTED',
      status: 403,
    })
  })

  it('支持通过 rateLimitCounters 持久化频控与冷静期，进程内存清空后依然拦截', async () => {
    const testUserId = 'test_persisted_spam_user'
    const now = new Date('2026-11-02T12:00:00.000Z')
    const store = new Map<string, { count: number; expiresAt: Date }>()

    const persistedMockDb = {
      select: (fields?: Record<string, unknown>) => ({
        from: () => ({
          where: () => {
            const keys = Object.keys(fields ?? {})
            if (keys.includes('expiresAt')) {
              const row = store.get(`mod-mute:${testUserId}`)
              const active = row && row.expiresAt > now ? [{ expiresAt: row.expiresAt }] : []
              return { limit: () => Promise.resolve(active) }
            }
            if (keys.includes('count')) {
              const spamEntry = Array.from(store.entries()).find(([k]) =>
                k.startsWith(`mod-spam:${testUserId}:`),
              )
              const active =
                spamEntry && spamEntry[1].expiresAt > now ? [{ count: spamEntry[1].count }] : []
              return { limit: () => Promise.resolve(active) }
            }
            return { orderBy: () => Promise.resolve([]) }
          },
        }),
      }),
      insert: () => ({
        values: (val: { key: string; count: number; expiresAt: Date }) => ({
          onConflictDoUpdate: () => {
            const existing = store.get(val.key)
            store.set(val.key, {
              count: existing ? existing.count + 1 : val.count,
              expiresAt: val.expiresAt,
            })
            return Promise.resolve([])
          },
        }),
      }),
    } as unknown as Tx

    for (let i = 0; i < 5; i++) {
      await expect(
        assertTextClean(`消息 ${i}`, {
          userId: testUserId,
          action: 'chat',
          now: new Date(now.getTime() + i * 1000),
          db: persistedMockDb,
        }),
      ).resolves.toBeUndefined()
    }

    // 模拟进程重启（清空进程内 Map）
    resetModerationState()

    // 第 6 条消息仍读取持久化计数并触发 24h 冷静期
    await expect(
      assertTextClean('重启后第 6 条刷屏', {
        userId: testUserId,
        action: 'chat',
        now: new Date(now.getTime() + 6000),
        db: persistedMockDb,
      }),
    ).rejects.toMatchObject({
      code: 'USER_MUTED',
      status: 403,
    })

    // 再次模拟重启后查询静音状态仍生效
    resetModerationState()
    const status = await getUserMuteStatus(
      testUserId,
      new Date(now.getTime() + 15000),
      persistedMockDb,
    )
    expect(status.isMuted).toBe(true)
    expect(status.retryAfterSeconds).toBeGreaterThan(0)
  })
})
