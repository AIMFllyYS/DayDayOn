import { describe, expect, it } from 'vitest'
import { MeSchema } from '@/features/me/schemas'
import { exportFileName, toMeDto, type MeRow } from './dto'
import { preferenceColumns, profileColumns } from './patch'

const ROW: MeRow = {
  userId: 'u1',
  email: 'xiaoman@hust.edu.cn',
  role: null,
  twoFactorEnabled: null,
  createdAt: new Date('2026-10-30T08:00:00Z'),
  nickname: null,
  avatar: null,
  gender: null,
  birthYear: null,
  heightCm: null,
  timeZone: 'Asia/Shanghai',
  dayStartHour: 4,
  leaderboardOptIn: false,
  onboardedAt: null,
  theme: 'caramel',
  mascot: 'tuan',
  remindAt: null,
}

describe('toMeDto', () => {
  it('新注册（未引导）的账号：结果符合 MeSchema', () => {
    const dto = toMeDto(ROW, 0)
    expect(MeSchema.parse(dto)).toEqual(dto)
    expect(dto.onboarded).toBe(false)
    expect(dto.role).toBe('user')
    expect(dto.twoFactorEnabled).toBe(false)
    expect(dto.createdAt).toBe('2026-10-30T08:00:00.000Z')
  })

  it('已引导的管理员', () => {
    const dto = toMeDto(
      {
        ...ROW,
        role: 'admin',
        twoFactorEnabled: true,
        onboardedAt: new Date(),
        gender: 'female',
        remindAt: '21:00',
      },
      12,
    )
    expect(dto).toMatchObject({
      role: 'admin',
      twoFactorEnabled: true,
      onboarded: true,
      streak: 12,
      profile: { gender: 'female' },
      preferences: { remindAt: '21:00' },
    })
  })

  it('库里的脏值回落到默认值，不让 /me 变成 500', () => {
    const dto = toMeDto(
      { ...ROW, theme: 'neon', mascot: 'cat', gender: 'x', remindAt: '25:00', role: 'owner' },
      -3,
    )
    expect(MeSchema.safeParse(dto).success).toBe(true)
    expect(dto.preferences).toMatchObject({ theme: 'caramel', mascot: 'tuan', remindAt: null })
    expect(dto.profile.gender).toBeNull()
    expect(dto.role).toBe('user')
    expect(dto.streak).toBe(0)
  })
})

describe('PATCH 入参 → 列', () => {
  it('只写出现的键；null 表示清空', () => {
    expect(profileColumns({ nickname: '阿柚', avatar: null })).toEqual({
      nickname: '阿柚',
      avatar: null,
    })
    expect(preferenceColumns({ remindAt: null, leaderboardOptIn: true })).toEqual({
      remindAt: null,
      leaderboardOptIn: true,
    })
  })

  it('dayStartHour = 0 不会被当成"没传"', () => {
    expect(preferenceColumns({ dayStartHour: 0 })).toEqual({ dayStartHour: 0 })
  })
})

describe('exportFileName', () => {
  it('带日期', () => {
    expect(exportFileName('2026-11-01')).toBe('daydayon-export-2026-11-01.json')
  })
})
