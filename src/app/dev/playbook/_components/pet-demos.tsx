'use client'

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  InteractivePet,
  petActions,
  type PetAction,
  type PetEvent,
  type PetHandle,
} from '@/components/mascot/interactive-pet'
import { mascotCharacters, type MascotCharacter } from '@/components/mascot/mascot-svg'
import { TreatGlyph, treats, type TreatId } from '@/components/mascot/treat-glyph'
import { Icon } from '@/components/ui/icon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Stamp } from '@/components/ui/stamp'
import { cn } from '@/lib/cn'

const eventLabel: Record<PetEvent['type'], string> = {
  click: '点击',
  'double-click': '双击',
  'long-press': '长按松开',
  pet: '抚摸',
  hover: '悬停',
  feed: '投喂',
  'fall-asleep': '睡着了',
  'wake-up': '被叫醒',
  action: '动作',
}

const actionOrder: PetAction[] = [
  'wave',
  'hop',
  'jump',
  'spin',
  'nod',
  'shake',
  'shy',
  'love',
  'eat',
  'think',
  'surprise',
  'cheer',
  'sleep',
]

const gestures = [
  { how: '悬停', what: '眼睛跟着指针，身体微微倾斜' },
  { how: '点击', what: '蹦一下，说句话' },
  { how: '双击', what: '转圈，冒星星' },
  { how: '长按', what: '越压越扁蓄力，松手大跳' },
  { how: '来回抚摸', what: '害羞脸红，冒爱心' },
  { how: '拖零食给它', what: '吧唧吧唧吃东西' },
  { how: '15 秒不理', what: '睡着冒 z，点一下吓醒' },
]

/** 互动舞台：手势、动作按钮、投喂、事件记录 */
export function PetStage() {
  const pet = useRef<PetHandle>(null)
  const [log, setLog] = useState<{ id: number; text: string }[]>([])
  const [drag, setDrag] = useState<{
    id: TreatId
    x: number
    y: number
    over: boolean
  } | null>(null)
  const [stampKey, setStampKey] = useState(0)
  const [character, setCharacter] = useState<MascotCharacter>('tuan')
  const seq = useRef(0)

  const record = (text: string) => {
    const id = ++seq.current
    setLog((l) => [{ id, text }, ...l].slice(0, 6))
  }

  function onEvent(e: PetEvent) {
    if (e.type === 'hover') return
    record(`${eventLabel[e.type]}${e.action ? ` → ${petActions[e.action].label}` : ''}`)
  }

  function startDrag(id: TreatId, e: ReactPointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ id, x: e.clientX, y: e.clientY, over: false })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div
        data-ann="playbook.pet.stage"
        className="border-border relative flex min-h-[420px] flex-col items-center justify-end overflow-hidden rounded-3xl border bg-[radial-gradient(ellipse_at_50%_35%,var(--surface)_0%,var(--background)_60%,var(--surface-sunken)_100%)] pt-16 pb-6"
      >
        {/* 地板和小装饰 */}
        <span className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(to_top,var(--surface-sunken),transparent)]" />
        <span className="bg-surface absolute top-6 left-8 h-10 w-20 rounded-full opacity-80 blur-[1px]" />
        <span className="bg-surface absolute top-12 right-12 h-8 w-14 rounded-full opacity-70 blur-[1px]" />
        {stampKey > 0 && (
          <Stamp
            key={stampKey}
            caption="10.31"
            animate
            size={84}
            className="absolute top-8 right-8"
          />
        )}

        <InteractivePet ref={pet} size={200} onEvent={onEvent} character={character} />

        <div className="bg-surface/90 shadow-soft relative mt-4 flex items-center gap-2 rounded-full px-3 py-1.5">
          <span className="text-tiny text-muted font-semibold">投喂</span>
          {treats.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-label={`把${t.label}拖给团团`}
              title={`把${t.label}拖给团团`}
              onPointerDown={(e) => startDrag(t.id, e)}
              onPointerMove={(e) => {
                if (!drag) return
                setDrag({
                  ...drag,
                  x: e.clientX,
                  y: e.clientY,
                  over: !!pet.current?.hitTest(e.clientX, e.clientY),
                })
              }}
              onPointerUp={(e) => {
                if (drag && pet.current?.hitTest(e.clientX, e.clientY)) {
                  pet.current.feed()
                }
                setDrag(null)
              }}
              onClick={(e) => {
                // 键盘用户：回车直接投喂
                if (e.detail === 0) pet.current?.feed()
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

        {drag && (
          <span
            aria-hidden
            className={cn(
              'pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 transition-transform duration-(--dur-fast)',
              drag.over && 'scale-125',
            )}
            style={{ left: drag.x, top: drag.y }}
          >
            <TreatGlyph id={drag.id} size={40} />
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div
          data-ann="playbook.pet.character"
          className="border-border bg-surface rounded-2xl border p-3"
        >
          <p className="text-tiny text-muted mb-2 font-semibold">形象（用户在「我的」里选）</p>
          <SegmentedControl
            options={mascotCharacters.map((c) => ({ value: c.id, label: c.name }))}
            value={character}
            onValueChange={setCharacter}
            label="选择形象"
            size="sm"
          />
        </div>
        <div
          data-ann="playbook.pet.actions"
          className="border-border bg-surface rounded-2xl border p-3"
        >
          <p className="text-tiny text-muted mb-2 font-semibold">动作（外部调用 ref.play）</p>
          <div className="flex flex-wrap gap-1.5">
            {actionOrder.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => {
                  pet.current?.play(a)
                  if (a === 'cheer') setStampKey((k) => k + 1)
                  record(`动作 → ${petActions[a].label}`)
                }}
                className="bg-surface-sunken text-tiny ease-spring hover:bg-primary-soft hover:text-primary-ink h-8 rounded-full px-3 font-semibold transition-[transform,background-color] duration-(--dur-fast) active:scale-95"
              >
                {petActions[a].label}
              </button>
            ))}
          </div>
        </div>

        <div
          data-ann="playbook.pet.gestures"
          className="border-border bg-surface rounded-2xl border p-3"
        >
          <p className="text-tiny text-muted mb-2 flex items-center gap-1.5 font-semibold">
            <Icon name="hand" size={16} />
            手势
          </p>
          <dl className="text-caption grid gap-1">
            {gestures.map((g) => (
              <div key={g.how} className="flex gap-2">
                <dt className="w-20 shrink-0 font-semibold">{g.how}</dt>
                <dd className="text-muted">{g.what}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div
          data-ann="playbook.pet.log"
          className="border-border bg-surface rounded-2xl border p-3"
        >
          <p className="text-tiny text-muted mb-2 font-semibold">事件（onEvent）</p>
          {log.length === 0 ? (
            <p className="text-tiny text-subtle">和团团玩一下，这里会记录触发的事件</p>
          ) : (
            <ol className="grid gap-1">
              {log.map((l, i) => (
                <li
                  key={l.id}
                  className={cn(
                    'text-tiny font-mono',
                    i === 0 ? 'animate-fade-in text-foreground' : 'text-muted',
                  )}
                >
                  {l.text}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
