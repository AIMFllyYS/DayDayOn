import 'server-only'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, emailOTP, twoFactor } from 'better-auth/plugins'
import { db } from '@/server/db/client'
import * as schema from '@/server/db/schema'
import { env } from '@/server/env'
import { sendOtp } from '@/server/mail'

/*
 * 全项目唯一的 Better Auth 实例（auth.md 第 1、2 节）。业务代码不直接 import 本文件，
 * 用 src/server/auth/index.ts 导出的 getSession / requireUser。
 *
 * 归属：表结构相关配置（plugins、database）由 F1 维护；hooks、databaseHooks 的逻辑由 P1 实现（PRD 7.1）。
 * 改 plugins 后要重新生成 src/server/db/schema/auth.ts（database.md 第 8 节）。
 */

/** Better Auth 端点路径（better-auth@1.7.14 email-otp 插件源码核对过），限流与 hooks 只引用这里 */
export const AUTH_PATHS = {
  sendOtp: '/email-otp/send-verification-otp',
  signInOtp: '/sign-in/email-otp',
} as const

export const auth = betterAuth({
  appName: 'DayDayOn',
  // 懒读取：getter 让 next build 加载本模块时不触发环境变量校验
  get secret() {
    return env.BETTER_AUTH_SECRET
  },
  get baseURL() {
    return env.BETTER_AUTH_URL
  },
  trustedOrigins: () => [env.NEXT_PUBLIC_APP_URL],
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  // 只用邮箱验证码登录
  emailAndPassword: { enabled: false },
  telemetry: { enabled: false },
  rateLimit: {
    enabled: true,
    storage: 'database',
    customRules: {
      // ADR-0002 第 6 节：同一 IP 每小时最多发 5 次验证码（写死不可调，PRD 7.3）
      [AUTH_PATHS.sendOtp]: { window: 3600, max: 5 },
    },
  },
  advanced: {
    // 只信任 Nginx 写入的 X-Real-IP；默认的 x-forwarded-for 最左值可伪造
    ipAddress: { ipAddressHeaders: ['x-real-ip'] },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 5,
      storeOTP: 'hashed',
      async sendVerificationOTP({ email, otp }) {
        // 不 await：避免从响应时间推断邮箱状态（官方建议），失败只记日志
        void sendOtp(email, otp).catch((error: unknown) => {
          console.error('[auth] 验证码发送失败', error instanceof Error ? error.message : error)
        })
      },
    }),
    admin(),
    twoFactor({ issuer: 'DayDayOn' }),
  ],
  // TODO(P1): hooks.before —— 邮箱规范化与白名单、按邮箱 / IP 的验证码限流、同 IP 每日注册数、封号用户登录返回 ACCOUNT_BANNED（auth.md 第 3、4 节，PRD 7.1）
  // TODO(P1): hooks.after —— admin 插件 banUser / unbanUser 端点写 admin_audit_logs（PRD 7.3）
  // TODO(P1): databaseHooks.user.create.after —— 建 profiles、quota_accounts（本周 2 元）与 grant 流水（PRD 7.1）
  // TODO(P1): databaseHooks.session.create.after —— 更新 profiles.lastLoginIp（PRD 2.1）
})

export type Auth = typeof auth
