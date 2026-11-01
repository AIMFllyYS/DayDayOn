import 'server-only'
import type { Tx } from '@/server/db/client'
import type { AppSettings, AppSettingsPatch } from './settings-schema'

/*
 * 全站配置读写（PRD 7.3）。签名 F1，实现 P1；D7 与 runAi / 限流只调用。
 * 行结构：app_settings(key, value)，合并规则用 settings-schema.ts 的 mergeSettings()。
 */

/** 读取全站配置：进程内缓存 10 秒，缺的项用默认值补齐。实现：P1 */
export async function getSettings(): Promise<AppSettings> {
  throw new Error('not implemented: P1')
}

/** 更新若干项（UPSERT），写后清空缓存，返回更新后的完整配置。实现：P1 */
export async function updateSettings(tx: Tx, patch: AppSettingsPatch): Promise<AppSettings> {
  void tx
  void patch
  throw new Error('not implemented: P1')
}

/** 清空进程内缓存（测试与 updateSettings 用）。实现：P1 */
export function invalidateSettingsCache(): void {
  throw new Error('not implemented: P1')
}
