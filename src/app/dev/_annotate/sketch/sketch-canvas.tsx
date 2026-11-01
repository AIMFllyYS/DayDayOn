'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/lib/cn'
import {
  arrowHead,
  bbox,
  canResize,
  resizeTo,
  round1,
  strokePath,
  topHit,
  translate,
  type Box,
} from './geometry'
import { getComponentEntry } from './registry'
import {
  frameSize,
  sketchColors,
  type Pt,
  type SketchColor,
  type SketchFrame,
  type SketchItem,
  type SketchTool,
} from './types'

interface SketchCanvasProps {
  frame: SketchFrame
  items: SketchItem[]
  tool: SketchTool
  color: SketchColor
  strokeWidth: number
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** 拖动过程中的实时更新，不进撤销历史 */
  onLive: (items: SketchItem[]) => void
  /** 一次操作结束；before 是操作开始前的快照，用来入撤销栈 */
  onCommit: (items: SketchItem[], before: SketchItem[]) => void
}

type Gesture =
  | { mode: 'draw'; item: SketchItem }
  | { mode: 'move'; id: string; last: Pt; moved: boolean }
  | { mode: 'resize'; id: string }
  | { mode: 'erase'; removed: boolean }
  | { mode: 'text'; at: Pt }

const uid = () => Math.random().toString(36).slice(2, 10)
const HANDLE = 14

/**
 * 画布：组件在下层（真实渲染），笔迹和图形在中层（SVG），文字在上层。
 * 坐标一律是画框坐标（手机 390×844 等），按容器大小等比缩放显示。
 */
