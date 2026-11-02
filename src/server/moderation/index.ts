import 'server-only'
import { createHash } from 'node:crypto'
import { and, desc, eq, gte } from 'drizzle-orm'
import { ApiError } from '@/server/api/errors'
import { db as defaultDb, type DbOrTx } from '@/server/db/client'
import { moderationViolations, type ModerationAction } from '@/server/db/schema'
import { checkText, type ModerationCheckResult } from './dfa'

export * from './dfa'

export interface AssertTextCleanOptions {
  userId: string
  action: ModerationAction
  now?: Date
  db?: DbOrTx
}

export interface UserMuteStatus {
  isMuted: boolean
  retryAfterSeconds?: number
  reason?: string
}

/** 频繁发送滑动窗口限制：10 秒内最多 5 条消息 */
export const SPAM_WINDOW_SECONDS = 10
export const SPAM_MAX_MESSAGES = 5

/** 静音冷静期时长：24 小时（86400 秒） */
export const MUTE_COOLING_SECONDS = 24 * 60 * 60
export const MAX_VIOLATIONS_BEFORE_MUTE = 5

interface UserSpamState {
  timestamps: number[]
  mutedUntil?: number
}

const userSpamStates = new Map<string, UserSpamState>()

/**
 * 重置防刷与静音内存状态（用于自动化测试）
 */
export function resetModerationState(): void {
  userSpamStates.clear()
}

/**
 * 计算输入文本的 SHA-256 哈希值（隐私安全合规，绝不存明文）
 */
export function hashContent(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/**
 * 查询指定用户当前的静音状态
 */
export async function getUserMuteStatus(
  userId: string,
  now: Date = new Date(),
  db: DbOrTx = defaultDb,
): Promise<UserMuteStatus> {
  const nowMs = now.getTime()

  // 1. 检查频控静音状态
  const spamState = userSpamStates.get(userId)
  if (spamState?.mutedUntil && spamState.mutedUntil > nowMs) {
    const retryAfterSeconds = Math.max(1, Math.ceil((spamState.mutedUntil - nowMs) / 1000))
    return {
      isMuted: true,
      retryAfterSeconds,
      reason: '发言过于频繁触发冷静期',
    }
  }

  // 2. 检查 24 小时内违规累计次数（≥5 次进入 24 小时冷静期）
  const twentyFourHoursAgo = new Date(nowMs - MUTE_COOLING_SECONDS * 1000)
  const recentViolations = await db
    .select({
      id: moderationViolations.id,
      createdAt: moderationViolations.createdAt,
    })
    .from(moderationViolations)
    .where(
      and(
        eq(moderationViolations.userId, userId),
        gte(moderationViolations.createdAt, twentyFourHoursAgo),
      ),
    )
    .orderBy(desc(moderationViolations.createdAt))

  if (recentViolations.length >= MAX_VIOLATIONS_BEFORE_MUTE) {
    const fifthViolation = recentViolations[MAX_VIOLATIONS_BEFORE_MUTE - 1]
    const unblocksAtMs = fifthViolation.createdAt.getTime() + MUTE_COOLING_SECONDS * 1000
    const retryAfterSeconds = Math.max(1, Math.ceil((unblocksAtMs - nowMs) / 1000))
    return {
      isMuted: true,
      retryAfterSeconds,
      reason: '24 小时内多次违规触发冷静期',
    }
  }

  return { isMuted: false }
}

/**
 * 文本审核与静音风控断言入口（Issue #23 & #24 · M5）
 *
 * 核心逻辑：
 * 1. 静音检查：24 小时内违规次数 ≥5 次，或 10 秒内发送消息超过 5 条，抛出 HTTP 403 USER_MUTED。
 * 2. DFA 敏感词检查：若命中敏感词，向 moderation_violations 写入脱敏审计日志（存 SHA-256 哈希，绝不存明文），并抛出 HTTP 422 CONTENT_SENSITIVE。
 */
export async function assertTextClean(
  text: string,
  options: AssertTextCleanOptions,
): Promise<void> {
  const targetDb = options.db ?? defaultDb
  const now = options.now ?? new Date()
  const nowMs = now.getTime()
  const { userId, action } = options

  // 1. 频控频次与静音校验
  let spamState = userSpamStates.get(userId)
  if (!spamState) {
    spamState = { timestamps: [] }
    userSpamStates.set(userId, spamState)
  }

  // 检查是否正处于频控冷静期中
  if (spamState.mutedUntil && spamState.mutedUntil > nowMs) {
    const retryAfterSeconds = Math.max(1, Math.ceil((spamState.mutedUntil - nowMs) / 1000))
    throw new ApiError('USER_MUTED', '发言过于频繁或多次触发违规，已暂时静音，请稍后再试', {
      retryAfterSeconds,
    })
  }

  // 检查 10 秒滑动窗口内的发送频次
  spamState.timestamps = spamState.timestamps.filter(
    (ts) => nowMs - ts <= SPAM_WINDOW_SECONDS * 1000,
  )
  if (spamState.timestamps.length >= SPAM_MAX_MESSAGES) {
    // 超过频次限制，触发 24 小时冷静期静音
    spamState.mutedUntil = nowMs + MUTE_COOLING_SECONDS * 1000
    const retryAfterSeconds = MUTE_COOLING_SECONDS
    throw new ApiError('USER_MUTED', '发言过于频繁或多次触发违规，已暂时静音，请稍后再试', {
      retryAfterSeconds,
    })
  }

  // 2. 检查 24 小时内违规记录次数
  const twentyFourHoursAgo = new Date(nowMs - MUTE_COOLING_SECONDS * 1000)
  const recentViolations = await targetDb
    .select({
      id: moderationViolations.id,
      createdAt: moderationViolations.createdAt,
    })
    .from(moderationViolations)
    .where(
      and(
        eq(moderationViolations.userId, userId),
        gte(moderationViolations.createdAt, twentyFourHoursAgo),
      ),
    )
    .orderBy(desc(moderationViolations.createdAt))

  if (recentViolations.length >= MAX_VIOLATIONS_BEFORE_MUTE) {
    const fifthViolation = recentViolations[MAX_VIOLATIONS_BEFORE_MUTE - 1]
    const unblocksAtMs = fifthViolation.createdAt.getTime() + MUTE_COOLING_SECONDS * 1000
    const retryAfterSeconds = Math.max(1, Math.ceil((unblocksAtMs - nowMs) / 1000))
    throw new ApiError('USER_MUTED', '发言过于频繁或多次触发违规，已暂时静音，请稍后再试', {
      retryAfterSeconds,
    })
  }

  // 3. DFA 敏感词内容匹配
  const checkResult: ModerationCheckResult = checkText(text)
  if (checkResult.flagged) {
    const contentHash = hashContent(text)

    // 记录违规审计日志（仅存 SHA-256，严禁明文入库）
    await targetDb.insert(moderationViolations).values({
      userId,
      action,
      category: checkResult.category ?? 'custom',
      contentHash,
      createdAt: now,
    })

    throw new ApiError('CONTENT_SENSITIVE', '内容包含敏感词，请修改后再发', {
      draft: text,
    })
  }

  // 4. 审核通过，记录本次发送时间戳
  spamState.timestamps.push(nowMs)
}
