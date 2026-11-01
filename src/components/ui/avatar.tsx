import { cn } from '@/lib/cn'
import { parsePresetAvatar, PresetAvatar } from '@/components/mascot/preset-avatar'
import { softToneClass, type Tone } from './tone'

const sizeClass = {
  sm: 'size-8 text-tiny',
  md: 'size-10 text-caption',
  lg: 'size-14 text-subhead',
} as const

// 与 sizeClass 的 size-8 / 10 / 14 对应（px），预设头像按这个尺寸绘制
const sizePx = { sm: 32, md: 40, lg: 56 } as const

interface AvatarProps {
  name: string
  /** 预设头像标识 mascot:<character>:<mood>:<tone>（ADR-0021）；为空或无法解析时显示昵称首字 */
  avatar?: string | null
  /** 昵称首字的底色；预设头像用标识里的色调 */
  tone?: Tone
  size?: keyof typeof sizeClass
  /** 连续打卡中：外圈加主色描边 */
  ring?: boolean
  className?: string
}

/** 头像：有预设头像时画团团 / 墩墩，否则显示昵称首字。不支持上传（ADR-0021） */
export function Avatar({
  name,
  avatar,
  tone = 'primary',
  size = 'md',
  ring = false,
  className,
}: AvatarProps) {
  const ringClass = ring && 'ring-primary ring-offset-surface ring-2 ring-offset-2'
  const preset = parsePresetAvatar(avatar)
  if (preset) {
    return (
      <PresetAvatar
        preset={preset}
        size={sizePx[size]}
        label={name}
        className={cn(ringClass, className)}
      />
    )
  }
  const initial = Array.from(name.trim())[0] ?? '?'
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'font-display inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        sizeClass[size],
        softToneClass[tone],
        ringClass,
        className,
      )}
    >
      {initial}
    </span>
  )
}

interface AvatarStackProps {
  names: string[]
  /** 与 names 一一对应的预设头像标识；缺省或为 null 的显示昵称首字 */
  avatars?: readonly (string | null | undefined)[]
  max?: number
  size?: keyof typeof sizeClass
}

const stackTones: Tone[] = ['exercise', 'sleep', 'diet', 'study', 'custom']

/** 头像叠放：显示"一起打卡的朋友" */
export function AvatarStack({ names, avatars, max = 4, size = 'sm' }: AvatarStackProps) {
  const shown = names.slice(0, max)
  const rest = names.length - shown.length
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((n, i) => (
        <Avatar
          key={`${n}-${i}`}
          name={n}
          avatar={avatars?.[i]}
          size={size}
          tone={stackTones[i % stackTones.length]}
          className="ring-surface ring-2"
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            'bg-surface-sunken text-muted ring-surface inline-flex items-center justify-center rounded-full font-semibold ring-2',
            sizeClass[size],
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}
