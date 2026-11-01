import 'server-only'
import type { BetterAuthOptions } from 'better-auth'
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/server/db/client'
import { adminAuditLogs, profiles, user as userTable } from '@/server/db/schema'
import { openAccount } from '@/server/quota/ledger'
import { maybeAlert } from '@/server/quota/alerts'
import { spendDayKey } from '@/server/quota/period'
import { consume, type RateLimitRule } from '@/server/rate-limit'
import { getSettings } from '@/server/settings'
import { checkEmail } from './email-policy'
import { banInfo, isBanned } from './guards'
import { clientIp, LOCAL_IP } from './ip'
import { AUTH_PATHS } from './paths'

/*
 * Better Auth 的 hooks 与 databaseHooks（P1，auth.md 第 3、4 节，PRD 7.1、7.3）。
 * auth.ts 在 TODO(P1) 位置引用这里的导出；改端点路径只改 AUTH_PATHS。
 *
 * 错误体：Better Auth 的 APIError body 带 { code, message, ... }；本项目的 code 与 /api/v1 一致
 * （EMAIL_DOMAIN_NOT_ALLOWED、VALIDATION_FAILED、RATE_LIMITED、ACCOUNT_BANNED），前端按 code 取文案。
 */

const PATHS = AUTH_PATHS

const EMAIL_REJECT_MESSAGE = '暂时只支持 QQ、网易、Gmail、Outlook、iCloud 和华科邮箱'

function rateLimited(rule: RateLimitRule, retryAfterSeconds: number): APIError {
  return new APIError(
    'TOO_MANY_REQUESTS',
    { code: 'RATE_LIMITED', message: `太频繁了（${rule.name}）`, retryAfterSeconds },
    { 'Retry-After': String(retryAfterSeconds) },
  )
}

async function enforce(rule: RateLimitRule, subject: string): Promise<void> {
  const r = await consume(rule, subject)
  if (!r.ok) throw rateLimited(rule, r.retryAfterSeconds)
}

function readEmail(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const email = (body as { email?: unknown }).email
  return typeof email === 'string' ? email : null
}

/**
 * hooks.before：发送验证码与验证码登录两个端点上
 * 1. 邮箱规范化（返回修改后的 body）+ 白名单；
 * 2. 发送验证码：同邮箱 60 秒 1 次、每天 N 次；同 IP 每天 N 次（同 IP 每小时 5 次由 customRules 负责）。
 */
export const beforeHook = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== PATHS.sendOtp && ctx.path !== PATHS.signInOtp) return
  const raw = readEmail(ctx.body)
  if (raw === null) return
  const checked = checkEmail(raw)
  if (!checked.ok) {
    if (checked.reason === 'domain-not-allowed') {
      throw new APIError('BAD_REQUEST', {
        code: 'EMAIL_DOMAIN_NOT_ALLOWED',
        message: EMAIL_REJECT_MESSAGE,
      })
    }
    throw new APIError('BAD_REQUEST', {
      code: 'VALIDATION_FAILED',
      message: checked.reason === 'plus-address' ? '邮箱不支持 + 别名' : '邮箱格式不对',
      fields: {
        email: [checked.reason === 'plus-address' ? '邮箱不支持 + 别名' : '邮箱格式不对'],
      },
    })
  }

  if (ctx.path === PATHS.sendOtp) {
    const settings = await getSettings()
    const ip = clientIp(ctx.headers ?? ctx.request?.headers)
    await enforce({ name: 'otp-ip-daily', windowSeconds: 86_400, max: settings.otpPerIpDaily }, ip)
    await enforce({ name: 'otp-email-60s', windowSeconds: 60, max: 1 }, checked.email)
    await enforce(
      { name: 'otp-email-daily', windowSeconds: 86_400, max: settings.otpPerEmailDaily },
      checked.email,
    )
  }

  return { context: { body: { ...(ctx.body as Record<string, unknown>), email: checked.email } } }
})

/** 封号用户登录：admin 插件在建会话前抛 BANNED_USER，这里换成带 ban 信息的 ACCOUNT_BANNED */
async function rewriteBannedLogin(email: string | null): Promise<void> {
  if (!email) return
  const [row] = await db
    .select({
      banned: userTable.banned,
      banReason: userTable.banReason,
      banExpires: userTable.banExpires,
    })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1)
  if (!row || !isBanned(row, new Date())) return
  throw new APIError('FORBIDDEN', {
    code: 'ACCOUNT_BANNED',
    message: '账号已被停用',
    ban: banInfo(row),
  })
}

