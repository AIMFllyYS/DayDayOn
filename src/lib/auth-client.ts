'use client'

import { adminClient, emailOTPClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/*
 * 浏览器端鉴权客户端（auth.md 第 1 节）。登录页与后台用户管理调用这里导出的方法。
 * 插件与 src/server/auth/auth.ts 一一对应：emailOTP、admin、twoFactor。
 * baseURL 不写：与站点同源，默认请求 /api/auth。
 *
 * 用法：
 *   authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
 *   authClient.signIn.emailOtp({ email, otp })
 *   authClient.twoFactor.enable / verifyTotp（管理员）
 *   authClient.admin.banUser({ userId, banReason, banExpiresIn }) / unbanUser({ userId })
 *   authClient.signOut()
 * 错误体：error.code 与 /api/v1 的错误码一致（EMAIL_DOMAIN_NOT_ALLOWED、RATE_LIMITED、ACCOUNT_BANNED…），
 * 文案经 src/lib/api 的 errorMessage() 取。
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), adminClient(), twoFactorClient()],
})

export type AuthClient = typeof authClient
