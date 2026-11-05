import 'server-only'
import { and, asc, desc, eq } from 'drizzle-orm'
import type {
  Checkin,
  CheckinOrigin,
  CheckinRevision,
  CheckinRevisionList,
} from '@/features/checkin/schemas'
import { ApiError } from '@/server/api/errors'
import type { DbOrTx } from '@/server/db/client'
import { checkinRevisions, type CheckinRevisionAction } from '@/server/db/schema'

/*
 * 打卡留痕（checkin-modules.md 第 7 节）。新增、修改、删除都在同一个事务里写一行，
 * 打卡回滚时留痕一起回滚；打卡删掉后留痕保留。
 */

export async function recordRevision(
  db: DbOrTx,
  input: {
    userId: string
    action: CheckinRevisionAction
    origin: CheckinOrigin
    reason?: string | null
    before: Checkin | null
    after: Checkin | null
  },
): Promise<void> {
  const subject = input.after ?? input.before
  if (!subject) throw new Error('recordRevision：before 和 after 不能都为空')
  await db.insert(checkinRevisions).values({
    userId: input.userId,
    checkinId: subject.id,
    goalId: subject.goalId,
    module: subject.module,
    localDate: subject.localDate,
    action: input.action,
    origin: input.origin,
    reason: input.reason ?? null,
    before: input.before,
    after: input.after,
  })
}

const revisionColumns = {
  id: checkinRevisions.id,
  checkinId: checkinRevisions.checkinId,
  goalId: checkinRevisions.goalId,
  module: checkinRevisions.module,
  localDate: checkinRevisions.localDate,
  action: checkinRevisions.action,
  origin: checkinRevisions.origin,
  reason: checkinRevisions.reason,
  before: checkinRevisions.before,
  after: checkinRevisions.after,
  createdAt: checkinRevisions.createdAt,
}

type RevisionRow = Pick<typeof checkinRevisions.$inferSelect, keyof typeof revisionColumns>

function toRevisionDto(row: RevisionRow): CheckinRevision {
  return { ...row, createdAt: row.createdAt.toISOString() }
}

/** GET /checkins/{checkinId}/revisions：按时间正序；打卡已删除也能查到 */
export async function listRevisions(
  db: DbOrTx,
  userId: string,
  checkinId: string,
): Promise<CheckinRevisionList> {
  const rows = await db
    .select(revisionColumns)
    .from(checkinRevisions)
    .where(and(eq(checkinRevisions.userId, userId), eq(checkinRevisions.checkinId, checkinId)))
    .orderBy(asc(checkinRevisions.createdAt), asc(checkinRevisions.id))
    .limit(200)
  if (rows.length === 0) throw new ApiError('CHECKIN_NOT_FOUND', '没有这条打卡的记录')
  return { items: rows.map(toRevisionDto) }
}

/** 最近的留痕（跨打卡，新的在前），Agent 回答「我最近改过什么」用 */
export async function listRecentRevisions(
  db: DbOrTx,
  userId: string,
  limit = 20,
): Promise<CheckinRevision[]> {
  const rows = await db
    .select(revisionColumns)
    .from(checkinRevisions)
    .where(eq(checkinRevisions.userId, userId))
    .orderBy(desc(checkinRevisions.createdAt), desc(checkinRevisions.id))
    .limit(Math.min(50, Math.max(1, limit)))
  return rows.map(toRevisionDto)
}
