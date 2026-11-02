'use client'

import { useRef } from 'react'
import { MascotSvg } from '@/components/mascot/mascot-svg'
import { Icon } from '@/components/ui/icon'
import { PetAvatar } from '@/features/agent/components/pet-avatar'
import { PET_SIZE, usePetDrag, type PetPosition } from '@/features/agent/use-pet-drag'
import { cn } from '@/lib/cn'

/*
 * Playbook 演示：悬浮团团的手势与吸附、Agent 弹窗的布局。
 * 和正式组件共用 use-pet-drag + PetAvatar，只是把边界限制在演示框里（containerRef）。
 */

/** 演示框里的悬浮团团：可拖动、长按晃悠、双击转圈、靠近边缘吸附露半头 */
export function BoundedPetStage({ dockHeight = 64 }: { dockHeight?: number }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const width = 360
  const height = 420
  const pet = usePetDrag({
    size: PET_SIZE,
    bottomInset: dockHeight + 16,
    containerRef: frameRef,
    initial: {
      left: width - PET_SIZE - 16,
      top: height - dockHeight - PET_SIZE - 24,
      edge: 'none',
    },
  })

  return (
    <div
      ref={frameRef}
      data-ann="playbook.agent.floating.stage"
      className="bg-paper border-border relative min-h-[420px] w-full max-w-[360px] overflow-hidden rounded-3xl border"
    >
      {/* 背景内容，用来看遮挡 */}
      <div className="flex flex-col gap-2 p-4">
        {['慢跑 30 分钟', '午餐 · 番茄炒蛋', '读书 20 页'].map((t) => (
          <div
            key={t}
            className="bg-surface shadow-soft flex items-center gap-2 rounded-2xl px-3 py-2.5"
          >
            <span className="bg-primary-soft size-6 rounded-lg" />
            <span className="text-caption">{t}</span>
          </div>
        ))}
      </div>

      {/* 假 Dock，说明底部不能拖进去 */}
      <div
        className="border-border bg-surface/90 shadow-float absolute inset-x-3 flex items-center justify-around rounded-3xl border px-2"
        style={{ bottom: 8, height: dockHeight }}
      >
        {(['home', 'todo', 'plus', 'trophy', 'user'] as const).map((icon) => (
          <span key={icon} className="text-muted">
            <Icon name={icon} size={20} lineOnly />
          </span>
        ))}
      </div>

      <span
        className="absolute z-40 flex touch-none items-center justify-center"
        style={{
          left: pet.position.left,
          top: pet.position.top,
          width: PET_SIZE,
          height: PET_SIZE,
        }}
        {...pet.handlers}
        role="img"
        aria-label="悬浮团团（演示，可拖动）"
      >
        <PetAvatar pet={pet} size={PET_SIZE} />
      </span>
    </div>
  )
}

const EDGE_LABEL: Record<PetPosition['edge'], string> = {
  none: '不吸附（居中或停在原位）',
  left: '左边缘：露右半边',
  right: '右边缘：露左半边',
  top: '顶部：倒立，往下看两下',
}

/** 三种吸附状态的静态对照，避免只能靠拖拽猜 */
export function EdgeStates() {
  const half = PET_SIZE / 2
  // 用百分比 / calc 定位，卡片多宽都能露出正好半个头
  const states: {
    edge: Exclude<PetPosition['edge'], 'none'>
    left: string
    top: number | string
  }[] = [
    { edge: 'left', left: `${-half}px`, top: 44 },
    { edge: 'right', left: `calc(100% - ${half}px)`, top: 44 },
    { edge: 'top', left: `calc(50% - ${half}px)`, top: `${-half}px` },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {states.map((s) => (
        <figure key={s.edge} className="border-border bg-paper overflow-hidden rounded-2xl border">
          <div className="relative h-32 w-full overflow-hidden">
            <span
              className="absolute flex items-center justify-center"
              style={{ left: s.left, top: s.top, width: PET_SIZE, height: PET_SIZE }}
            >
              <PetAvatar
                pet={{
                  position: { left: 0, top: 0, edge: s.edge },
                  swaying: false,
                  spinning: false,
                  peeking: s.edge === 'top',
                  dragging: false,
                }}
                size={PET_SIZE}
              />
            </span>
          </div>
          <figcaption className="border-border bg-background border-t px-3 py-2">
            <p className="text-caption font-semibold">{EDGE_LABEL[s.edge]}</p>
            <p className="text-tiny text-subtle font-mono">edge: {s.edge}</p>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

const rightHeaderButtons = [
  { icon: 'clock', label: '历史对话' },
  { icon: 'plus', label: '新对话' },
  { icon: 'x', label: '关闭' },
] as const

/**
 * Agent 弹窗的静态布局：手机顶部留 1/4、左侧留 1/5（和正式组件 AgentPanel 的定位类一致）。
 * 演示只看壳，不做真实对话，避免连到接口。
 */
export function PanelLayoutDemo({ className }: { className?: string }) {
  return (
    <div
      data-ann="playbook.agent.panel.layout"
      className={cn(
        'bg-paper border-border relative h-[520px] w-full max-w-sm overflow-hidden rounded-3xl border',
        className,
      )}
    >
      <div className="text-tiny text-subtle p-4 font-mono">下面的页面内容</div>
      <div className="border-border bg-surface shadow-float absolute inset-x-0 top-[25%] bottom-14 left-[20%] flex flex-col overflow-hidden rounded-3xl border">
        <header className="border-border flex items-center gap-1 border-b px-2 py-1.5">
          <span
            title="全屏放大"
            aria-label="全屏放大"
            className="text-muted flex size-8 items-center justify-center rounded-full"
          >
            <Icon name="maximize" size={15} lineOnly />
          </span>
          <span className="text-caption text-foreground min-w-0 flex-1 truncate px-1 font-semibold">
            团团
          </span>
          {rightHeaderButtons.map((b) => (
            <span
              key={b.label}
              title={b.label}
              aria-label={b.label}
              className="text-muted flex size-8 items-center justify-center rounded-full"
            >
              <Icon name={b.icon} size={15} lineOnly />
            </span>
          ))}
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <MascotSvg mood="happy" size={64} />
          <p className="text-caption text-muted">我是团团，你的打卡搭子～</p>
        </div>
        <div className="p-2.5 pt-1">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-start pl-1">
              <span className="bg-surface/90 text-muted shadow-soft border-border text-tiny flex items-center gap-1 rounded-full border px-2.5 py-1 backdrop-blur-md">
                <Icon name="bulb" size={12} lineOnly />
                <span>深度思考</span>
              </span>
            </div>
            <div className="border-border bg-surface shadow-soft flex items-center gap-1.5 rounded-2xl border px-2 py-1">
              <span className="text-muted flex size-7 shrink-0 items-center justify-center">
                <Icon name="camera" size={15} lineOnly />
              </span>
              <p className="text-body text-subtle min-w-0 flex-1 truncate px-1 py-0 leading-6">
                和团团说点什么…
              </p>
              <span className="bg-primary text-on-primary flex size-7 shrink-0 items-center justify-center rounded-full shadow-sm">
                <Icon name="arrow" size={13} lineOnly />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
