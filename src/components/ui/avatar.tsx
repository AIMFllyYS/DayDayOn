import { cn } from '@/lib/cn'
import { softToneClass, type Tone } from './tone'

const sizeClass = {
  sm: 'size-8 text-tiny',
  md: 'size-10 text-caption',
  lg: 'size-14 text-subhead',
} as const

interface AvatarProps {
  name: string
  tone?: Tone
  size?: keyof typeof sizeClass
  /** 连续打卡中：外圈加主色描边 */
  ring?: boolean
  className?: string
}

/** 头像：暂时只显示昵称首字，接入头像上传后在这里加 <img> */
export function Avatar({
  name,
  tone = 'primary',
  size = 'md',
  ring = false,
  className,
}: AvatarProps) {
  const initial = Array.from(name.trim())[0] ?? '?'
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'font-display inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        sizeClass[size],
        softToneClass[tone],
        ring && 'ring-primary ring-offset-surface ring-2 ring-offset-2',
        className,
      )}
    >
      {initial}
    </span>
  )
}

interface AvatarStackProps {
  names: string[]
  max?: number
  size?: keyof typeof sizeClass
}

const stackTones: Tone[] = ['exercise', 'sleep', 'diet', 'study', 'custom']

/** 头像叠放：显示"一起打卡的朋友" */
export function AvatarStack({ names, max = 4, size = 'sm' }: AvatarStackProps) {
  const shown = names.slice(0, max)
  const rest = names.length - shown.length
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((n, i) => (
        <Avatar
          key={`${n}-${i}`}
          name={n}
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
