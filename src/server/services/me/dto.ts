import {
  GenderSchema,
  MascotCharacterSchema,
  ThemeSchema,
  type Me,
  type Role,
} from '@/features/me/schemas'
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
}

function toRole(role: string | null): Role {
  return role === 'admin' ? 'admin' : 'user'
}

export function toMeDto(row: MeRow, streak: number): Me {
  const gender = GenderSchema.safeParse(row.gender)
  const theme = ThemeSchema.safeParse(row.theme)
  const mascot = MascotCharacterSchema.safeParse(row.mascot)
  const remindAt = LocalTimeSchema.safeParse(row.remindAt)
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
      remindAt: remindAt.success ? remindAt.data : null,
    },
    streak: Math.max(0, Math.trunc(streak)),
    createdAt: row.createdAt.toISOString(),
  }
}

/** 导出文件名：daydayon-export-2026-11-01.json（日期为用户时区的日历日） */
export function exportFileName(localDate: string): string {
  return `daydayon-export-${localDate}.json`
}
