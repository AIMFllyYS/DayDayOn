import 'server-only'
import type { PutRating, Rating } from '@/features/metric/schemas'
import { localDateOf } from '@/lib/time'
import type { DbOrTx } from '@/server/db/client'
import { dailyRatings } from '@/server/db/schema'
import { loadClock } from '../checkins/clock'

/**
 * PUT /ratings（PRD 2.5、7.2）：只能评今天（打卡日由服务端算，请求体不收日期）；
 * 同一天同一 scope 再评就覆盖。scope = overall（今日心情）或板块。
 */
export async function putRating(
  db: DbOrTx,
  userId: string,
  input: PutRating,
  now: Date,
): Promise<Rating> {
  const clock = await loadClock(db, userId)
  const localDate = localDateOf(now, clock.timeZone, clock.dayStartHour)
  const [row] = await db
    .insert(dailyRatings)
    .values({ userId, localDate, scope: input.scope, value: input.value })
    .onConflictDoUpdate({
      target: [dailyRatings.userId, dailyRatings.localDate, dailyRatings.scope],
      set: { value: input.value },
    })
    .returning({
      localDate: dailyRatings.localDate,
      scope: dailyRatings.scope,
      value: dailyRatings.value,
    })
  if (!row) throw new Error('putRating：写入没有返回行')
  return row
}