/** 管理员封号 / 解封 / 吊销会话成功后写 admin_audit_logs（PRD 7.3） */
async function auditAdminAction(
  action: string,
  adminId: string | null,
  body: Record<string, unknown>,
): Promise<void> {
  const targetId = typeof body.userId === 'string' ? body.userId : null
  const detail: Record<string, unknown> = {}
  if (typeof body.banReason === 'string') detail.banReason = body.banReason
  if (typeof body.banExpiresIn === 'number') detail.banExpiresIn = body.banExpiresIn
  await db.insert(adminAuditLogs).values({ adminId, action, targetType: 'user', targetId, detail })
}

const AUDITED: Partial<Record<string, string>> = {
  [PATHS.banUser]: 'user.ban',
  [PATHS.unbanUser]: 'user.unban',
  [PATHS.revokeUserSessions]: 'user.revoke-sessions',
}

/** hooks.after：封号登录改写；管理员操作审计 */
export const afterHook = createAuthMiddleware(async (ctx) => {
  const returned: unknown = ctx.context.returned
  if (ctx.path === PATHS.signInOtp) {
    if (isAPIError(returned) && returned.body?.code === 'BANNED_USER') {
      await rewriteBannedLogin(readEmail(ctx.body))
    }
    return
  }
  const action = AUDITED[ctx.path]
  if (!action) return
  if (isAPIError(returned)) return
  if (returned instanceof Response && !returned.ok) return
  const session = await getSessionFromCtx(ctx)
  try {
    await auditAdminAction(
      action,
      session?.user.id ?? null,
      (ctx.body ?? {}) as Record<string, unknown>,
    )
  } catch (error) {
    // 审计写失败不回滚已完成的封号，只记日志
    console.error('[auth] 审计日志写入失败', action, error instanceof Error ? error.message : error)
  }
})

type DatabaseHooks = NonNullable<BetterAuthOptions['databaseHooks']>
type HookContext = Parameters<
  NonNullable<NonNullable<NonNullable<DatabaseHooks['user']>['create']>['before']>
>[1]

function contextIp(context: HookContext): string {
  return clientIp(context?.headers ?? context?.request?.headers)
}

/**
 * 注册（user.create）：
 * - before：同一 IP 每天最多 N 个新账号（只数真正创建的账号，验证码输错不算）；
 * - after：一个事务里建 profiles（默认偏好、注册 IP）、quota_accounts（新账号首周额度）与 grant 流水。
 * after 失败只记日志：session.create.after 会补建 profile，账本在首次使用时补建额度行。
 */
export const databaseHooks: DatabaseHooks = {
  user: {
    create: {
      async before(_user, context) {
        if (!context) return
        const settings = await getSettings()
        const ip = contextIp(context)
        const rule = {
          name: 'signup-ip-daily',
          windowSeconds: 86_400,
          max: settings.signupPerIpDaily,
        }
        const r = await consume(rule, ip)
        if (!r.ok) {
          void maybeAlert('ip-multi-account', spendDayKey(new Date()), { ip, count: r.count })
          throw rateLimited(rule, r.retryAfterSeconds)
        }
      },
      async after(created, context) {
        const now = new Date()
        try {
          const settings = await getSettings()
          await db.transaction(async (tx) => {
            await tx
              .insert(profiles)
              .values({ userId: created.id, signupIp: context ? contextIp(context) : null })
              .onConflictDoNothing({ target: profiles.userId })
            await openAccount(tx, created.id, settings.newUserQuotaMicros, now)
          })
        } catch (error) {
          console.error('[auth] 新账号初始化失败', error instanceof Error ? error.message : error)
        }
      },
    },
  },
  session: {
    create: {
      /** 每次登录更新最近登录 IP；profile 缺失时顺便补建（PRD 2.1） */
      async after(session, context) {
        const ip = context ? contextIp(context) : (session.ipAddress ?? LOCAL_IP)
        try {
          await db
            .insert(profiles)
            .values({ userId: session.userId, signupIp: ip, lastLoginIp: ip })
            .onConflictDoUpdate({
              target: profiles.userId,
              set: { lastLoginIp: ip, updatedAt: sql`now()` },
            })
        } catch (error) {
          console.error(
            '[auth] 更新最近登录 IP 失败',
            error instanceof Error ? error.message : error,
          )
        }
      },
    },
  },
}
