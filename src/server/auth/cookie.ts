/*
 * src/proxy.ts 用的会话 cookie 判断（auth.md 第 5 节）。
 * better-auth 只能在 src/server/auth/ 里 import（ESLint 封装层禁令），proxy 经这里取用。
 * 不 import 'server-only'：proxy 不经过 React Server 的模块条件。
 * 只判断 cookie 是否存在，不校验会话，不能当作安全检查。
 */
export { getSessionCookie } from 'better-auth/cookies'
