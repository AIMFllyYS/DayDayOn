import 'server-only'
import { eq } from 'drizzle-orm'
import type { FriendMetricDetail } from '@/features/friend/schemas'
import {
  DEFAULT_DAILY_STEP_TARGET,
  type MetricCalendar,
  type MetricHistory,
  type MetricHistoryQuery,
  type MetricKind,
} from '@/features/metric/schemas'
import { BUSINESS_TIME_ZONE, localDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx } from '@/server/db/client'
import { profiles } from '@/server/db/schema'
import {
  listMetricHistory,
  metricCalendar,
  ratingTrend,
  stepTrend,
  weightTrend,
} from '@/server/services/metrics'
import { assertFriendship, loadPublicUsers } from './access'

/*
 * 好友每日指标（体重 / 心情 / 步数）只读查询服务（ADR-0026）：
 * - 全部经 assertFriendship 严格校验双向好友关系；
 * - 100% 复用 services/metrics 的 365 天走势、月度日历与游标分页查询，仅做读操作。
 */

const DETAIL_TREND_DAYS = 365

/** 查看指定好友某项每日指标的只读详情与近一年走势（附好友身高与步数参考虚线） */
export async function getFriendMetricDetail(
  db: DbOrTx,
  userId: string,
  friendUserId: string,
  kind: MetricKind,
  now: Date = new Date(),
): Promise<FriendMetricDetail> {
  await assertFriendship(db, userId, friendUserId)

  const [userMap, [profile], weight, mood, steps] = await Promise.all([
    loadPublicUsers(db, [friendUserId]),
    db
      .select({
        timeZone: profiles.timeZone,
        dayStartHour: profiles.dayStartHour,
        heightCm: profiles.heightCm,
        dailyStepTarget: profiles.dailyStepTarget,
      })
      .from(profiles)
      .where(eq(profiles.userId, friendUserId))
      .limit(1),
    kind === 'weight'
      ? weightTrend(db, friendUserId, DETAIL_TREND_DAYS, now)
      : Promise.resolve(undefined),
    kind === 'mood'
      ? ratingTrend(db, friendUserId, 'overall', DETAIL_TREND_DAYS, now)
      : Promise.resolve(undefined),
    kind === 'steps'
      ? stepTrend(db, friendUserId, DETAIL_TREND_DAYS, now)
      : Promise.resolve(undefined),
  ])

  const pub = userMap.get(friendUserId)
  if (!pub) {
    throw new ApiError('USER_NOT_FOUND', 'Friend user not found')
  }

  const localDate = localDateOf(
    now,
    profile?.timeZone ?? BUSINESS_TIME_ZONE,
    profile?.dayStartHour ?? 4,
  )
  const dailyStepTarget = profile ? profile.dailyStepTarget : DEFAULT_DAILY_STEP_TARGET

  return {
    kind,
    friend: {
      userId: pub.userId,
      nickname: pub.nickname,
      avatar: pub.avatar,
    },
    localDate,
    heightCm: profile?.heightCm ?? null,
    dailyStepTarget,
    ...(weight ? { weight } : {}),
    ...(mood ? { mood } : {}),
    ...(steps ? { steps } : {}),
  }
}

/** 查看指定好友某项每日指标的月度记录日历（只读） */
export async function getFriendMetricCalendar(
  db: DbOrTx,
  userId: string,
  friendUserId: string,
  kind: MetricKind,
  month: string,
): Promise<MetricCalendar> {
  await assertFriendship(db, userId, friendUserId)
  return metricCalendar(db, friendUserId, kind, month)
}

/** 查看指定好友某项每日指标的游标分页历史记录（只读） */
export async function getFriendMetricHistory(
  db: DbOrTx,
  userId: string,
  friendUserId: string,
  kind: MetricKind,
  query: MetricHistoryQuery,
): Promise<MetricHistory> {
  await assertFriendship(db, userId, friendUserId)
  return listMetricHistory(db, friendUserId, kind, query)
}
