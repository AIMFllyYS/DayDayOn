import 'server-only'
import { sql } from 'drizzle-orm'
import { db, type Tx } from '@/server/db/client'
import { appSettings } from '@/server/db/schema'
import {
  AppSettingsSchema,
  type AppSettingKey,
  type AppSettings,
  type AppSettingsPatch,
  mergeSettings,
} from './settings-schema'

/*
 * 全站配置读写（PRD 7.3）。签名 F1，实现 P1；D7 与 runAi / 限流只调用。
 * 行结构：app_settings(key, value)，合并规则用 settings-schema.ts 的 mergeSettings()。
 */

const CACHE_TTL_MS = 10_000

let cache: { value: AppSettings; expiresAt: number } | undefined

/** 读取全站配置：进程内缓存 10 秒，缺的项用默认值补齐 */
export async function getSettings(): Promise<AppSettings> {
  const now = Date.now()
  if (cache && cache.expiresAt > now) return cache.value
  const rows = await db.select({ key: appSettings.key, value: appSettings.value }).from(appSettings)
  const value = mergeSettings(rows)
  cache = { value, expiresAt: now + CACHE_TTL_MS }
  return value
}

/** 更新若干项（UPSERT），写后清空缓存，返回更新后的完整配置 */
export async function updateSettings(tx: Tx, patch: AppSettingsPatch): Promise<AppSettings> {
  // 只写 schema 里有的键，值再校验一遍（调用方可能绕过了路由校验）
  const parsed = AppSettingsSchema.partial().parse(patch)
  const entries = (Object.keys(parsed) as AppSettingKey[])
    .filter((key) => parsed[key] !== undefined)
    .map((key) => ({ key, value: parsed[key] as unknown }))
  if (entries.length > 0) {
    await tx
      .insert(appSettings)
      .values(entries)
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: sql`excluded.value`, updatedAt: new Date() },
      })
  }
  const rows = await tx.select({ key: appSettings.key, value: appSettings.value }).from(appSettings)
  invalidateSettingsCache()
  return mergeSettings(rows)
}

/** 清空进程内缓存（测试与 updateSettings 用） */
export function invalidateSettingsCache(): void {
  cache = undefined
}
