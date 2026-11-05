import 'server-only'
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import { checkinToEntry } from '@/features/agent/checkin-entry'
import { isAgentEditable } from '@/features/checkin/edit-window'
import { checkinSummary } from '@/features/checkin/format'
import type { CheckinRevision } from '@/features/checkin/schemas'
import type { FieldDef } from '@/features/goal/schemas'
import { effectiveRules, isDefaultRules } from '@/features/referee/defaults'
import type { LocalDate } from '@/features/shared/schemas'
import { addDays, localDateOf } from '@/lib/time'
import { db } from '@/server/db/client'
import { bodyMetrics, checkins, goals, profiles } from '@/server/db/schema'
import { checkinToday } from '@/server/services/checkins/read'
import { loadClock } from '@/server/services/checkins/clock'
import { checkinColumns, loadFields, loadGoal, toCheckinDto } from '@/server/services/checkins/goal'
import { listRecentRevisions, listRevisions } from '@/server/services/checkins/revisions'
import { getFriendDashboard, listFriends } from '@/server/services/friends'
import { weightTrend } from '@/server/services/metrics/weight'
import { listTodos } from '@/server/services/todos'

/*
 * Agent 读工具的数据来源。每个函数都是只读查询、带 userId 条件，返回可直接 JSON 序列化的结果。
 * 只给模型看必要字段，不返回整行（database.md 第 5 节）。打卡一律带上分数、是否有效和结论摘要，
 * 让团团回答「达标没」时和统计口径一致（未达标的只存档，不计进度）。
 */

export async function getProfile(userId: string) {
  const [row] = await db
    .select({
      nickname: profiles.nickname,
      gender: profiles.gender,
      birthYear: profiles.birthYear,
      heightCm: profiles.heightCm,
      mascot: profiles.mascot,
      refereeTier: profiles.refereeTier,
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1)
  return row ?? null
}

const goalsColumns = {
  id: goals.id,
  module: goals.module,
  title: goals.title,
  targetKind: goals.targetKind,
  targetValue: goals.targetValue,
  weekdays: goals.weekdays,
  plannedTime: goals.plannedTime,
  fieldVersion: goals.fieldVersion,
  refereeRules: goals.refereeRules,
  deadlineDate: goals.deadlineDate,
}

/** 进行中的目标（供模型选 goalId 打卡），按 sortOrder；带达标规则，自定义目标附带字段定义 */
export async function listGoals(userId: string) {
  const rows = await db
    .select(goalsColumns)
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, 'active')))
    .orderBy(asc(goals.sortOrder), asc(goals.id))
    .limit(100)
  return Promise.all(
    rows.map(async ({ refereeRules, ...g }) => {
      const rules = effectiveRules(g.module, refereeRules)
      const out = { ...g, rules, rulesCustomized: !isDefaultRules(rules) }
      if (g.module !== 'custom' || g.fieldVersion === null) return out
      const fields = await loadFields(db, g.id, g.fieldVersion)
      return { ...out, fields: fields ?? [] }
    }),
  )
}

/** 今天（含体重、心情、各目标进度、完成度） */
export async function getTodaySummary(userId: string, now: Date) {
  return checkinToday(db, userId, now)
}

/** 待办（进行中） */
export async function getOpenTodos(userId: string, now: Date) {
  return listTodos(db, userId, { status: 'open', limit: 50 }, now)
}

/** 最近 days 天体重 + 最近一条 + 7 天差值 */
export async function getWeight(userId: string, now: Date, days = 30) {
  return weightTrend(db, userId, days, now)
}

/** 自定义目标各字段版本的缓存读取 */
function fieldsLoader() {
  const cache = new Map<string, Promise<FieldDef[] | null>>()
  return (goalId: string, version: number | null) => {
    if (version === null) return Promise.resolve(null)
    const key = `${goalId}:${version}`
    let hit = cache.get(key)
    if (!hit) {
      hit = loadFields(db, goalId, version)
      cache.set(key, hit)
    }
    return hit
  }
}

/**
 * 某段打卡日（含两端）内的打卡记录，跨目标或只看一个目标。from/to 缺省为最近 7 天。
 * owner = 'friend' 时不给 editable（好友的打卡只能看）。
 */
export async function listCheckinsInRange(
  userId: string,
  now: Date,
  range: { from?: LocalDate; to?: LocalDate; goalId?: string },
  owner: 'self' | 'friend' = 'self',
) {
  const clock = await loadClock(db, userId)
  const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
  const from = range.from ?? addDays(today, -6)
  const to = range.to ?? today
  const rows = await db
    .select({ ...checkinColumns, goalTitle: goals.title })
    .from(checkins)
    .innerJoin(goals, eq(goals.id, checkins.goalId))
    .where(
      and(
        eq(checkins.userId, userId),
        gte(checkins.localDate, from),
        lte(checkins.localDate, to),
        range.goalId === undefined ? undefined : eq(checkins.goalId, range.goalId),
      ),
    )
    .orderBy(asc(checkins.localDate), asc(checkins.occurredAt))
    .limit(500)
  const fieldsOf = fieldsLoader()
  return Promise.all(
    rows.map(async ({ goalTitle, ...row }) => {
      const c = toCheckinDto(row)
      const fields = c.module === 'custom' ? await fieldsOf(c.goalId, c.fieldVersion) : null
      return {
        ...(owner === 'self' ? { checkinId: c.id } : {}),
        goalId: c.goalId,
        goalTitle,
        module: c.module,
        localDate: c.localDate,
        isMakeup: c.isMakeup,
        source: c.source,
        summary: checkinSummary(c, fields),
        note: c.note,
        score: c.score,
        isValid: c.isValid,
        verdict: c.verdict?.detail ?? null,
        ...(owner === 'self' ? { editable: isAgentEditable(c.localDate, today) } : {}),
      }
    }),
  )
}

