import type { UpdatePreferences, UpdateProfile } from '@/features/me/schemas'

/*
 * PATCH /me/profile、/me/preferences 的入参 → profiles 列（纯函数，带单测）。
 * 只写入参里出现的键：partial schema 里没传的字段保持原值，传 null 的字段清空。
 */

export interface ProfileColumns {
  nickname?: string
  avatar?: string | null
  gender?: 'female' | 'male' | 'other' | null
  birthYear?: number | null
  heightCm?: number | null
  timeZone?: string
}

export interface PreferenceColumns {
  theme?: string
  mascot?: 'tuan' | 'dun'
  leaderboardOptIn?: boolean
  dayStartHour?: number
  remindAt?: string | null
}

function pick<T extends object, K extends keyof T>(input: T, keys: readonly K[]): Partial<T> {
  const out: Partial<T> = {}
  for (const key of keys) {
    if (input[key] !== undefined) out[key] = input[key]
  }
  return out
}

const PROFILE_KEYS = ['nickname', 'avatar', 'gender', 'birthYear', 'heightCm', 'timeZone'] as const
const PREFERENCE_KEYS = ['theme', 'mascot', 'leaderboardOptIn', 'dayStartHour', 'remindAt'] as const

export function profileColumns(input: UpdateProfile): ProfileColumns {
  return pick(input, PROFILE_KEYS)
}

export function preferenceColumns(input: UpdatePreferences): PreferenceColumns {
  return pick(input, PREFERENCE_KEYS)
}
