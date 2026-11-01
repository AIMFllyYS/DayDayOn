import type { BetterAuthPlugin } from 'better-auth'
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api'
import { twoFactor } from 'better-auth/plugins'
import { checkAdmin } from './guards'
import { AUTH_PATHS } from './paths'

/*
 * 管理员两步验证的强制执行（auth.md 第 6 节、ADR-0002 第 7 节）。
 *
 * better-auth@1.7.14 的 twoFactor 插件只在 /sign-in/email、/sign-in/username、/sign-in/phone-number
 * 之后检查两步验证；本项目唯一的登录方式 /sign-in/email-otp 不在其中，开了两步验证的管理员
 * 只凭邮箱验证码就能拿到完整会话。这里把插件自己的 after-hook 也挂到 /sign-in/email-otp 上：
 * 开了两步验证的用户登录后会话被删掉，返回 { twoFactorRedirect: true }，必须再过 /two-factor/verify-totp。
 *
 * admin 插件的 /api/auth/admin/* 只校验 role：这里只放行产品用到的封号 / 解封 / 吊销会话，
 * 并且和 /api/v1 的 requireAdmin 一样要求已开启两步验证。其余（代登录、改角色、改用户、删用户…）一律拒绝。
 *
 * 不碰数据库：只用 Better Auth 的 ctx，便于用内存适配器测试（two-factor-gate.test.ts）。
 */

/** admin 插件里产品用到的端点；其余全部拒绝（auth.md 第 6 节：v0.1 不用代登录、不定义自定义角色） */
export const ALLOWED_ADMIN_PATHS: ReadonlySet<string> = new Set([
  AUTH_PATHS.banUser,
  AUTH_PATHS.unbanUser,
  AUTH_PATHS.revokeUserSessions,
])

/** 关掉两步验证只凭会话即可（allowPasswordless），产品里没有这个入口：一律拒绝，需要时走服务器操作 */
export const TWO_FACTOR_DISABLE_PATH = '/two-factor/disable'
const VERIFY_TOTP_PATH = '/two-factor/verify-totp'

export type AdminPathDecision = 'not-admin' | 'allowed' | 'blocked'

/** Better Auth 端点路径的分类：admin 插件端点是否在放行名单里 */
export function classifyAuthPath(path: string): AdminPathDecision {
  if (path === TWO_FACTOR_DISABLE_PATH) return 'blocked'
  if (!path.startsWith('/admin/')) return 'not-admin'
  return ALLOWED_ADMIN_PATHS.has(path) ? 'allowed' : 'blocked'
}

const forbidden = (code: string, message: string) => new APIError('FORBIDDEN', { code, message })

/** 两步验证门禁插件：必须放在 twoFactor 插件之后（复用它的 after-hook） */
function twoFactorGate(twoFactorPlugin: ReturnType<typeof twoFactor>): BetterAuthPlugin {
  const pluginAfter = twoFactorPlugin.hooks.after[0]
  if (!pluginAfter) throw new Error('twoFactor 插件缺少登录后的 hook')

  return {
    id: 'daydayon-two-factor-gate',
    hooks: {
      before: [
        {
          matcher: (ctx) => classifyAuthPath(ctx.path ?? '') !== 'not-admin',
          handler: createAuthMiddleware(async (ctx) => {
            if (classifyAuthPath(ctx.path) === 'blocked') {
              throw forbidden('FORBIDDEN', '这个操作没有开放')
            }
            const session = await getSessionFromCtx(ctx)
            if (!session) throw new APIError('UNAUTHORIZED', { code: 'UNAUTHENTICATED' })
            // admin / twoFactor 插件给 user 加的字段不在通用会话类型里：只取这两个
            const u = session.user as { role?: string | null; twoFactorEnabled?: boolean | null }
            const error = checkAdmin({ role: u.role, twoFactorEnabled: u.twoFactorEnabled })
            if (error) throw forbidden(error.code, error.message)
          }),
        },
      ],
      after: [
        {
          // 与插件自己的 /sign-in/email 逻辑完全相同：删会话、种 two_factor cookie、返回 twoFactorRedirect
          matcher: (ctx) => ctx.path === AUTH_PATHS.signInOtp,
          handler: pluginAfter.handler,
        },
        {
          /*
           * 绑定两步验证（带着已有会话 verify-totp 成功）时，吊销这个用户的其他会话：
           * 绑定前在别处登录的会话没有过两步验证，不能因为 twoFactorEnabled 变成 true 就拿到后台权限。
           */
          matcher: (ctx) => ctx.path === VERIFY_TOTP_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            if (isAPIError(ctx.context.returned)) return
            const previous = ctx.context.session
            const fresh = ctx.context.newSession
            if (!previous || !fresh) return
            const sessions = await ctx.context.internalAdapter.listSessions(fresh.user.id)
            for (const s of sessions) {
              if (s.token !== fresh.session.token) {
                await ctx.context.internalAdapter.deleteSession(s.token)
              }
            }
          }),
        },
      ],
    },
  }
}

/**
 * twoFactor 插件 + 门禁插件，auth.ts 的 plugins 里展开使用。
 * 只有验证码登录、没有密码账号：不允许免密的话 twoFactor.enable 永远报 INVALID_PASSWORD。
 */
export function twoFactorPlugins(): [ReturnType<typeof twoFactor>, BetterAuthPlugin] {
  const plugin = twoFactor({ issuer: 'DayDayOn', allowPasswordless: true })
  return [plugin, twoFactorGate(plugin)]
}
