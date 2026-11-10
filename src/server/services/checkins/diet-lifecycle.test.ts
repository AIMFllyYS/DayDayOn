import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { buildConfirmPayload } from '@/features/checkin/flow/smart-session'
import { CreateCheckinSchema } from '@/features/checkin/schemas'
import { DEFAULT_GOALS } from '@/features/goal/defaults'
import { db } from '@/server/db/client'
import { aiRuns, profiles, user } from '@/server/db/schema'
import { createGoal } from '@/server/services/goals/create'
import { createCheckin } from './create'
import { deleteCheckin } from './mutate'
import { checkinToday, listCheckins } from './read'

try {
  process.loadEnvFile?.('.env.local')
} catch {
  // CI 或无 .env.local 环境直接读环境变量
}

const hasDb = Boolean(process.env.DATABASE_URL)

describe.runIf(hasDb)('真实数据库集成：饮食三餐两阶段结算、加餐硬覆盖与删除逆向重算闭环', () => {
  it('肥胖档 1/3 → 2/3 待汇总 → 3/3 控卡高分达标 → 炸鸡加餐硬覆盖 0 分 → 删加餐恢复 → 删晚餐退回 2/3', async () => {
    const userId = `test_diet_cycle_${crypto.randomUUID()}`
    const now = new Date('2026-11-10T04:00:00.000Z') // 北京时间 12:00

    await db.insert(user).values({
      id: userId,
      name: 'Diet Cycle User',
      email: `${userId}@test.local`,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(profiles).values({
      userId,
      nickname: '控卡测试员',
      timeZone: 'Asia/Shanghai',
      dayStartHour: 0,
      refereeTier: 'strict-fat-loss',
      onboardedAt: now,
    })

    try {
      const dietGoal = await db.transaction((tx) =>
        createGoal(tx, userId, DEFAULT_GOALS.diet, { today: '2026-11-10' }),
      )

      // 1. 早餐：仅吃 1 颗水煮蛋（约 72~85 kcal，0g 纤维）→ pending 1/3，不打单餐分
      const r1 = await createCheckin(
        db,
        userId,
        dietGoal.id,
        {
          module: 'diet',
          method: 'manual',
          mealType: 'breakfast',
          items: [{ name: '鸡蛋', portion: '1颗', kcal: 85 }],
          isMakeup: false,
          source: 'manual',
          origin: 'manual',
        },
        now,
      )
      expect(r1.checkin.verdict?.settlement).toBe('pending')
      expect(r1.checkin.score).toBeNull()
      expect(r1.checkin.isValid).toBe(false)
      expect(r1.progress).toEqual({ value: 1, target: 3, done: false })

      // 2. 午餐：糙米饭 + 清蒸鱼 → pending 2/3
      const r2 = await createCheckin(
        db,
        userId,
        dietGoal.id,
        {
          module: 'diet',
          method: 'manual',
          mealType: 'lunch',
          items: [
            { name: '糙米饭', portion: '1碗', kcal: 150 },
            { name: '清蒸鱼', portion: '1份', kcal: 160 },
          ],
          isMakeup: false,
          source: 'manual',
          origin: 'manual',
        },
        now,
      )
      expect(r2.checkin.verdict?.settlement).toBe('pending')
      expect(r2.checkin.score).toBeNull()
      expect(r2.checkin.isValid).toBe(false)
      expect(r2.progress).toEqual({ value: 2, target: 3, done: false })

      // 3. 晚餐：空腹控卡 → 集齐 3/3，统一结算全天高分并同步覆盖当日全部三餐记录！
      const r3 = await createCheckin(
        db,
        userId,
        dietGoal.id,
        {
          module: 'diet',
          method: 'manual',
          mealType: 'dinner',
          items: [{ name: '空腹', portion: '', kcal: 0 }],
          isMakeup: false,
          source: 'manual',
          origin: 'manual',
        },
        now,
      )
      expect(r3.checkin.verdict?.settlement).toBe('settled')
      expect(r3.checkin.isValid).toBe(true)
      expect(r3.checkin.score).not.toBeNull()
      expect(r3.checkin.score!).toBeGreaterThanOrEqual(4.3)
      expect(r3.progress).toEqual({ value: 3, target: 3, done: true })

      const afterThree = await listCheckins(db, userId, dietGoal.id, { limit: 10 })
      expect(afterThree.items).toHaveLength(3)
      expect(afterThree.items.every((c) => c.isValid && c.score === r3.checkin.score)).toBe(true)

      // 4. 加餐：炸鸡 + 可乐 → 触发一票否决硬覆盖，当日全部 4 条记录变为 0 分、未达标
      const r4 = await createCheckin(
        db,
        userId,
        dietGoal.id,
        {
          module: 'diet',
          method: 'manual',
          mealType: 'snack',
          snackTime: '22:30',
          items: [
            { name: '炸鸡', portion: '1份', kcal: 350 },
            { name: '可乐', portion: '1罐', kcal: 140 },
          ],
          isMakeup: false,
          source: 'manual',
          origin: 'manual',
        },
        now,
      )
      expect(r4.checkin.score).toBe(0)
      expect(r4.checkin.isValid).toBe(false)
      expect(r4.progress).toEqual({ value: 0, target: 3, done: false })

      // 5. 删除这条炸鸡加餐 → 自动重算剩余三餐，恢复达标总分与 3/3 完成进度！
      await deleteCheckin(db, userId, r4.checkin.id, { origin: 'manual' }, now)
      const todayAfterDeleteSnack = await checkinToday(db, userId, now)
      const dietToday1 = todayAfterDeleteSnack.goals.find((g) => g.goalId === dietGoal.id)
      expect(dietToday1?.progress).toEqual({ value: 3, target: 3, done: true })

      // 6. 再删除晚餐记录 → 剩余早+午两餐自动退回 2/3 pending 态（score=null, isValid=false）
      await deleteCheckin(db, userId, r3.checkin.id, { origin: 'manual' }, now)
      const afterDeleteDinner = await listCheckins(db, userId, dietGoal.id, { limit: 10 })
      expect(afterDeleteDinner.items).toHaveLength(2)
      expect(
        afterDeleteDinner.items.every(
          (c) => !c.isValid && c.score === null && c.verdict?.settlement === 'pending',
        ),
      ).toBe(true)
      const todayAfterDeleteDinner = await checkinToday(db, userId, now)
      const dietToday2 = todayAfterDeleteDinner.goals.find((g) => g.goalId === dietGoal.id)
      expect(dietToday2?.progress).toEqual({ value: 2, target: 3, done: false })
    } finally {
      await db.delete(user).where(eq(user.id, userId))
    }
  })

  it('智能拍照确认后同页切手动填写或记下一餐：剥离已消费 aiRunId 后正常入库，不再触发 409 CHECKIN_EXISTS', async () => {
    const userId = `test_smart_manual_${crypto.randomUUID()}`
    const now = new Date('2026-11-10T04:00:00.000Z')

    await db.insert(user).values({
      id: userId,
      name: 'Smart Manual User',
      email: `${userId}@test.local`,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(profiles).values({
      userId,
      nickname: '拍照切手动测试员',
      timeZone: 'Asia/Shanghai',
      dayStartHour: 0,
      refereeTier: 'balanced-glycemic',
      onboardedAt: now,
    })

    const [aiRun] = await db
      .insert(aiRuns)
      .values({
        userId,
        ip: '127.0.0.1',
        purpose: 'smart-recognition',
        promptVersion: 1,
        status: 'succeeded',
        dayKey: '2026-11-10',
      })
      .returning({ id: aiRuns.id })
    const aiRunId = aiRun!.id

    try {
      const dietGoal = await db.transaction((tx) =>
        createGoal(tx, userId, DEFAULT_GOALS.diet, { today: '2026-11-10' }),
      )

      // 1. 首餐通过智能拍照确认入库，占用 aiRunId
      const r1 = await createCheckin(
        db,
        userId,
        dietGoal.id,
        {
          module: 'diet',
          method: 'photo',
          mealType: 'breakfast',
          items: [{ name: '水煮蛋', portion: '2颗', kcal: 150 }],
          isMakeup: false,
          source: 'ai',
          aiRunId,
          parsedText: '两颗水煮蛋',
          origin: 'manual',
        },
        now,
      )
      expect(r1.checkin.source).toBe('ai')

      // 2. 若旧逻辑把已消费的 aiRunId 残留带入午餐提交，必然触发唯一索引冲突 409 CHECKIN_EXISTS
      await expect(
        createCheckin(
          db,
          userId,
          dietGoal.id,
          {
            module: 'diet',
            method: 'manual',
            mealType: 'lunch',
            items: [{ name: '糙米饭', portion: '1碗', kcal: 200 }],
            isMakeup: false,
            source: 'ai',
            aiRunId,
            origin: 'manual',
          },
          now,
        ),
      ).rejects.toMatchObject({ code: 'CHECKIN_EXISTS' })

      // 3. 修复后切手动填写（或首餐消费后 smart=null）：buildConfirmPayload 剥离残留 aiRunId，午餐顺利入库
      const manualPayload = CreateCheckinSchema.parse(
        buildConfirmPayload({
          subject: {
            module: 'diet',
            method: 'photo',
            mealType: 'lunch',
            items: [{ name: '糙米饭', portion: '', kcal: null }],
            note: null,
          },
          mode: 'manual',
          smart: {
            aiRunId,
            draft: {
              detectedModule: 'diet',
              matchedGoalId: dietGoal.id,
              confidence: 0.9,
              summary: '两颗水煮蛋',
              scanSteps: ['1', '2', '3'],
              exercise: null,
              diet: {
                mealType: 'breakfast',
                items: [{ name: '水煮蛋', portion: '2颗', kcal: 150 }],
                note: null,
              },
              sleep: null,
              study: null,
              custom: null,
            },
          },
          verdict: r1.checkin.verdict!,
        }),
      )

      const r2 = await createCheckin(db, userId, dietGoal.id, manualPayload, now)
      expect(r2.checkin.source).toBe('manual')
      expect(r2.checkin.payload.module === 'diet' && r2.checkin.payload.method).toBe('manual')

      const stored = await listCheckins(db, userId, dietGoal.id, {
        from: '2026-11-10',
        to: '2026-11-10',
        limit: 20,
      })
      expect(stored.items).toHaveLength(2)
    } finally {
      await db.delete(aiRuns).where(eq(aiRuns.id, aiRunId))
      await db.delete(user).where(eq(user.id, userId))
    }
  })
})