export function SketchCanvas({
  frame,
  items,
  tool,
  color,
  strokeWidth,
  selectedId,
  onSelect,
  onLive,
  onCommit,
}: SketchCanvasProps) {
  const { width, height } = frameSize[frame]
  const wrapRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [draft, setDraft] = useState<SketchItem | null>(null)
  const [editingText, setEditingText] = useState<{ id: string; isNew: boolean } | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const before = useRef<SketchItem[]>(items)

  // 按容器尺寸等比缩放画框，最大 1:1
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width: w, height: h } = entry.contentRect
      setScale(Math.min(1, (w - 48) / width, (h - 48) / height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [width, height])

  const toBoard = (e: { clientX: number; clientY: number }): Pt => {
    const r = boardRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    return { x: round1((e.clientX - r.left) / scale), y: round1((e.clientY - r.top) / scale) }
  }

  const selected = items.find((i) => i.id === selectedId) ?? null

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (editingText) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toBoard(e)
    before.current = items
    const base = { id: uid(), color }

    if (tool === 'pen') {
      gesture.current = {
        mode: 'draw',
        item: { ...base, kind: 'stroke', points: [p], width: strokeWidth },
      }
    } else if (tool === 'rect' || tool === 'ellipse' || tool === 'arrow') {
      gesture.current = {
        mode: 'draw',
        item: { ...base, kind: tool, x: p.x, y: p.y, w: 0, h: 0, width: strokeWidth },
      }
    } else if (tool === 'text') {
      // 等松开再创建输入框：按下时浏览器还会把焦点移走，输入框会立刻失焦
      gesture.current = { mode: 'text', at: p }
      return
    } else if (tool === 'eraser') {
      gesture.current = { mode: 'erase', removed: false }
      eraseAt(p)
      return
    } else {
      if (selected && canResize(selected)) {
        const b = bbox(selected)
        if (
          Math.abs(p.x - (b.x + b.w)) < HANDLE / scale &&
          Math.abs(p.y - (b.y + b.h)) < HANDLE / scale
        ) {
          gesture.current = { mode: 'resize', id: selected.id }
          return
        }
      }
      const hit = topHit(items, p, 6 / scale)
      onSelect(hit?.id ?? null)
      if (hit) gesture.current = { mode: 'move', id: hit.id, last: p, moved: false }
      return
    }
    setDraft(gesture.current.mode === 'draw' ? gesture.current.item : null)
  }

  function eraseAt(p: Pt) {
    const hit = topHit(items, p, 8 / scale)
    if (!hit) return
    if (gesture.current?.mode === 'erase') gesture.current.removed = true
    onLive(items.filter((i) => i.id !== hit.id))
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current
    if (!g) return
    const p = toBoard(e)
    if (g.mode === 'draw') {
      const it = g.item
      if (it.kind === 'stroke') {
        const last = it.points.at(-1)
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return
        g.item = { ...it, points: [...it.points, p] }
      } else if (it.kind === 'rect' || it.kind === 'ellipse' || it.kind === 'arrow') {
        g.item = { ...it, w: round1(p.x - it.x), h: round1(p.y - it.y) }
      }
      setDraft(g.item)
    } else if (g.mode === 'move') {
      const dx = p.x - g.last.x
      const dy = p.y - g.last.y
      g.last = p
      g.moved = true
      onLive(items.map((i) => (i.id === g.id ? translate(i, dx, dy) : i)))
    } else if (g.mode === 'resize') {
      onLive(items.map((i) => (i.id === g.id ? resizeTo(i, p) : i)))
    } else if (g.mode === 'erase') {
      eraseAt(p)
    }
  }

  function onPointerUp() {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (g.mode === 'draw') {
      setDraft(null)
      const it = g.item
      const b = bbox(it)
      const tooSmall = it.kind !== 'stroke' && b.w < 4 && b.h < 4
      if (!tooSmall) {
        onCommit([...items, it], before.current)
        onSelect(null)
      }
    } else if (g.mode === 'text') {
      const item: SketchItem = {
        id: uid(),
        color,
        kind: 'text',
        x: g.at.x,
        y: g.at.y,
        text: '',
        size: 18,
      }
      onLive([...items, item])
      onSelect(item.id)
      setEditingText({ id: item.id, isNew: true })
    } else if (g.mode === 'move') {
      if (g.moved) onCommit(items, before.current)
    } else if (g.mode === 'resize' || g.removed) {
      onCommit(items, before.current)
    }
  }

  function finishText(id: string, text: string) {
    const isNew = editingText?.isNew ?? false
    setEditingText(null)
    const trimmed = text.replace(/\s+$/, '')
    const next = trimmed
      ? items.map((i) => (i.id === id && i.kind === 'text' ? { ...i, text: trimmed } : i))
      : items.filter((i) => i.id !== id)
    onCommit(next, isNew ? before.current.filter((i) => i.id !== id) : before.current)
    if (!trimmed) onSelect(null)
  }

  const components = items.filter((i) => i.kind === 'component')
  const images = items.filter((i) => i.kind === 'image')
  const marks = items.filter(
    (i) => i.kind !== 'component' && i.kind !== 'text' && i.kind !== 'image',
  )
  const texts = items.filter((i) => i.kind === 'text')
  const selBox: Box | null = selected ? bbox(selected) : null

  return (
    <div
      ref={wrapRef}
      className="bg-surface-sunken relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
    >
      <div style={{ width: width * scale, height: height * scale }} className="relative shrink-0">
        <div
          ref={boardRef}
          className={cn(
            'bg-paper shadow-float absolute top-0 left-0 origin-top-left overflow-hidden',
            frame === 'phone'
              ? 'ring-foreground/80 rounded-[44px] ring-[8px]'
              : 'ring-border-strong rounded-2xl ring-1',
          )}
          style={{ width, height, transform: `scale(${scale})` }}
        >
          {frame === 'desktop' && (
            <div className="border-border bg-surface-sunken flex h-8 items-center gap-1.5 border-b px-3">
              <span className="bg-danger/70 size-2.5 rounded-full" />
              <span className="bg-diet size-2.5 rounded-full" />
              <span className="bg-exercise size-2.5 rounded-full" />
            </div>
          )}

          {images.map((img) =>
            img.kind === 'image' ? (
              // 截图是 data URL，不走 next/image 优化
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.id}
                src={img.src}
                alt="截图"
                draggable={false}
                className="shadow-card ring-border pointer-events-none absolute rounded-lg object-fill ring-1"
                style={{ left: img.x, top: img.y, width: img.w, height: img.h }}
              />
            ) : null,
          )}

          {components.map((c) => {
            const entry = getComponentEntry(c.ref)
            return (
              <div
                key={c.id}
                className="pointer-events-none absolute"
                style={{ left: c.x, top: c.y, width: c.w, height: c.h }}
              >
                {c.note && (
                  <span className="bg-primary text-tiny text-on-primary absolute -top-6 left-0 max-w-[260px] truncate rounded-md px-1.5 py-0.5 font-semibold">
                    {c.note}
                  </span>
                )}
                <div className="size-full overflow-hidden">{entry?.render(c.props)}</div>
              </div>
            )
          })}

          <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
            {[...marks, ...(draft ? [draft] : [])].map((m) => (
              <Mark key={m.id} item={m} />
            ))}
          </svg>

          {texts.map((t) =>
            t.kind === 'text' && editingText?.id !== t.id ? (
              <p
                key={t.id}
                className="pointer-events-none absolute leading-[1.35] font-semibold whitespace-pre"
                style={{ left: t.x, top: t.y, fontSize: t.size, color: sketchColors[t.color] }}
              >
                {t.text}
              </p>
            ) : null,
          )}

          {selBox && !editingText && (
            <div
              className="border-primary pointer-events-none absolute rounded-md border-2 border-dashed"
              style={{
                left: selBox.x - 6,
                top: selBox.y - 6,
                width: selBox.w + 12,
                height: selBox.h + 12,
              }}
            >
              {selected && canResize(selected) && (
                <span
                  className="border-primary bg-surface absolute -right-2 -bottom-2 rounded-sm border-2"
                  style={{ width: HANDLE / scale, height: HANDLE / scale }}
                />
              )}
            </div>
          )}

          {/* 交互层：盖在最上面接收所有指针事件 */}
          <div
            className={cn(
              'absolute inset-0 touch-none',
              tool === 'select'
                ? 'cursor-default'
                : tool === 'text'
                  ? 'cursor-text'
                  : 'cursor-crosshair',
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={(e) => {
              const hit = topHit(items, toBoard(e), 6 / scale)
              if (hit?.kind === 'text') {
                before.current = items
                setEditingText({ id: hit.id, isNew: false })
              }
            }}
          />

          {editingText &&
            (() => {
              const t = items.find((i) => i.id === editingText.id)
              if (!t || t.kind !== 'text') return null
              return (
                <textarea
                  autoFocus
                  defaultValue={t.text}
                  placeholder="输入文字，Esc 或点别处结束"
                  onBlur={(e) => finishText(t.id, e.currentTarget.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Escape') e.currentTarget.blur()
                  }}
                  className="border-primary bg-surface/90 absolute z-10 min-w-48 resize rounded-md border-2 p-1 leading-[1.35] font-semibold outline-none"
                  style={{ left: t.x, top: t.y, fontSize: t.size, color: sketchColors[t.color] }}
                />
              )
            })()}
        </div>
      </div>
    </div>
  )
}

function Mark({ item }: { item: SketchItem }) {
  const stroke = sketchColors[item.color]
  const common = {
    fill: 'none',
    stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (item.kind) {
    case 'stroke':
      return <path d={strokePath(item.points)} strokeWidth={item.width} {...common} />
    case 'rect': {
      const b = bbox(item)
      return (
        <rect
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx={10}
          strokeWidth={item.width}
          {...common}
        />
      )
    }
    case 'ellipse': {
      const b = bbox(item)
      return (
        <ellipse
          cx={b.x + b.w / 2}
          cy={b.y + b.h / 2}
          rx={b.w / 2}
          ry={b.h / 2}
          strokeWidth={item.width}
          {...common}
        />
      )
    }
    case 'arrow': {
      const x2 = item.x + item.w
      const y2 = item.y + item.h
      return (
        <g strokeWidth={item.width} {...common}>
          <path d={`M${item.x} ${item.y}L${x2} ${y2}`} />
          <path d={arrowHead(item.x, item.y, x2, y2, 10 + item.width * 2)} />
        </g>
      )
    }
    default:
      return null
  }
}
