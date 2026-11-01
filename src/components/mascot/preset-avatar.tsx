import { cn } from '@/lib/cn'
import { softToneClass, type Tone } from '@/components/ui/tone'
import {
  characterName,
  mascotCharacters,
  mascotMoods,
  MascotSvg,
  type MascotCharacter,
  type MascotMood,
} from './mascot-svg'

/*
 * 预设头像（ADR-0021）：数据库里只存标识 `mascot:<character>:<mood>:<tone>`，
 * 例如 `mascot:tuan:cheer:exercise`。这里负责解析标识，并把团团 / 墩墩画在一块板块色的圆底上。
 * 标识格式与 src/features/me/schemas.ts 的 AvatarSchema 一致；解析失败时调用方退回昵称首字。
 */

export const PRESET_AVATAR_TONES = [
  'primary',
  'exercise',
  'diet',
  'sleep',
  'study',
  'custom',
] as const satisfies readonly Tone[]
export type PresetAvatarTone = (typeof PRESET_AVATAR_TONES)[number]

export interface PresetAvatarSpec {
  character: MascotCharacter
  mood: MascotMood
  tone: PresetAvatarTone
}

const CHARACTERS = new Set<string>(mascotCharacters.map((c) => c.id))
const MOODS = new Set<string>(mascotMoods.map((m) => m.mood))
const TONES = new Set<string>(PRESET_AVATAR_TONES)

function isCharacter(v: string): v is MascotCharacter {
  return CHARACTERS.has(v)
}
function isMood(v: string): v is MascotMood {
  return MOODS.has(v)
}
function isTone(v: string): v is PresetAvatarTone {
  return TONES.has(v)
}

/** 解析预设头像标识；不是合法的预设（空、旧格式、未知表情）时返回 null */
export function parsePresetAvatar(value: string | null | undefined): PresetAvatarSpec | null {
  if (!value) return null
  const parts = value.split(':')
  if (parts.length !== 4) return null
  const [prefix, character, mood, tone] = parts
  if (prefix !== 'mascot' || !character || !mood || !tone) return null
  if (!isCharacter(character) || !isMood(mood) || !isTone(tone)) return null
  return { character, mood, tone }
}

/** 把预设拼回标识，用于引导页和资料页的头像选择 */
export function formatPresetAvatar({ character, mood, tone }: PresetAvatarSpec): string {
  return `mascot:${character}:${mood}:${tone}`
}

const moodLabel = new Map(mascotMoods.map((m) => [m.mood, m.label]))

/** 读屏用的描述，例如"团团头像：欢呼" */
export function presetAvatarLabel({ character, mood }: PresetAvatarSpec): string {
  return `${characterName(character)}头像：${moodLabel.get(mood) ?? ''}`
}

interface PresetAvatarProps {
  preset: PresetAvatarSpec
  /** 直径（px） */
  size?: number
  /** 读屏名称；放在 Avatar 里时由外层提供名称，这里不传 */
  label?: string
  className?: string
}

/** 团团 / 墩墩的大头照：圆底用板块色的 soft 档，吉祥物放大后让脸占满圆底 */
export function PresetAvatar({ preset, size = 40, label, className }: PresetAvatarProps) {
  // 吉祥物的身体在 160×160 画布里偏下，放大 1.3 倍并下移一点，圆框里主要露出脸
  const art = Math.round(size * 1.3)
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        softToneClass[preset.tone],
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden
        className="absolute flex"
        style={{ transform: `translateY(${Math.round(size * 0.12)}px)` }}
      >
        <MascotSvg character={preset.character} mood={preset.mood} size={art} />
      </span>
    </span>
  )
}
