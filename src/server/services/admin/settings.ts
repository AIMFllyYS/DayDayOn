import 'server-only'
import type { Tx } from '@/server/db/client'
import { getSettings, updateSettings } from '@/server/settings'
import type { AppSettings, AppSettingsPatch } from '@/server/settings-schema'
import { writeAudit } from './audit'

/*
 * 全站配置（PRD 2.12、7.3）。读写只经 src/server/settings.ts（P1，10 秒缓存、写后失效）。
 * 改今日上限当天立即生效：updateSettings 写后清缓存。
 */

/** GET /admin/settings */
export async function readSettings(): Promise<AppSettings> {
  return getSettings()
}

/** PUT /admin/settings：只改传入的项；审计记下改了哪些项和新值（都是数字或开关，不含个人数据） */
export async function writeSettings(
  tx: Tx,
  adminId: string,
  patch: AppSettingsPatch,
  now: Date,
): Promise<AppSettings> {
  const next = await updateSettings(tx, patch)
  await writeAudit(tx, adminId, {
    action: 'settings.update',
    targetType: 'settings',
    detail: { ...patch },
    now,
  })
  return next
}
