'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
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

/*
 * 选中后的情绪反馈（2026-11-01 评审）：
 *   1 很糟 → 整组抖一下，支持的手机轻震一次
 *   2 不太好 → 表情摇一摇
 *   3 一般 → 五个表情依次起伏，像一道波浪
 *   4 不错 / 5 超棒 → 从选中项撒彩纸（超棒更多）
 * 只在用户点击时播放，系统开启"减少动态效果"时只保留选中状态。
 */
interface Confetti {
  id: number
  dx: number
  dy: number
  rot: number
  color: string
  round: boolean
  delay: number
}

interface Burst {
  seq: number
  value: RatingValue
  confetti: Confetti[]
}

// 彩纸用五个板块色，类名写完整，Tailwind 才扫描得到
const confettiColors = ['bg-exercise', 'bg-diet', 'bg-sleep', 'bg-study', 'bg-custom'] as const

function makeConfetti(seq: number, count: number): Confetti[] {
  return Array.from({ length: count }, (_, i) => {
    // 主要向上扇形散开，少量往两侧
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1
    const dist = 34 + Math.random() * 30
    return {
      id: seq * 100 + i,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      rot: (Math.random() - 0.5) * 540,
      color: confettiColors[i % confettiColors.length] ?? 'bg-diet',
      round: i % 3 === 0,
      delay: Math.random() * 80,
    }
  })
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface RatingProps {
  value: RatingValue | null
  onValueChange: (value: RatingValue) => void
  label: string
  /** 选中项的色调，一般用板块色 */
  tone?: Tone
  /** 选中时播放情绪反馈，默认开启 */
  feedback?: boolean
  className?: string
}

/** 满意度评分（1–5）：每天每个板块打一次 */
export function Rating({
  value,
  onValueChange,
  label,
  tone = 'primary',
  feedback = true,
  className,
}: RatingProps) {
  const [burst, setBurst] = useState<Burst | null>(null)
  const seq = useRef(0)
  const timer = useRef<number | null>(null)

  const groupRef = useRef<HTMLDivElement>(null)

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  // 连续点同一项时动画类不变，浏览器不会重播；这里把组内的动画倒回开头。
  // 不用 key 重挂载按钮，否则键盘焦点会丢
  const burstSeq = burst?.seq
  useEffect(() => {
    if (burstSeq === undefined) return
    groupRef.current?.getAnimations({ subtree: true }).forEach((a) => {
      a.currentTime = 0
      a.play()
    })
  }, [burstSeq])

  function pick(v: RatingValue) {
    onValueChange(v)
    if (!feedback || prefersReducedMotion()) return
    const n = ++seq.current
    const count = v === 5 ? 16 : v === 4 ? 9 : 0
    setBurst({ seq: n, value: v, confetti: makeConfetti(n, count) })
    if (v === 1) navigator.vibrate?.(40)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setBurst(null), 1100)
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      className={cn('flex gap-1.5', burst?.value === 1 && 'animate-shake', className)}
    >
      {levels.map((l, i) => {
        const selected = value === l.value
        const faceAnim =
          burst?.value === 3
            ? 'animate-wave-bob'
            : burst?.value === 2 && selected
              ? 'animate-wiggle'
              : undefined
        return (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${l.value} 分，${l.label}`}
            onClick={() => pick(l.value)}
            className={cn(
              'text-tiny relative flex min-h-11 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 font-semibold',
              'ease-spring transition-[transform,background-color,color] duration-(--dur-fast) active:scale-90',
              selected
                ? cn(softToneClass[tone], 'scale-105')
                : 'text-muted hover:bg-surface-sunken',
            )}
          >
            <span
              className={cn('flex', faceAnim)}
              style={burst?.value === 3 ? { animationDelay: `${i * 70}ms` } : undefined}
            >
              <Face value={l.value} />
            </span>
            <span className={selected ? undefined : 'text-muted'}>{l.label}</span>
            {selected && burst && burst.confetti.length > 0 && (
              <span aria-hidden className="pointer-events-none absolute top-3 left-1/2">
                {burst.confetti.map((c) => (
                  <span
                    key={c.id}
                    className={cn(
                      'animate-confetti absolute block',
                      c.round ? 'size-1.5 rounded-full' : 'h-2 w-1 rounded-[1px]',
                      c.color,
                    )}
                    style={
                      {
                        '--dx': `${c.dx}px`,
                        '--dy': `${c.dy}px`,
                        '--rot': `${c.rot}deg`,
                        animationDelay: `${c.delay}ms`,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
