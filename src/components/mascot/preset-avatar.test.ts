import { describe, expect, it } from 'vitest'
import { formatPresetAvatar, parsePresetAvatar, presetAvatarLabel } from './preset-avatar'

describe('parsePresetAvatar', () => {
  it('解析合法的预设标识', () => {
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

  it('format 与 parse 互逆', () => {
    const id = 'mascot:dun:love:custom'
    const spec = parsePresetAvatar(id)
    expect(spec && formatPresetAvatar(spec)).toBe(id)
  })
})

describe('presetAvatarLabel', () => {
  it('读屏名称包含形象和表情', () => {
    expect(presetAvatarLabel({ character: 'dun', mood: 'cheer', tone: 'diet' })).toBe(
      '墩墩头像：欢呼',
    )
  })
})
