import 'server-only'
import { asc, eq, inArray } from 'drizzle-orm'
import type { Checkin } from '@/features/checkin/schemas'
import type { FieldDef, Goal } from '@/features/goal/schemas'
import type { Rating, WeightEntry } from '@/features/metric/schemas'
import type { Todo } from '@/features/todo/schemas'
import type { DbOrTx } from '@/server/db/client'
import {
  bodyMetrics,
  checkins,
  dailyRatings,
  goalFieldVersions,
  goals,
  todos,
} from '@/server/db/schema'

/*
 * GET /me/export 的数据收集（PRD 2.11）：资料之外的目标、打卡、体重、满意度、待办。
 * 每条查询都按 userId 过滤，不含其他用户的任何数据；元素形状沿用各领域的 DTO。
 * 上限：一个人几年的数据量远低于这些值，只是防止异常数据把一次导出撑爆内存（database.md 第 5 节）。
 */

const MAX_GOALS = 1_000
const MAX_CHECKINS = 50_000
const MAX_DAILY_ROWS = 20_000
const MAX_TODOS = 20_000

export interface ExportRest {
  goals: Goal[]
  checkins: Checkin[]
  weights: WeightEntry[]
  ratings: Rating[]
  todos: Todo[]
}

const iso = (d: Date) => d.toISOString()
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null)

async function exportGoals(db: DbOrTx, userId: string): Promise<Goal[]> {
  const rows = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(asc(goals.createdAt))
    .limit(MAX_GOALS)
  const customIds = rows.filter((g) => g.fieldVersion !== null).map((g) => g.id)
  const versions =
    customIds.length === 0
      ? []
      : await db
          .select({
            goalId: goalFieldVersions.goalId,
            version: goalFieldVersions.version,
            fields: goalFieldVersions.fields,
          })
          .from(goalFieldVersions)
          .where(inArray(goalFieldVersions.goalId, customIds))
  const fieldsOf = new Map<string, FieldDef[]>()
  for (const v of versions) fieldsOf.set(`${v.goalId}:${v.version}`, v.fields)

  return rows.map((g) => ({
    id: g.id,
    module: g.module,
    title: g.title,
    description: g.description,
    target: { kind: g.targetKind, value: g.targetValue },
    weekdays: g.weekdays,
    plannedTime: g.plannedTime,
    status: g.status,
    sortOrder: g.sortOrder,
    fieldVersion: g.fieldVersion,
    fields: g.fieldVersion === null ? null : (fieldsOf.get(`${g.id}:${g.fieldVersion}`) ?? null),
    createdAt: iso(g.createdAt),
    updatedAt: iso(g.updatedAt),
  }))
}

async function exportCheckins(db: DbOrTx, userId: string): Promise<Checkin[]> {
  const rows = await db
    .select()
    .from(checkins)
    .where(eq(checkins.userId, userId))
    .orderBy(asc(checkins.occurredAt))
    .limit(MAX_CHECKINS)
  return rows.map((c) => ({
    id: c.id,
    goalId: c.goalId,
    module: c.module,
    localDate: c.localDate,
    occurredAt: iso(c.occurredAt),
    source: c.source,
    isMakeup: c.isMakeup,
    durationSeconds: c.durationSeconds,
    count: c.count,
    intakeKcal: c.intakeKcal,
    burnKcal: c.burnKcal,
    note: c.note,
    parsedText: c.parsedText,
    payload: c.payload,
    fieldVersion: c.fieldVersion,
    aiRunId: c.aiRunId,
    createdAt: iso(c.createdAt),
  }))
}

async function exportWeights(db: DbOrTx, userId: string): Promise<WeightEntry[]> {
  const rows = await db
    .select({
      localDate: bodyMetrics.localDate,
      weightGrams: bodyMetrics.weightGrams,
      measuredAt: bodyMetrics.measuredAt,
    })
    .from(bodyMetrics)
    .where(eq(bodyMetrics.userId, userId))
    .orderBy(asc(bodyMetrics.localDate))
    .limit(MAX_DAILY_ROWS)
  return rows.map((w) => ({ ...w, measuredAt: iso(w.measuredAt) }))
}

async function exportRatings(db: DbOrTx, userId: string): Promise<Rating[]> {
  return db
    .select({
      localDate: dailyRatings.localDate,
      scope: dailyRatings.scope,
      value: dailyRatings.value,
    })
    .from(dailyRatings)
    .where(eq(dailyRatings.userId, userId))
    .orderBy(asc(dailyRatings.localDate))
    .limit(MAX_DAILY_ROWS)
}

async function exportTodos(db: DbOrTx, userId: string): Promise<Todo[]> {
  const rows = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, userId))
    .orderBy(asc(todos.createdAt))
    .limit(MAX_TODOS)
  return rows.map((t) => ({
    id: t.id,
    title: t.title,
    dueAt: isoOrNull(t.dueAt),
    priority: t.priority,
    doneAt: isoOrNull(t.doneAt),
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
  }))
}

export async function collectExport(db: DbOrTx, userId: string): Promise<ExportRest> {
  // 同一个连接上顺序执行：传进来的可能是事务句柄，事务里不能并发查询
  const goalList = await exportGoals(db, userId)
  const checkinList = await exportCheckins(db, userId)
  const weights = await exportWeights(db, userId)
  const ratings = await exportRatings(db, userId)
  const todoList = await exportTodos(db, userId)
  return { goals: goalList, checkins: checkinList, weights, ratings, todos: todoList }
}
