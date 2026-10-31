import { cn } from '@/lib/cn'
import { softToneClass, type Tone } from './tone'

const levels = [
  { value: 1, label: '很糟' },
  { value: 2, label: '不太好' },
  { value: 3, label: '一般' },
  { value: 4, label: '不错' },
  { value: 5, label: '超棒' },
] as const

export type RatingValue = (typeof levels)[number]['value']

// 嘴巴弧度：1 分向下弯，5 分笑得最开
const mouthPath: Record<RatingValue, string> = {
  1: 'M8.5 16.5c1.6-1.6 5.4-1.6 7 0',
  2: 'M9 16c1.4-.8 4.6-.8 6 0',
  3: 'M9 15.5h6',
  4: 'M9 14.5c1.4 1.2 4.6 1.2 6 0',
  5: 'M8.5 14c1.6 2.4 5.4 2.4 7 0',
}

function Face({ value }: { value: RatingValue }) {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" className="fill-current opacity-15" />
      <circle cx="9" cy="10.5" r="1.1" className="fill-current" />
      <circle cx="15" cy="10.5" r="1.1" className="fill-current" />
      <path d={mouthPath[value]} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

interface RatingProps {
  value: RatingValue | null
  onValueChange: (value: RatingValue) => void
  label: string
  /** 选中项的色调，一般用板块色 */
  tone?: Tone
  className?: string
}

/** 满意度评分（1–5）：每天每个板块打一次 */
export function Rating({ value, onValueChange, label, tone = 'primary', className }: RatingProps) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex gap-1.5', className)}>
      {levels.map((l) => {
        const selected = value === l.value
        return (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${l.value} 分，${l.label}`}
            onClick={() => onValueChange(l.value)}
            className={cn(
              'text-tiny flex min-h-11 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 font-semibold',
              'ease-spring transition-[transform,background-color,color] duration-(--dur-fast) active:scale-90',
              selected
                ? cn(softToneClass[tone], 'scale-105')
                : 'text-muted hover:bg-surface-sunken',
            )}
          >
            <Face value={l.value} />
            <span className={selected ? undefined : 'text-muted'}>{l.label}</span>
          </button>
        )
      })}
    </div>
  )
}
