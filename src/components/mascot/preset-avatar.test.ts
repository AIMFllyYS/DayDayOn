import { describe, expect, it } from 'vitest'
import { FriendSummarySchema } from '@/features/friend/schemas'
import {
  AvatarSchema,
  MascotCharacterSchema,
  PreferencesSchema,
  UpdatePreferencesSchema,
  UpdateProfileSchema,
} from '@/features/me/schemas'
import { formatPresetAvatar, parsePresetAvatar, presetAvatarLabel } from './preset-avatar'

describe('parsePresetAvatar', () => {
  it('解析合法的预设标识（覆盖全部 4 种 IP 角色）', () => {
    expect(parsePresetAvatar('mascot:tuan:cheer:exercise')).toEqual({
      character: 'tuan',
      mood: 'cheer',
      tone: 'exercise',
    })
    expect(parsePresetAvatar('mascot:dun:sleepy:primary')).toEqual({
      character: 'dun',
      mood: 'sleepy',
      tone: 'primary',
    })
    expect(parsePresetAvatar('mascot:mian:sleepy:sleep')).toEqual({
      character: 'mian',
      mood: 'sleepy',
      tone: 'sleep',
    })
    expect(parsePresetAvatar('mascot:you:happy:diet')).toEqual({
      character: 'you',
      mood: 'happy',
      tone: 'diet',
    })
  })

  it('空值返回 null，显示昵称首字', () => {
    expect(parsePresetAvatar(null)).toBeNull()
    expect(parsePresetAvatar(undefined)).toBeNull()
    expect(parsePresetAvatar('')).toBeNull()
  })

  it('ADR-0021 里的三段旧格式不认', () => {
    expect(parsePresetAvatar('mascot:cheer:exercise')).toBeNull()
  })

  it('未知的形象、表情、色调都不认', () => {
    expect(parsePresetAvatar('mascot:cat:happy:diet')).toBeNull()
    expect(parsePresetAvatar('mascot:tuan:angry:diet')).toBeNull()
    expect(parsePresetAvatar('mascot:tuan:happy:danger')).toBeNull()
    expect(parsePresetAvatar('avatar:tuan:happy:diet')).toBeNull()
    expect(parsePresetAvatar('mascot:tuan:happy:diet:extra')).toBeNull()
  })

  it('4 种角色的 format 与 parse 互逆', () => {
    const characters = ['tuan', 'dun', 'mian', 'you'] as const
    for (const c of characters) {
      const id = `mascot:${c}:love:custom`
      const spec = parsePresetAvatar(id)
      expect(spec && formatPresetAvatar(spec)).toBe(id)
    }
  })
})

describe('presetAvatarLabel', () => {
  it('读屏名称包含 4 种角色的形象和表情', () => {
    expect(presetAvatarLabel({ character: 'tuan', mood: 'cheer', tone: 'exercise' })).toBe(
      '团团头像：欢呼',
    )
    expect(presetAvatarLabel({ character: 'dun', mood: 'cheer', tone: 'diet' })).toBe(
      '墩墩头像：欢呼',
    )
    expect(presetAvatarLabel({ character: 'mian', mood: 'sleepy', tone: 'sleep' })).toBe(
      '绵绵头像：犯困',
    )
    expect(presetAvatarLabel({ character: 'you', mood: 'happy', tone: 'diet' })).toBe(
      '柚柚头像：开心',
    )
  })
})

describe('AvatarSchema 契约验证', () => {
  it('正确校验 4 种角色的预设头像字符串', () => {
    expect(AvatarSchema.safeParse('mascot:tuan:cheer:exercise').success).toBe(true)
    expect(AvatarSchema.safeParse('mascot:dun:sleepy:primary').success).toBe(true)
    expect(AvatarSchema.safeParse('mascot:mian:sleepy:sleep').success).toBe(true)
    expect(AvatarSchema.safeParse('mascot:you:happy:diet').success).toBe(true)
  })

  it('拒绝非法角色或未知结构的头像字符串', () => {
    expect(AvatarSchema.safeParse('mascot:panda:happy:diet').success).toBe(false)
    expect(AvatarSchema.safeParse('mascot:unknown:cheer:exercise').success).toBe(false)
    expect(AvatarSchema.safeParse('http://example.com/avatar.png').success).toBe(false)
  })
})

describe('MascotCharacterSchema 与偏好设置验证', () => {
  it('MascotCharacterSchema 支持全部 4 种角色枚举', () => {
    const valid = ['tuan', 'dun', 'mian', 'you']
    for (const char of valid) {
      expect(MascotCharacterSchema.safeParse(char).success).toBe(true)
    }
    expect(MascotCharacterSchema.safeParse('other').success).toBe(false)
  })

  it('PreferencesSchema 与 UpdatePreferencesSchema 均接受 4 种伴宠形象', () => {
    for (const char of ['tuan', 'dun', 'mian', 'you'] as const) {
      const full = PreferencesSchema.safeParse({
        theme: 'caramel',
        mascot: char,
        leaderboardOptIn: true,
        dayStartHour: 4,
        remindAt: '21:00',
      })
      expect(full.success).toBe(true)

      const partial = UpdatePreferencesSchema.safeParse({
        mascot: char,
      })
      expect(partial.success).toBe(true)
      if (partial.success) {
        expect(partial.data.mascot).toBe(char)
      }
    }
  })
})

describe('Decision #3 伴宠与个人头像严格解耦合规验证', () => {
  it('伴宠偏好更新只包含 mascot 字段，绝不改写或依赖 avatar', () => {
    const prefPatch = UpdatePreferencesSchema.parse({ mascot: 'you' })
    expect(prefPatch).toEqual({ mascot: 'you' })
    expect(prefPatch).not.toHaveProperty('avatar')
  })

  it('个人资料头像更新只包含 avatar 字段，绝不改写或依赖 mascot', () => {
    const profilePatch = UpdateProfileSchema.parse({
      avatar: 'mascot:mian:sleepy:sleep',
    })
    expect(profilePatch).toEqual({ avatar: 'mascot:mian:sleepy:sleep' })
    expect(profilePatch).not.toHaveProperty('mascot')
  })

  it('用户可自由组合任意伴宠与任意预设头像（如伴宠为柚柚，头像为绵绵）', () => {
    const profile = UpdateProfileSchema.parse({ avatar: 'mascot:mian:sleepy:sleep' })
    const pref = UpdatePreferencesSchema.parse({ mascot: 'you' })
    expect(profile.avatar).toBe('mascot:mian:sleepy:sleep')
    expect(pref.mascot).toBe('you')
  })
})

describe('FriendSummarySchema mascot 字段暴露验证', () => {
  const baseFriend = {
    userId: 'u_friend_1',
    nickname: '好友阿柚',
    avatar: 'mascot:tuan:cheer:exercise',
    streak: 7,
    todayDone: 3,
    todayPlanned: 5,
    todayMood: 4,
    createdAt: '2026-10-30T08:00:00.000Z',
  }

  it('支持在好友摘要中暴露 4 种角色的伴宠标识', () => {
    for (const char of ['tuan', 'dun', 'mian', 'you'] as const) {
      const res = FriendSummarySchema.safeParse({
        ...baseFriend,
        mascot: char,
      })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.mascot).toBe(char)
      }
    }
  })

  it('未提供 mascot 时解析依旧成功且保持向后兼容', () => {
    const res = FriendSummarySchema.safeParse(baseFriend)
    expect(res.success).toBe(true)
  })
})
