/** Better Auth 端点路径（better-auth@1.7.14 插件源码核对过），限流与 hooks 只引用这里。auth.ts 转出 AUTH_PATHS */
export const AUTH_PATHS = {
  sendOtp: '/email-otp/send-verification-otp',
  signInOtp: '/sign-in/email-otp',
  banUser: '/admin/ban-user',
  unbanUser: '/admin/unban-user',
  revokeUserSessions: '/admin/revoke-user-sessions',
} as const
