import 'server-only'
import { eq } from 'drizzle-orm'
import { DEFAULT_DAY_START_HOUR } from '@/lib/time'
import type { DbOrTx } from '@/server/db/client'
import { profiles } from '@/server/db/schema'
import type { Clock } from './rules'

/** 用户的时区与日切换时间（固定凌晨 0 点零点刷新） */
export async function loadClock(db: DbOrTx, userId: string): Promise<Clock> {
  const [row] = await db
    .select({ timeZone: profiles.timeZone })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1)
  return { timeZone: row?.timeZone ?? 'Asia/Shanghai', dayStartHour: DEFAULT_DAY_START_HOUR }
}
