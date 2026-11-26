/*
 * Better Auth 会话滑动留存策略常量（auth.md 第 2、5 节）。
 * 独立存放供 auth.ts 与 memoryAdapter 集成单测共用，不触发数据库连接或环境变量校验。
 */

/** 30 天内活跃使用通过滑动窗口自动续期，连续 30 天不活跃才过期 */
export const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30

/** 每 24 小时最多续期一次，避免每次请求重复写库与重写 Cookie */
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24

export const SESSION_POLICY = {
  expiresIn: SESSION_EXPIRES_IN_SECONDS,
  updateAge: SESSION_UPDATE_AGE_SECONDS,
} as const
