import 'server-only'
import { and, eq, isNull } from 'drizzle-orm'
import type { Me, Onboarding } from '@/features/me/schemas'
import { localDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { Tx } from '@/server/db/client'
import { profiles } from '@/server/db/schema'
import { topUpWeekly } from '@/server/quota/ledger'
import { createGoal } from '@/server/services/goals/create'
import { ensureProfile, getMe } from '@/server/services/me'
import { upsertWeight } from '@/server/services/metrics/weight'
import { getSettings } from '@/server/settings'
import { planOnboarding } from './plan'

/*
 * POST /me/onboarding（PRD 2.2、7.1）。D1。调用方在一个事务里执行：
 * 写资料并记 onboardedAt → 为每个选中的板块建默认目标 → 填了体重就记一条 → 本周额度补到每周额度。
 * 任何一步失败整体回滚，引导保持未完成，用户可以直接重试。
 */
export async function completeOnboarding(
  tx: Tx,
  userId: string,
  input: Onboarding,
  now: Date,
): Promise<Me> {
  const plan = planOnboarding(input, now)
  await ensureProfile(tx, userId)

  // 带条件的 UPDATE 兼做并发保护：两次提交同时到达时只有一次能更新到行
  const [updated] = await tx
    .update(profiles)
    .set({ ...plan.profile, updatedAt: now })
    .where(and(eq(profiles.userId, userId), isNull(profiles.onboardedAt)))
    .returning({ timeZone: profiles.timeZone, dayStartHour: profiles.dayStartHour })
  if (!updated) throw new ApiError('ALREADY_ONBOARDED', '已经完成过新人引导')

  // 打卡日按刚写入的时区算（PRD 3：改时区只影响之后）
  const today = localDateOf(now, updated.timeZone, updated.dayStartHour)

  for (const goal of plan.goals) {
    await createGoal(tx, userId, goal, { today })
  }
  if (plan.weightGrams !== null) {
    // 首次记录没有"上一条"可比，跳过 3 kg 确认
    await upsertWeight(tx, userId, today, plan.weightGrams, {
      measuredAt: now,
      confirmLargeChange: true,
    })
  }
  const settings = await getSettings()
  await topUpWeekly(tx, userId, settings.weeklyQuotaMicros, now)

  return getMe(tx, userId, now)
}
