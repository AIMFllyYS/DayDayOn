/*
 * Better Auth 表的手动索引（database.md 第 8 节）。
 *
 * auth@1.7.14 的 CLI 已经会生成性能指南要求的索引（session_userId_idx、account_userId_idx、
 * verification_identifier_idx，session.token 是 unique），所以这里暂时没有需要补的索引。
 * 以后要给 CLI 生成的表加索引，写在这里，不改 auth.ts：
 *
 *   export const userBannedIdx = index('user_banned_idx').on(user.banned)  // 需要时再加
 */
export {}
