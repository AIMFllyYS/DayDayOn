import {
  GenderSchema,
  MascotCharacterSchema,
  RemindModeSchema,
  ThemeSchema,
  type Me,
  type Role,
} from '@/features/me/schemas'
import { DailyStepTargetSchema, DEFAULT_DAILY_STEP_TARGET } from '@/features/metric/schemas'
import { DEFAULT_REFEREE_TIER, RefereeTierSchema } from '@/features/referee/schemas'
import { LocalTimeSchema } from '@/features/shared/schemas'

/*
 * 数据库行 → MeSchema DTO（api-conventions.md 第 3 节：service 返回的就是接口 DTO）。
 * 纯函数，不碰数据库，带单测。库里的 text 列（theme、mascot、gender、remindAt）按 zod 收窄，
 * 不合法的旧值回落到默认值，不让一条脏数据把整个 /me 弄成 500。
 */

export interface MeRow {
  userId: string
  email: string
  role: string | null
  twoFactorEnabled: boolean | null
  createdAt: Date
  nickname: string | null
  avatar: string | null
  gender: string | null
  birthYear: number | null
  heightCm: number | null
  timeZone: string
  dayStartHour: number
  leaderboardOptIn: boolean
  onboardedAt: Date | null
  theme: string
  mascot: string
  remindAt: string | null
  remindMode?: string
  refereeTier: string
  /** null 表示主动关闭步数参考虚线；undefined（测试或老调用方未传）回落到默认 8000 */
  dailyStepTarget?: number | null
}

function toRole(role: string | null): Role {
  return role === 'admin' ? 'admin' : 'user'
}

function resolveDailyStepTarget(raw: number | null | undefined): number | null {
  if (raw === null) return null
  if (raw === undefined) return DEFAULT_DAILY_STEP_TARGET
  const parsed = DailyStepTargetSchema.safeParse(raw)
  return parsed.success ? parsed.data : DEFAULT_DAILY_STEP_TARGET
}

export function toMeDto(row: MeRow, streak: number): Me {
  const gender = GenderSchema.safeParse(row.gender)
  const theme = ThemeSchema.safeParse(row.theme)
  const mascot = MascotCharacterSchema.safeParse(row.mascot)
  const remindAt = LocalTimeSchema.safeParse(row.remindAt)
  const remindMode = RemindModeSchema.safeParse(row.remindMode)
  const tier = RefereeTierSchema.safeParse(row.refereeTier)
  const resolvedRemindAt = remindAt.success ? remindAt.data : null
  const resolvedRemindMode = remindMode.success
    ? remindMode.data
    : resolvedRemindAt !== null
      ? 'in-app'
      : 'off'
  return {
    userId: row.userId,
    email: row.email,
    role: toRole(row.role),
    twoFactorEnabled: row.twoFactorEnabled === true,
    onboarded: row.onboardedAt !== null,
    profile: {
      nickname: row.nickname,
      avatar: row.avatar,
      gender: gender.success ? gender.data : null,
      birthYear: row.birthYear,
      heightCm: row.heightCm,
      timeZone: row.timeZone,
    },
    preferences: {
      theme: theme.success ? theme.data : 'caramel',
      mascot: mascot.success ? mascot.data : 'tuan',
      leaderboardOptIn: row.leaderboardOptIn,
      dayStartHour: row.dayStartHour,
      remindAt: resolvedRemindAt,
      remindMode: resolvedRemindMode,
      refereeTier: tier.success ? tier.data : DEFAULT_REFEREE_TIER,
      dailyStepTarget: resolveDailyStepTarget(row.dailyStepTarget),
    },
    streak: Math.max(0, Math.trunc(streak)),
    createdAt: row.createdAt.toISOString(),
  }
}

/** 导出文件名：daydayon-export-2026-11-01.json（日期为用户时区的日历日） */
export function exportFileName(localDate: string): string {
  return `daydayon-export-${localDate}.json`
}
