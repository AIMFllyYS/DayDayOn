import 'server-only'
import { eq } from 'drizzle-orm'
import { DEFAULT_DAY_START_HOUR } from '@/lib/time'
import type { DbOrTx } from '@/server/db/client'
import { profiles } from '@/server/db/schema'
import type { Clock } from './rules'

/** 用户的时区与日切换时间（PRD 3：打卡日按资料里的时区算） */
export async function loadClock(db: DbOrTx, userId: string): Promise<Clock> {
  const [row] = await db
    .select({ timeZone: profiles.timeZone, dayStartHour: profiles.dayStartHour })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1)
  return row ?? { timeZone: 'Asia/Shanghai', dayStartHour: DEFAULT_DAY_START_HOUR }
}
