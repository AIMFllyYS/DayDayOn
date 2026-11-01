import 'server-only'
import { and, desc, eq, gte } from 'drizzle-orm'
import type { Export, Me, UpdatePreferences, UpdateProfile } from '@/features/me/schemas'
import { addDays, calendarDateOf, localDateOf } from '@/lib/time'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx, Tx } from '@/server/db/client'
import { checkins, profiles, user } from '@/server/db/schema'
import { computeStreak } from '@/server/services/stats'
import { toMeDto, type MeRow } from './dto'
import { collectExport } from './export'
import { preferenceColumns, profileColumns } from './patch'

/*
 * 账号：当前用户、资料、偏好、导出、注销（PRD 2.11、7.1）。D1。
 * 每条查询都按 userId 过滤；返回值就是接口 DTO（MeSchema / ExportSchema）。
 */

const DEFAULT_TIME_ZONE = 'Asia/Shanghai'
const DEFAULT_DAY_START_HOUR = 4
/** 连续天数往回最多看这么多天：足够覆盖一年多的连续打卡，又不扫全表 */
const STREAK_LOOKBACK_DAYS = 400

async function loadMeRow(db: DbOrTx, userId: string): Promise<MeRow | null> {
  const [row] = await db
    .select({
      userId: user.id,
      email: user.email,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      nickname: profiles.nickname,
      avatar: profiles.avatar,
      gender: profiles.gender,
      birthYear: profiles.birthYear,
      heightCm: profiles.heightCm,
      timeZone: profiles.timeZone,
      dayStartHour: profiles.dayStartHour,
      leaderboardOptIn: profiles.leaderboardOptIn,
      onboardedAt: profiles.onboardedAt,
      theme: profiles.theme,
      mascot: profiles.mascot,
      remindAt: profiles.remindAt,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1)
  if (!row) return null
  // profile 行缺失（注册钩子失败、尚未补建）时按注册默认值展示
  return {
    ...row,
    timeZone: row.timeZone ?? DEFAULT_TIME_ZONE,
    dayStartHour: row.dayStartHour ?? DEFAULT_DAY_START_HOUR,
    leaderboardOptIn: row.leaderboardOptIn ?? false,
    theme: row.theme ?? 'caramel',
    mascot: row.mascot ?? 'tuan',
  }
}

/** 今天的打卡日（用户时区 + 日切换时间） */
export function todayOf(row: Pick<MeRow, 'timeZone' | 'dayStartHour'>, now: Date): string {
  return localDateOf(now, row.timeZone, row.dayStartHour)
}

async function loadStreak(db: DbOrTx, userId: string, today: string): Promise<number> {
  const rows = await db
    .selectDistinct({ localDate: checkins.localDate })
    .from(checkins)
    .where(
      and(
        eq(checkins.userId, userId),
        gte(checkins.localDate, addDays(today, -STREAK_LOOKBACK_DAYS)),
      ),
    )
    .orderBy(desc(checkins.localDate))
    .limit(STREAK_LOOKBACK_DAYS + 1)
  return computeStreak(
    rows.map((r) => r.localDate),
    today,
  )
}

/** GET /me。用户不存在（注销后会话残留）时 401 */
export async function getMe(db: DbOrTx, userId: string, now: Date): Promise<Me> {
  const row = await loadMeRow(db, userId)
  if (!row) throw new ApiError('UNAUTHENTICATED', '用户不存在或已注销')
  const streak = await loadStreak(db, userId, todayOf(row, now))
  return toMeDto(row, streak)
}

/** 确保 profile 行存在（注册钩子失败的老账号），后续一律只做 UPDATE */
export async function ensureProfile(tx: Tx, userId: string): Promise<void> {
  await tx.insert(profiles).values({ userId }).onConflictDoNothing({ target: profiles.userId })
}

/** PATCH /me/profile。改时区只影响之后的打卡，历史 localDate 不重算（PRD 3） */
export async function updateProfile(
  tx: Tx,
  userId: string,
  input: UpdateProfile,
  now: Date,
): Promise<Me> {
  await ensureProfile(tx, userId)
  await tx
    .update(profiles)
    .set({ ...profileColumns(input), updatedAt: now })
    .where(eq(profiles.userId, userId))
  return getMe(tx, userId, now)
}

/** PATCH /me/preferences：主题、形象、上榜、日切换时间、提醒时间 */
export async function updatePreferences(
  tx: Tx,
  userId: string,
  input: UpdatePreferences,
  now: Date,
): Promise<Me> {
  await ensureProfile(tx, userId)
  await tx
    .update(profiles)
    .set({ ...preferenceColumns(input), updatedAt: now })
    .where(eq(profiles.userId, userId))
  return getMe(tx, userId, now)
}

/** GET /me/export：只含本人数据 */
export async function exportMyData(
  db: DbOrTx,
  userId: string,
  now: Date,
): Promise<{ data: Export; localDate: string }> {
  const me = await getMe(db, userId, now)
  const rest = await collectExport(db, userId)
  return {
    data: { exportedAt: now.toISOString(), me, ...rest },
    localDate: calendarDateOf(now, me.profile.timeZone),
  }
}

/**
 * DELETE /me：删除 user 行，靠外键完成其余工作（PRD 2.11、3「注销」）：
 * profiles、goals、checkins、体重、满意度、待办、额度账户、幂等键、session、account、two_factor 级联删除；
 * ai_runs、quota_ledger、redeem_codes、redeem_attempts、admin_audit_logs 的用户外键置空，账本保留。
 * 会话行随 user 一起删除，之后任何请求都是 401；浏览器端的 cookie 由前端调 signOut 清掉。
 */
export async function deleteAccount(tx: Tx, userId: string): Promise<void> {
  const deleted = await tx.delete(user).where(eq(user.id, userId)).returning({ id: user.id })
  if (deleted.length === 0) throw new ApiError('UNAUTHENTICATED', '用户不存在或已注销')
}
