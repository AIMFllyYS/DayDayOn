// 对外只导出会话函数和类型（auth.md 第 1 节）。auth 实例只给 route handler 和中间件内部用
export {
  getSession,
  getSessionFromHeaders,
  isBanned,
  requireAdmin,
  requireOnboardedUser,
  requireUser,
  type Session,
  type SessionData,
  type SessionUser,
} from './session'