/** 一条打卡的完整内容：entry 是可以直接改了交回 draftUpdateCheckin 的形状 */
export async function getCheckinDetail(userId: string, checkinId: string, now: Date) {
  const [row] = await db
    .select(checkinColumns)
    .from(checkins)
    .where(and(eq(checkins.id, checkinId), eq(checkins.userId, userId)))
    .limit(1)
  if (!row) {
    return {
      found: false as const,
      error: '没有这条打卡（可能已经删除），可以用 getCheckinHistory 查留痕',
    }
  }
  const c = toCheckinDto(row)
  const [goal, clock] = await Promise.all([loadGoal(db, userId, c.goalId), loadClock(db, userId)])
  const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
  const fields =
    c.module === 'custom' && c.fieldVersion !== null
      ? await loadFields(db, c.goalId, c.fieldVersion)
      : null
  return {
    found: true as const,
    checkinId: c.id,
    goalId: c.goalId,
    goalTitle: goal.title,
    module: c.module,
    localDate: c.localDate,
    isMakeup: c.isMakeup,
    summary: checkinSummary(c, fields),
    entry: checkinToEntry(c),
    note: c.note,
    score: c.score,
    isValid: c.isValid,
    verdict: c.verdict
      ? {
          detail: c.verdict.detail,
          offline: c.verdict.offline,
          checks: c.verdict.checks.map((k) => ({ text: k.text, ok: k.ok })),
          advice: c.verdict.advice,
        }
      : null,
    editable: isAgentEditable(c.localDate, today),
    ...(fields ? { fields } : {}),
  }
}

function revisionView(r: CheckinRevision) {
  const snap = (c: CheckinRevision['before']) =>
    c ? { summary: checkinSummary(c), note: c.note, score: c.score, isValid: c.isValid } : null
  return {
    checkinId: r.checkinId,
    goalId: r.goalId,
    module: r.module,
    localDate: r.localDate,
    action: r.action,
    origin: r.origin,
    reason: r.reason,
    at: r.createdAt,
    before: snap(r.before),
    after: snap(r.after),
  }
}

/** 留痕：给 checkinId 查这一条的全部历史；不给就看最近 20 次改动 */
export async function getCheckinHistory(userId: string, checkinId?: string) {
  if (checkinId === undefined) {
    return { revisions: (await listRecentRevisions(db, userId, 20)).map(revisionView) }
  }
  try {
    return { revisions: (await listRevisions(db, userId, checkinId)).items.map(revisionView) }
  } catch {
    const [exists] = await db
      .select({ id: checkins.id })
      .from(checkins)
      .where(and(eq(checkins.id, checkinId), eq(checkins.userId, userId)))
      .limit(1)
    return exists
      ? { revisions: [], note: '这条打卡还没被改过（留痕功能上线前记的打卡没有「新增」那一条）' }
      : { revisions: [], error: '没有这条打卡，也没有它的留痕' }
  }
}

/** 最近的体重记录（运动消耗估算用） */
export async function latestWeight(userId: string) {
  const [row] = await db
    .select({ weightGrams: bodyMetrics.weightGrams, localDate: bodyMetrics.localDate })
    .from(bodyMetrics)
    .where(eq(bodyMetrics.userId, userId))
    .orderBy(desc(bodyMetrics.localDate))
    .limit(1)
  return row ?? null
}

/** 读取用户的好友列表及每位好友今日完成度、连续打卡天数、今日心情 */
export async function getFriendsOverview(userId: string, now: Date) {
  return listFriends(db, userId, now)
}

/** 读取某位好友（支持传入 friendUserId 或昵称）的完整打卡仪表盘与近 N 天打卡记录（只读） */
export async function getFriendStatusDetail(
  userId: string,
  friendIdOrNickname: string,
  now: Date,
  days = 7,
) {
  const list = await listFriends(db, userId, now)
  const q = friendIdOrNickname.trim()
  const matched =
    list.friends.find((f) => f.userId === q) ??
    list.friends.find((f) => f.nickname === q || f.nickname.includes(q))

  if (!matched) {
    return {
      found: false as const,
      error: `未在你的好友列表中找到「${friendIdOrNickname}」，可先调用 listFriends 查看好友列表`,
      availableFriends: list.friends.map((f) => ({ userId: f.userId, nickname: f.nickname })),
    }
  }

  const { friend, dashboard } = await getFriendDashboard(db, userId, matched.userId, now)
  const clock = await loadClock(db, matched.userId)
  const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
  const safeDays = Math.min(30, Math.max(1, days))
  const recentCheckins = await listCheckinsInRange(
    matched.userId,
    now,
    { from: addDays(today, -(safeDays - 1)), to: today },
    'friend',
  )

  return {
    found: true as const,
    friend,
    dashboard,
    recentCheckins,
    note: '好友的打卡只能查看，不能修改；isValid=false 的是未达标的存档记录，不计入进度',
  }
}
