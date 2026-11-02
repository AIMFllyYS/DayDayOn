import * as z from 'zod'

/*
 * 全站配置（PRD 7.3，F1 实现）：存在 app_settings（每项一行，key = 字段名，value = jsonb）。
 * 读取经 src/server/settings.ts 的 getSettings()（P1），缺的项用这里的默认值补齐。
 * 本文件不 import 'server-only'：后台表单（features/admin）复用同一份 schema 做校验。
 *
 * 验证码"同 IP 每小时 5 次"走 Better Auth customRules，写死在 auth.ts，不在这里。
 */

const Micros = z.number().int().min(0, { error: '金额不能是负数' })
const Count = (max: number) =>
  z
    .number()
    .int()
    .min(1, { error: '至少为 1' })
    .max(max, { error: `最多 ${max}` })

export const AppSettingsSchema = z
  .object({
    /** 全站每日花费上限（北京时间），默认 10 元 */
    dailySpendCapMicros: Micros.max(1_000_000_000),
    /** 每周额度，默认 10 元 */
    weeklyQuotaMicros: Micros.max(1_000_000_000),
    /** 新账号首周额度，默认 2 元 */
    newUserQuotaMicros: Micros.max(1_000_000_000),
    /** 手动暂停全站 AI；日上限暂停实时判断，不写这里 */
    aiPaused: z.boolean(),
    /** 同一用户每小时 AI 调用次数 */
    aiHourlyLimit: Count(1000),
    /** 同一用户同时进行中的 AI 调用数 */
    aiConcurrency: Count(10),
    /** 兑换失败多少次后锁定 1 小时 */
    redeemFailLockThreshold: Count(100),
    /** 同一 IP 每天最多新注册账号数 */
    signupPerIpDaily: Count(1000),
    /** 同一邮箱每天最多发送验证码次数 */
    otpPerEmailDaily: Count(500),
    /** 同一 IP 每天最多发送验证码次数 */
    otpPerIpDaily: Count(5000),
  })
  .meta({ id: 'AppSettings' })
export type AppSettings = z.infer<typeof AppSettingsSchema>
export type AppSettingKey = keyof AppSettings

/** PUT /admin/settings：只传要改的项 */
export const AppSettingsPatchSchema = AppSettingsSchema.partial()
  .refine((p) => Object.keys(p).length > 0, { error: '没有要修改的内容' })
  .meta({ id: 'AppSettingsPatch' })
export type AppSettingsPatch = z.infer<typeof AppSettingsPatchSchema>

/** 默认值：ADR-0002 第 5、6 节与 ADR-0023（接入点选人机验证后放宽同 IP 阈值，避免校园网/NAT 误伤） */
export const DEFAULT_SETTINGS: AppSettings = {
  dailySpendCapMicros: 10_000_000,
  weeklyQuotaMicros: 10_000_000,
  newUserQuotaMicros: 2_000_000,
  aiPaused: false,
  aiHourlyLimit: 60,
  aiConcurrency: 2,
  redeemFailLockThreshold: 5,
  signupPerIpDaily: 100,
  otpPerEmailDaily: 100,
  otpPerIpDaily: 500,
}

export const APP_SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as AppSettingKey[]

/** 把库里读出的 key/value 行合并到默认值上；非法值丢弃并回落到默认值 */
export function mergeSettings(rows: readonly { key: string; value: unknown }[]): AppSettings {
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  const shape = AppSettingsSchema.shape
  for (const row of rows) {
    if (!(row.key in shape)) continue
    const field = shape[row.key as AppSettingKey]
    const parsed = field.safeParse(row.value)
    if (parsed.success) merged[row.key] = parsed.data
  }
  return AppSettingsSchema.parse(merged)
}
