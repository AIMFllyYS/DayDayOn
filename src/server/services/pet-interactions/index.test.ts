import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { ApiError } from '@/server/api/errors'
import { db, type Tx } from '@/server/db/client'
import { friendships, goals, notifications, profiles, user } from '@/server/db/schema'
import { COOLDOWN_SECONDS, getPetInteractionsStatus, interactWithFriendPet } from './index'

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

describe.runIf(hasDb)('真实数据库集成：宠物轻互动服务与 Decision #5 履约', () => {
  it('好友小窝互动完整生命周期：好友校验、戳戳、投喂、提醒打卡、30分钟冷却与限额重置', async () => {
    await inRolledBackTx(async (tx) => {
      const actorId = 'test_actor_user'
      const targetFriendId = 'test_target_friend'
      const now = new Date('2026-11-02T10:00:00.000Z')

      // 1. 准备测试用户和个人资料
      await tx.insert(user).values([
        {
          id: actorId,
          name: 'Actor User',
          email: 'actor@test.local',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: targetFriendId,
          name: 'Friend User',
          email: 'friend@test.local',
          createdAt: now,
          updatedAt: now,
        },
      ])
      await tx.insert(profiles).values([
        { userId: actorId, nickname: '小满', avatar: 'mascot:tuan:cheer:exercise' },
        {
          userId: targetFriendId,
          nickname: '阿柚',
          avatar: 'mascot:you:happy:diet',
          mascot: 'you',
          timeZone: 'Asia/Tokyo', // 东京时区 (UTC+9)
          dayStartHour: 4, // 凌晨 04:00 换日
        },
      ])

      // 2. 非好友关系时尝试互动 → 抛出 404 FRIEND_NOT_FOUND
      await expect(
        interactWithFriendPet(tx, actorId, targetFriendId, { kind: 'poke' }, now),
      ).rejects.toThrowError(ApiError)

      // 建立双向好友关系
      await tx.insert(friendships).values([
        { userId: actorId, friendId: targetFriendId, createdAt: now, updatedAt: now },
        { userId: targetFriendId, friendId: actorId, createdAt: now, updatedAt: now },
      ])

      // 3. 初始状态查询：poke=0/3, feed=0/1, remind=0/1
      const initialStatus = await getPetInteractionsStatus(tx, actorId, targetFriendId, now)
      expect(initialStatus.friendUserId).toBe(targetFriendId)
      expect(initialStatus.actions.poke.used).toBe(0)
      expect(initialStatus.actions.poke.limit).toBe(3)
      expect(initialStatus.actions.feed.used).toBe(0)
      expect(initialStatus.actions.feed.limit).toBe(1)
      expect(initialStatus.actions.remind.used).toBe(0)
      expect(initialStatus.actions.remind.limit).toBe(1)
      // 好友尚未创建目标，今日休息日
      expect(initialStatus.remindEligible).toBe(false)
      expect(initialStatus.remindDisabledReason).toBe('今日休息')

      // 4. 为好友添加 2 个打卡目标
      await tx.insert(goals).values([
        {
          userId: targetFriendId,
          module: 'exercise',
          title: '晨间跑步 30 分钟',
          targetKind: 'duration',
          targetValue: 1800,
          createdAt: now,
          updatedAt: now,
        },
        {
          userId: targetFriendId,
          module: 'diet',
          title: '轻食打卡',
          targetKind: 'count',
          targetValue: 3,
          createdAt: now,
          updatedAt: now,
        },
      ])

      // 再次查询：今日有目标且未完成，可进行提醒
      const statusWithGoals = await getPetInteractionsStatus(tx, actorId, targetFriendId, now)
      expect(statusWithGoals.remindEligible).toBe(true)
      expect(statusWithGoals.remindDisabledReason).toBeNull()

      // 5. 首次戳戳（Poke #1）：应成功并插入互动和通知记录
      const poke1Result = await interactWithFriendPet(
        tx,
        actorId,
        targetFriendId,
        { kind: 'poke' },
        now,
      )
      expect(poke1Result.success).toBe(true)
      expect(poke1Result.interaction.kind).toBe('poke')
      expect(poke1Result.status.actions.poke.used).toBe(1)
      expect(poke1Result.status.actions.poke.cooldownLeftSec).toBe(COOLDOWN_SECONDS)

      // 6. 10 分钟后（600 秒，未满 30 分钟）再次戳戳 → 必须被 429 INTERACTION_COOLDOWN 拦截
      const tenMinutesLater = new Date(now.getTime() + 10 * 60 * 1000)
      await expect(
        interactWithFriendPet(tx, actorId, targetFriendId, { kind: 'poke' }, tenMinutesLater),
      ).rejects.toMatchObject({
        code: 'INTERACTION_COOLDOWN',
        extras: { retryAfterSeconds: 1200 },
      })

      // 7. 31 分钟后（已过 30 分钟冷却）执行 Poke #2 → 成功
      const thirtyOneMinutesLater = new Date(now.getTime() + 31 * 60 * 1000)
      const poke2Result = await interactWithFriendPet(
        tx,
        actorId,
        targetFriendId,
        { kind: 'poke' },
        thirtyOneMinutesLater,
      )
      expect(poke2Result.status.actions.poke.used).toBe(2)

      // 8. 62 分钟后执行 Poke #3 → 成功（达到每日上限 3 次）
      const sixtyTwoMinutesLater = new Date(now.getTime() + 62 * 60 * 1000)
      const poke3Result = await interactWithFriendPet(
        tx,
        actorId,
        targetFriendId,
        { kind: 'poke' },
        sixtyTwoMinutesLater,
      )
      expect(poke3Result.status.actions.poke.used).toBe(3)

      // 9. 95 分钟后再次尝试 Poke #4（已过冷却，但今日已达 3 次上限）→ 必须被 422 INTERACTION_DAILY_LIMIT_EXCEEDED 拦截
      const ninetyFiveMinutesLater = new Date(now.getTime() + 95 * 60 * 1000)
      await expect(
        interactWithFriendPet(
          tx,
          actorId,
          targetFriendId,
          { kind: 'poke' },
          ninetyFiveMinutesLater,
        ),
      ).rejects.toMatchObject({
        code: 'INTERACTION_DAILY_LIMIT_EXCEEDED',
      })

      // 10. 投喂（Feed #1）：投喂焦糖布丁 (pudding)
      const feedResult = await interactWithFriendPet(
        tx,
        actorId,
        targetFriendId,
        { kind: 'feed', treatId: 'pudding' },
        ninetyFiveMinutesLater,
      )
      expect(feedResult.success).toBe(true)
      expect(feedResult.interaction.treatId).toBe('pudding')
      expect(feedResult.feedback).toContain('焦糖布丁')
      expect(feedResult.status.actions.feed.used).toBe(1)

      // 再次投喂 → 429 或 422 拦截（今日已用完）
      const oneHundredMinutesLater = new Date(now.getTime() + 100 * 60 * 1000)
      await expect(
        interactWithFriendPet(
          tx,
          actorId,
          targetFriendId,
          { kind: 'feed', treatId: 'cookie' },
          oneHundredMinutesLater,
        ),
      ).rejects.toThrowError(ApiError)

      // 11. 提醒打卡（Remind #1）
      const remindResult = await interactWithFriendPet(
        tx,
        actorId,
        targetFriendId,
        { kind: 'remind' },
        oneHundredMinutesLater,
      )
      expect(remindResult.success).toBe(true)
      expect(remindResult.status.actions.remind.used).toBe(1)

      // 12. Decision #5 履约验证：目标好友时区换日跨天重置
      // 目标好友时区为 Asia/Tokyo (UTC+9)，日切换时间为 04:00
      // 当前基准时间为 UTC 2026-11-02 10:00:00（东京时间 2026-11-02 19:00:00）
      // 当推进到 UTC 2026-11-02 19:05:00（东京时间 2026-11-03 04:05:00，已跨越东京凌晨 4 点）
      const nextTokyoDay = new Date('2026-11-02T19:05:00.000Z')
      const nextDayStatus = await getPetInteractionsStatus(
        tx,
        actorId,
        targetFriendId,
        nextTokyoDay,
      )
      expect(nextDayStatus.targetLocalDate).toBe('2026-11-03')
      expect(nextDayStatus.actions.poke.used).toBe(0) // 次数完全刷新！
      expect(nextDayStatus.actions.feed.used).toBe(0)
      expect(nextDayStatus.actions.remind.used).toBe(0)

      // 在新的一天执行戳戳 → 成功！
      const newDayPoke = await interactWithFriendPet(
        tx,
        actorId,
        targetFriendId,
        { kind: 'poke' },
        nextTokyoDay,
      )
      expect(newDayPoke.success).toBe(true)
      expect(newDayPoke.status.actions.poke.used).toBe(1)

      // 13. 检查通知记录已真实写入 notifications 表
      const friendNotifications = await tx
        .select()
        .from(notifications)
        .where(eq(notifications.userId, targetFriendId))
      expect(friendNotifications.length).toBeGreaterThanOrEqual(3)
      const petNotifs = friendNotifications.filter((n) => n.kind === 'pet_interaction')
      expect(petNotifs.length).toBeGreaterThanOrEqual(3)
      expect(petNotifs.some((n) => n.title.includes('戳了戳'))).toBe(true)
      expect(petNotifs.some((n) => n.title.includes('焦糖布丁'))).toBe(true)
      expect(petNotifs.some((n) => n.title.includes('温柔提醒'))).toBe(true)
    })
  })
})
