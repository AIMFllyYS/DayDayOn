'use client'

import { mascotCharacters, mascotMoods, type MascotCharacter } from '@/components/mascot/mascot-svg'
import {
  formatPresetAvatar,
  parsePresetAvatar,
  PRESET_AVATAR_TONES,
  PresetAvatar,
  presetAvatarLabel,
  type PresetAvatarTone,
} from '@/components/mascot/preset-avatar'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { softToneClass } from '@/components/ui/tone'
import { cn } from '@/lib/cn'

/*
 * 预设头像选择（ADR-0021）：形象（团团 / 墩墩）× 表情 × 底色。引导和资料页共用。
 * value 是 mascot:<character>:<mood>:<tone> 或 null（显示昵称首字）。
 */

const TONE_LABEL: Record<PresetAvatarTone, string> = {
  primary: '主题色',
  exercise: '薄荷',
  diet: '黄油',
  sleep: '薰衣草',
  study: '天空',
  custom: '樱花',
}

interface AvatarPickerProps {
  value: string | null
  onValueChange: (value: string | null) => void
}

export function AvatarPicker({ value, onValueChange }: AvatarPickerProps) {
  const current = parsePresetAvatar(value)
  const character: MascotCharacter = current?.character ?? 'tuan'
  const tone: PresetAvatarTone = current?.tone ?? 'primary'

  function pick(
    next: Partial<{ character: MascotCharacter; tone: PresetAvatarTone; mood: string }>,
  ) {
    const spec = {
      character: next.character ?? character,
      tone: next.tone ?? tone,
      mood: (next.mood ?? current?.mood ?? 'happy') as (typeof mascotMoods)[number]['mood'],
    }
    onValueChange(formatPresetAvatar(spec))
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        options={mascotCharacters.map((c) => ({ value: c.id, label: c.name }))}
        value={character}
        onValueChange={(c) => pick({ character: c })}
        label="选择形象"
      />

      <div role="radiogroup" aria-label="表情" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {mascotMoods.map((m) => {
          const spec = { character, mood: m.mood, tone }
          const selected = current?.mood === m.mood && current.character === character
          return (
            <button
              key={m.mood}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={presetAvatarLabel(spec)}
              onClick={() => pick({ mood: m.mood })}
              className={cn(
                'ease-spring flex min-h-11 flex-col items-center gap-1 rounded-2xl p-2 transition-[transform,background-color] duration-(--dur-fast) active:scale-95',
                selected ? 'bg-primary-soft ring-primary ring-2' : 'hover:bg-surface-sunken',
              )}
            >
              <PresetAvatar preset={spec} size={52} />
              <span className="text-tiny text-muted">{m.label}</span>
            </button>
          )
        })}
      </div>

      <div role="radiogroup" aria-label="底色" className="flex flex-wrap gap-2">
        {PRESET_AVATAR_TONES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tone === t}
            aria-label={TONE_LABEL[t]}
            title={TONE_LABEL[t]}
            onClick={() => pick({ tone: t })}
            className={cn(
              'flex size-11 items-center justify-center rounded-full transition-transform duration-(--dur-fast) active:scale-95',
            )}
          >
            <span
              className={cn(
                'size-8 rounded-full',
                softToneClass[t],
                tone === t && 'ring-primary ring-offset-surface ring-2 ring-offset-2',
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
