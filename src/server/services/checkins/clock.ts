import 'server-only'
import { eq } from 'drizzle-orm'
import { BUSINESS_TIME_ZONE } from '@/lib/time'
import type { DbOrTx } from '@/server/db/client'
import { profiles } from '@/server/db/schema'
import type { Clock } from './rules'

/** 与 profiles 表默认日切换时间一致（4 点）；与 lib/time 零点换日的通用默认值区分 */
export const PROFILE_DEFAULT_DAY_START_HOUR = 4

/** 读取用户的时区与日切换时间；无资料行时回落到资料默认值（Asia/Shanghai，4 点） */
export async function loadClock(db: DbOrTx, userId: string): Promise<Clock> {
  const [row] = await db
    .select({ timeZone: profiles.timeZone, dayStartHour: profiles.dayStartHour })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1)
  return {
    timeZone: row?.timeZone ?? BUSINESS_TIME_ZONE,
    dayStartHour: row?.dayStartHour ?? PROFILE_DEFAULT_DAY_START_HOUR,
  }
}
