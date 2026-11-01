import 'server-only'

/*
 * 后台 service（D7）。全部是普通 TS 函数，不 import next/*、hono；写函数接收 tx 并在同一事务里写审计。
 * 后台查询天然跨用户：权限由路由层的 requireAdmin 保证。
 */
export { generateCodes, listCodes, voidCode } from './codes'
export { getOverview, setAiPaused } from './overview'
export { readSettings, writeSettings } from './settings'
export { adjustUserQuota, listUsers } from './users'
