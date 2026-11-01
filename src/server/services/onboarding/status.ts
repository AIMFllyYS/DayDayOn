import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db/client'
import { profiles } from '@/server/db/schema'

/** 引导完成时间；没有 profile 行或未完成时为 null（/onboarding 页面判断是否直接回主页） */
export async function getOnboardedAt(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ onboardedAt: profiles.onboardedAt })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1)
  return row?.onboardedAt ?? null
}
