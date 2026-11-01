'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { TreatGlyph, treats, type TreatId } from '@/components/mascot/treat-glyph'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import { AiDraftCard } from '@/features/agent/components/ai-draft-card'
import { ThinkingDots } from '@/features/agent/components/thinking-dots'
import { cn } from '@/lib/cn'
import { useWelcomeMascot } from './mascot-context'
import { WelcomeSection } from './welcome-section'

/*
 * "拍一下就记好"演示（ADR-0022）：把零食拖进相框（或直接点它），团团想一想，给出一张 AI 草稿卡。
 * 全部是写死的演示数据，不调用 /api/v1，也不消耗任何额度。
 */

const DEMO: Record<TreatId, { title: string; fields: { label: string; value: string }[] }> = {
  onigiri: {
    title: '午餐 · 饭团',
    fields: [
      { label: '三文鱼饭团 · 1 个', value: '约 190 kcal' },
      { label: '碳水 / 蛋白质', value: '36 g / 7 g' },
    ],
  },
  strawberry: {
    title: '加餐 · 草莓',
    fields: [
      { label: '草莓 · 8 颗（约 120 g）', value: '约 38 kcal' },
      { label: '维生素 C', value: '满满的' },
    ],
  },
  cookie: {
    title: '加餐 · 小饼干',
    fields: [
      { label: '黄油曲奇 · 2 块', value: '约 140 kcal' },
      { label: '小提示', value: '下午茶别太多哦' },
    ],
  },
}

const THINK_MS = 1200
/** 按下到松开移动不超过这么多像素算"点一下" */
const TAP_SLOP = 8

type Phase = { kind: 'idle' } | { kind: 'thinking'; id: TreatId } | { kind: 'done'; id: TreatId }

export function WelcomeAiDemo() {
  const { character } = useWelcomeMascot()
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [confirmed, setConfirmed] = useState(false)
  const [drag, setDrag] = useState<{ id: TreatId; x: number; y: number; over: boolean } | null>(
    null,
  )
  const frame = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  function recognize(id: TreatId) {
    if (timer.current) window.clearTimeout(timer.current)
    setConfirmed(false)
    setPhase({ kind: 'thinking', id })
    timer.current = window.setTimeout(() => setPhase({ kind: 'done', id }), THINK_MS)
  }

  const overFrame = (x: number, y: number) => {
    const r = frame.current?.getBoundingClientRect()
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  }

  function onDown(id: TreatId, e: ReactPointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY }
    setDrag({ id, x: e.clientX, y: e.clientY, over: false })
  }

  function onUp(id: TreatId, e: ReactPointerEvent<HTMLButtonElement>) {
    const s = start.current
    const tapped = !s || Math.hypot(e.clientX - s.x, e.clientY - s.y) < TAP_SLOP
    // 拖进相框，或者在原地点一下，都算"拍一下"
    if (tapped || overFrame(e.clientX, e.clientY)) recognize(id)
    start.current = null
    setDrag(null)
  }

  const shownId = phase.kind === 'idle' ? null : phase.id

  return (
    <WelcomeSection
      id="ai"
      ann="welcome.ai"
      eyebrow="AI 帮你记"
      title="拍一下，饭就记好了"
      description="AI 看图估算食物和热量，结果先当草稿给你看，确认了才会记下。照片只在内存里看一眼，从不保存。"
    >
      <div className="grid gap-4 @2xl:grid-cols-2 @2xl:items-start">
        <div className="flex flex-col items-center gap-4">
          <div
            ref={frame}
            className={cn(
              'border-border-strong bg-surface relative flex aspect-[4/3] w-full max-w-sm items-center justify-center rounded-3xl border-2 border-dashed transition-[border-color,transform] duration-(--dur-fast)',
              drag?.over && 'border-primary scale-[1.02]',
            )}
          >
            {shownId ? (
              <span key={shownId} className="animate-pop-in">
                <TreatGlyph id={shownId} size={96} />
              </span>
            ) : (
              <span className="text-caption text-muted flex flex-col items-center gap-2">
                <Icon name="camera" size={28} />
                把下面的零食拖进来，或者点一下
              </span>
            )}
            <span className="absolute -right-3 -bottom-4">
              <Mascot
                mood={
                  phase.kind === 'thinking' ? 'thinking' : phase.kind === 'done' ? 'cheer' : 'happy'
                }
                size={72}
                character={character}
              />
            </span>
          </div>
          <div className="bg-surface shadow-soft flex items-center gap-1 rounded-full px-3 py-1">
            <span className="text-tiny text-muted mr-1 font-semibold">拍一下</span>
            {treats.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-label={`拍${t.label}`}
                title={`把${t.label}拖进相框`}
                onPointerDown={(e) => onDown(t.id, e)}
                onPointerMove={(e) => {
                  if (!drag) return
                  setDrag({
                    ...drag,
                    x: e.clientX,
                    y: e.clientY,
                    over: overFrame(e.clientX, e.clientY),
                  })
                }}
                onPointerUp={(e) => onUp(t.id, e)}
                onPointerCancel={() => setDrag(null)}
                onClick={(e) => {
                  // 键盘回车 / 空格没有指针事件
                  if (e.detail === 0) recognize(t.id)
                }}
                className={cn(
                  'ease-spring flex size-11 touch-none items-center justify-center rounded-full transition-transform duration-(--dur-fast) hover:-translate-y-0.5 active:scale-90',
                  drag?.id === t.id && 'opacity-30',
                )}
              >
                <TreatGlyph id={t.id} size={30} />
              </button>
            ))}
          </div>
        </div>

        <div aria-live="polite" className="min-h-48">
          {phase.kind === 'idle' && (
            <p className="bg-surface-sunken text-caption text-muted rounded-2xl p-4">
              识别结果会出现在这里。演示用的是写好的数据，不会真的上传图片。
            </p>
          )}
          {phase.kind === 'thinking' && (
            <p className="bg-surface text-caption shadow-soft flex items-center gap-2 rounded-2xl p-4">
              <span className="text-primary-ink">
                <ThinkingDots />
              </span>
              正在看这是什么…
            </p>
          )}
          {phase.kind === 'done' && (
            <div key={phase.id} className="animate-fade-up grid gap-2">
              <AiDraftCard
                module="diet"
                title={DEMO[phase.id].title}
                fields={DEMO[phase.id].fields}
                confidence={0.88}
                estimate
                onConfirm={() => setConfirmed(true)}
              />
              {confirmed && (
                <Badge tone="success" icon="check" className="animate-pop-in justify-self-start">
                  记好啦（演示，不会真的保存）
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {drag && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 transition-transform duration-(--dur-fast)',
            drag.over && 'scale-125',
          )}
          style={{ left: drag.x, top: drag.y }}
        >
          <TreatGlyph id={drag.id} size={44} />
        </span>
      )}
    </WelcomeSection>
  )
}
