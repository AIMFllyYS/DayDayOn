import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { DEFAULT_GOALS } from '@/features/goal/defaults'
import { ApiError } from '@/server/api/errors'
import { db } from '@/server/db/client'
import { profiles, user } from '@/server/db/schema'
import { createGoal } from '@/server/services/goals/create'
import { createCheckin } from './create'
import { deleteCheckin, updateCheckin } from './mutate'
import { previewCreate, previewUpdate } from './preview'
import { listCheckins } from './read'

try {
  process.loadEnvFile?.('.env.local')
} catch {
  // CI 或无 .env.local 环境直接读环境变量
}

const hasDb = Boolean(process.env.DATABASE_URL)

async function createTestUser(now: Date) {
  const userId = `test_makeup_${crypto.randomUUID()}`
  await db.insert(user).values({
    id: userId,
    name: 'Makeup Test User',
    email: `${userId}@test.local`,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert(profiles).values({
    userId,
    nickname: '补卡测试员',
    timeZone: 'Asia/Shanghai',
    dayStartHour: 4,
    refereeTier: 'balanced-glycemic',
    onboardedAt: now,
  })
  return userId
}

describe.runIf(hasDb)('真实数据库集成：昨日补卡、原地覆盖保资格与学习双向重算闭环', () => {
  it('昨天已正常打卡，次日通过补卡覆盖重算时保留原 isMakeup=false 与 occurredAt，且睡眠 preview 不再报 409', async () => {
    const day1Now = new Date('2026-11-10T10:00:00.000Z') // 北京时间 11-10 18:00
    const day2Now = new Date('2026-11-11T04:00:00.000Z') // 北京时间 11-11 12:00（昨天=2026-11-10）
    const userId = await createTestUser(day1Now)

    try {
      const [exerciseGoal, sleepGoal] = await db.transaction(async (tx) => [
        await createGoal(tx, userId, DEFAULT_GOALS.exercise, { today: '2026-11-10' }),
        await createGoal(tx, userId, DEFAULT_GOALS.sleep, { today: '2026-11-10' }),
      ])

      // 1. 昨天正常打一条运动卡（isMakeup: false）
      const ex1 = await createCheckin(
        db,
        userId,
        exerciseGoal.id,
        {
          module: 'exercise',
          category: '慢跑',
          intensity: 'moderate',
          durationSeconds: 1800,
          isMakeup: false,
          source: 'manual',
          origin: 'manual',
        },
        day1Now,
      )
      expect(ex1.checkin.localDate).toBe('2026-11-10')
      expect(ex1.checkin.isMakeup).toBe(false)

      // 2. 次日通过补卡覆盖昨天运动记录 → 原地更新，保留 isMakeup=false 与原始 occurredAt
      const exPreview = await previewCreate(
        db,
        userId,
        exerciseGoal.id,
        {
          module: 'exercise',
          category: '慢跑',
          intensity: 'moderate',
          durationSeconds: 2400,
          isMakeup: true,
          source: 'manual',
          origin: 'agent',
        },
        day2Now,
      )
      expect(exPreview.willOverwrite).toBe(true)
      expect(exPreview.existingCheckinId).toBe(ex1.checkin.id)

      const ex2 = await createCheckin(
        db,
        userId,
        exerciseGoal.id,
        {
          module: 'exercise',
          category: '慢跑',
          intensity: 'moderate',
          durationSeconds: 2400,
          isMakeup: true,
          source: 'manual',
          origin: 'manual',
        },
        day2Now,
      )
      expect(ex2.checkin.id).toBe(ex1.checkin.id)
      expect(ex2.checkin.localDate).toBe('2026-11-10')
      expect(ex2.checkin.isMakeup).toBe(false)
      expect(ex2.checkin.occurredAt).toBe(ex1.checkin.occurredAt)
      expect(ex2.checkin.durationSeconds).toBe(2400)

      // 3. 昨天正常打一条睡眠卡（醒于 11-10 07:00，属于 11-10 打卡日）
      const sl1 = await createCheckin(
        db,
        userId,
        sleepGoal.id,
        {
          module: 'sleep',
          bedAt: '2026-11-09T15:00:00.000Z', // 23:00
          wakeAt: '2026-11-09T23:00:00.000Z', // 07:00
          quality: 3,
          isMakeup: false,
          source: 'manual',
          origin: 'manual',
        },
        day1Now,
      )
      expect(sl1.checkin.localDate).toBe('2026-11-10')

      // 次日 previewCreate 补昨天睡眠不再抛 409 CHECKIN_EXISTS，而是返回 willOverwrite=true
      const slPreview = await previewCreate(
        db,
        userId,
        sleepGoal.id,
        {
          module: 'sleep',
          bedAt: '2026-11-09T14:30:00.000Z', // 22:30
          wakeAt: '2026-11-09T23:00:00.000Z', // 07:00
          quality: 5,
          isMakeup: true,
          source: 'manual',
          origin: 'agent',
        },
        day2Now,
      )
      expect(slPreview.willOverwrite).toBe(true)
      expect(slPreview.existingCheckinId).toBe(sl1.checkin.id)

      const sl2 = await createCheckin(
        db,
        userId,
        sleepGoal.id,
        {
          module: 'sleep',
          bedAt: '2026-11-09T14:30:00.000Z',
          wakeAt: '2026-11-09T23:00:00.000Z',
          quality: 5,
          isMakeup: true,
          source: 'manual',
          origin: 'manual',
        },
        day2Now,
      )
      expect(sl2.checkin.id).toBe(sl1.checkin.id)
      expect(sl2.checkin.isMakeup).toBe(false)
      expect(sl2.checkin.payload.module === 'sleep' && sl2.checkin.payload.quality).toBe(5)
    } finally {
      await db.delete(user).where(eq(user.id, userId))
    }
  })

  it('学习板块双向重算：两段碎片累加达标后，PATCH 缩减或 DELETE 任一段会同步降级回未达标', async () => {
    const now = new Date('2026-11-12T06:00:00.000Z')
    const userId = await createTestUser(now)

    try {
      const studyGoal = await db.transaction((tx) =>
        createGoal(tx, userId, DEFAULT_GOALS.study, { today: '2026-11-12' }),
      )

      // 1. 第一段 15 分钟（未满 25 分钟门槛）→ 未达标
      const s1 = await createCheckin(
        db,
        userId,
        studyGoal.id,
        {
          module: 'study',
          what: '数据结构',
          durationSeconds: 15 * 60,
          points: ['整理了红黑树旋转的三种场景与时间复杂度'],
          isMakeup: false,
          source: 'manual',
          origin: 'manual',
        },
        now,
      )
      expect(s1.checkin.isValid).toBe(false)

      // 2. 第二段 15 分钟（累计 30 分钟 ≥ 25）→ 两段均升格为有效
      const s2 = await createCheckin(
        db,
        userId,
        studyGoal.id,
        {
          module: 'study',
          what: '操作系统',
          durationSeconds: 15 * 60,
          points: ['梳理了虚拟内存缺页中断与页面置换算法'],
          isMakeup: false,
          source: 'manual',
          origin: 'manual',
        },
        now,
      )
      expect(s2.checkin.isValid).toBe(true)
      const afterPromote = await listCheckins(db, userId, studyGoal.id, {
        from: '2026-11-12',
        to: '2026-11-12',
        limit: 10,
      })
      expect(afterPromote.items.every((c) => c.isValid)).toBe(true)

      // 3. PATCH 覆盖第二段缩短到 5 分钟（总计 20 < 25）→ 两条记录同步降级为未达标
      const updated = await updateCheckin(
        db,
        userId,
        s2.checkin.id,
        {
          replace: {
            module: 'study',
            what: '操作系统',
            durationSeconds: 5 * 60,
            points: ['梳理了虚拟内存缺页中断与页面置换算法'],
            isMakeup: false,
            source: 'manual',
            origin: 'manual',
          },
          origin: 'manual',
          reason: '实际只专注了 5 分钟',
        },
        now,
      )
      expect(updated.isValid).toBe(false)
      const afterDemote = await listCheckins(db, userId, studyGoal.id, {
        from: '2026-11-12',
        to: '2026-11-12',
        limit: 10,
      })
      expect(afterDemote.items.every((c) => !c.isValid)).toBe(true)

      // 4. PATCH 恢复到 20 分钟（总计 35 ≥ 25）→ 再次升格；再 DELETE 第二段 → 剩余 15 分钟降级回未达标
      await updateCheckin(
        db,
        userId,
        s2.checkin.id,
        {
          replace: {
            module: 'study',
            what: '操作系统',
            durationSeconds: 20 * 60,
            points: ['梳理了虚拟内存缺页中断与页面置换算法'],
            isMakeup: false,
            source: 'manual',
            origin: 'manual',
          },
          origin: 'manual',
          reason: '补回完整时长',
        },
        now,
      )
      await deleteCheckin(db, userId, s2.checkin.id, { origin: 'manual' }, now)
      const afterDelete = await listCheckins(db, userId, studyGoal.id, {
        from: '2026-11-12',
        to: '2026-11-12',
        limit: 10,
      })
      expect(afterDelete.items).toHaveLength(1)
      expect(afterDelete.items[0]!.isValid).toBe(false)
    } finally {
      await db.delete(user).where(eq(user.id, userId))
    }
  })

  it('饮食 PATCH 改餐次与同日其他餐次撞车时抛 409 CHECKIN_EXISTS，仅改备注会触发重判', async () => {
    const now = new Date('2026-11-13T06:00:00.000Z')
    const userId = await createTestUser(now)

    try {
      const dietGoal = await db.transaction((tx) =>
        createGoal(tx, userId, DEFAULT_GOALS.diet, { today: '2026-11-13' }),
      )
      const breakfast = await createCheckin(
        db,
        userId,
        dietGoal.id,
        {
          module: 'diet',
          method: 'manual',
          mealType: 'breakfast',
          items: [{ name: '鸡蛋', portion: '1颗', kcal: 80 }],
          isMakeup: false,
          source: 'manual',
          origin: 'manual',
        },
        now,
      )
      const lunch = await createCheckin(
        db,
        userId,
        dietGoal.id,
        {
          module: 'diet',
          method: 'manual',
          mealType: 'lunch',
          items: [{ name: '鸡胸肉', portion: '1份', kcal: 200 }],
          isMakeup: false,
          source: 'manual',
          origin: 'manual',
        },
        now,
      )

      await expect(
        updateCheckin(
          db,
          userId,
          lunch.checkin.id,
          {
            replace: {
              module: 'diet',
              method: 'manual',
              mealType: 'breakfast',
              items: [{ name: '鸡胸肉', portion: '1份', kcal: 200 }],
              isMakeup: false,
              source: 'manual',
              origin: 'manual',
            },
            origin: 'manual',
          },
          now,
        ),
      ).rejects.toSatisfy((e: unknown) => e instanceof ApiError && e.code === 'CHECKIN_EXISTS')

      const notePreview = await previewUpdate(
        db,
        userId,
        breakfast.checkin.id,
        { note: '空腹' },
        now,
      )
      expect(notePreview.verdict).not.toBeNull()
      expect(notePreview.next.note).toBe('空腹')
    } finally {
      await db.delete(user).where(eq(user.id, userId))
    }
  })
})
