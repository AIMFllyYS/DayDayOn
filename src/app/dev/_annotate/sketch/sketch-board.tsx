'use client'

import { useEffect, useState } from 'react'
import { Icon, type IconName } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { bbox, sketchToSvg } from './geometry'
import {
  componentLabel,
  componentRegistry,
  defaultProps,
  getComponentEntry,
  type ComponentEntry,
} from './registry'
import { SketchCanvas } from './sketch-canvas'
import {
  frameSize,
  sketchColors,
  type ComponentItem,
  type Sketch,
  type SketchColor,
  type SketchFrame,
  type SketchItem,
  type SketchTool,
} from './types'

const tools: { tool: SketchTool; icon: IconName; label: string; key: string }[] = [
  { tool: 'select', icon: 'pointer', label: '选择 / 移动', key: 'v' },
  { tool: 'pen', icon: 'pen', label: '画笔', key: 'p' },
  { tool: 'rect', icon: 'square', label: '矩形', key: 'r' },
  { tool: 'ellipse', icon: 'circle', label: '椭圆', key: 'o' },
  { tool: 'arrow', icon: 'arrow', label: '箭头', key: 'a' },
  { tool: 'text', icon: 'type', label: '文字', key: 't' },
  { tool: 'eraser', icon: 'eraser', label: '橡皮', key: 'e' },
]

const widths = [2, 4, 8]
const groups = ['原子', '布局', '宠物', 'Agent'] as const
const uid = () => Math.random().toString(36).slice(2, 10)

interface SketchBoardProps {
  initial: Sketch
  onSave: (sketch: Sketch) => void
  onClose: () => void
}

/**
 * 草图画板：手绘 + 引用真实组件，用来说明"想要什么样子"。
 * 保存后挂在一条批注上，导出时随批注一起写进 JSON（组件以 ref + props 描述）。
 */
export function SketchBoard({ initial, onSave, onClose }: SketchBoardProps) {
  const [title, setTitle] = useState(initial.title)
  const [frame, setFrame] = useState<SketchFrame>(initial.frame)
  const [items, setItems] = useState<SketchItem[]>(initial.items)
  const [past, setPast] = useState<SketchItem[][]>([])
  const [future, setFuture] = useState<SketchItem[][]>([])
  const [tool, setTool] = useState<SketchTool>('pen')
  const [color, setColor] = useState<SketchColor>('primary')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const commit = (next: SketchItem[], before: SketchItem[]) => {
    setPast((p) => [...p.slice(-60), before])
    setFuture([])
    setItems(next)
  }
  const undo = () => {
    const prev = past.at(-1)
    if (!prev) return
    setPast(past.slice(0, -1))
    setFuture([items, ...future])
    setItems(prev)
    setSelectedId(null)
  }
  const redo = () => {
    const next = future[0]
    if (!next) return
    setFuture(future.slice(1))
    setPast([...past, items])
    setItems(next)
  }
  const removeSelected = () => {
    if (!selectedId) return
    commit(
      items.filter((i) => i.id !== selectedId),
      items,
    )
    setSelectedId(null)
  }
  const updateItem = (id: string, patch: (i: SketchItem) => SketchItem) =>
    commit(
      items.map((i) => (i.id === id ? patch(i) : i)),
      items,
    )

  function addComponent(entry: ComponentEntry) {
    const { width, height } = frameSize[frame]
    // 新组件从上往下依次排开，避免叠在一起
    const n = items.filter((i) => i.kind === 'component').length % 8
    const item: ComponentItem = {
      id: uid(),
      kind: 'component',
      color: 'primary',
      ref: entry.ref,
      props: defaultProps(entry),
      x: Math.max(8, Math.round(width / 2 - entry.w / 2)),
      y: Math.min(height - entry.h - 8, 56 + n * Math.round(height / 9)),
      w: Math.min(entry.w, width - 16),
      h: entry.h,
    }
    commit([...items, item], items)
    setSelectedId(item.id)
    setTool('select')
    setPaletteOpen(false)
  }

  function save() {
    onSave({
      ...initial,
      title: title.trim() || '未命名草图',
      frame,
      items,
      updatedAt: new Date().toISOString(),
    })
  }

  function downloadSvg() {
    const svg = sketchToSvg({ ...initial, title, frame, items }, componentLabel)
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `sketch-${(title || 'untitled').replace(/[\\/:*?"<>|\s]+/g, '-')}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 快捷键：工具字母、撤销 / 重做、删除、Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
        return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        removeSelected()
      } else if (e.key === 'Escape') {
        if (selectedId) setSelectedId(null)
        else onClose()
      } else if (!mod) {
        const t = tools.find((x) => x.key === e.key.toLowerCase())
        if (t) setTool(t.tool)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const selected = items.find((i) => i.id === selectedId) ?? null

  return (
    <div
      data-annotator-ui=""
      role="dialog"
      aria-label="草图画板"
      className="animate-fade-in bg-foreground/45 fixed inset-0 z-[2147483602] flex p-0 backdrop-blur-sm md:p-4"
    >
      <div className="animate-pop-in bg-surface text-foreground shadow-float flex min-w-0 flex-1 flex-col overflow-hidden md:rounded-3xl">
        {/* 顶栏 */}
        <header className="border-border flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <Icon name="palette" size={20} className="text-primary" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="草图标题"
            placeholder="给草图起个名字"
            className="text-subhead hover:bg-surface-sunken focus:bg-surface-sunken h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 font-semibold outline-none sm:max-w-72"
          />
          <div className="bg-surface-sunken text-tiny flex rounded-full p-0.5 font-semibold">
            {(Object.keys(frameSize) as SketchFrame[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrame(f)}
                className={cn(
                  'h-8 rounded-full px-3',
                  frame === f ? 'bg-surface shadow-soft' : 'text-muted',
                )}
              >
                {frameSize[f].label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <BarButton
              icon="undo"
              label="撤销（Ctrl+Z）"
              onClick={undo}
              disabled={past.length === 0}
            />
            <BarButton
              icon="redo"
              label="重做（Ctrl+Shift+Z）"
              onClick={redo}
              disabled={future.length === 0}
            />
            <BarButton icon="download" label="导出 SVG" onClick={downloadSvg} />
            <BarButton
              icon="puzzle"
              label="组件"
              onClick={() => setPaletteOpen((v) => !v)}
              className="lg:hidden"
            />
            <button
              type="button"
              onClick={onClose}
              className="text-caption text-muted hover:bg-surface-sunken h-9 rounded-full px-3 font-semibold"
            >
              取消
            </button>
            <button
              type="button"
              onClick={save}
              className="bg-primary text-caption text-on-primary shadow-primary h-9 rounded-full px-4 font-semibold"
            >
              保存草图
            </button>
          </div>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
          {/* 工具栏 */}
          <nav
            aria-label="绘图工具"
            className="border-border flex shrink-0 [scrollbar-width:none] items-center gap-1 overflow-x-auto border-b p-2 md:flex-col md:border-r md:border-b-0"
          >
            {tools.map((t) => (
              <button
                key={t.tool}
                type="button"
                title={`${t.label}（${t.key.toUpperCase()}）`}
                aria-label={t.label}
                aria-pressed={tool === t.tool}
                onClick={() => setTool(t.tool)}
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                  tool === t.tool
                    ? 'bg-primary-soft text-primary-ink'
                    : 'text-muted hover:bg-surface-sunken',
                )}
              >
                <Icon name={t.icon} size={20} />
              </button>
            ))}
            <span className="bg-border mx-1 h-6 w-px shrink-0 md:mx-0 md:my-1 md:h-px md:w-6" />
            {(Object.keys(sketchColors) as SketchColor[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`颜色 ${c}`}
                aria-pressed={color === c}
                onClick={() => {
                  setColor(c)
                  if (selected && selected.kind !== 'component')
                    updateItem(selected.id, (i) => ({ ...i, color: c }))
                }}
                className="flex size-8 shrink-0 items-center justify-center rounded-full"
              >
                <span
                  className={cn(
                    'size-5 rounded-full transition-transform',
                    color === c && 'scale-110',
                  )}
                  style={{
                    background: sketchColors[c],
                    outline: color === c ? `2px solid ${sketchColors[c]}` : undefined,
                    outlineOffset: 2,
                  }}
                />
              </button>
            ))}
            <span className="bg-border mx-1 h-6 w-px shrink-0 md:mx-0 md:my-1 md:h-px md:w-6" />
            {widths.map((w) => (
              <button
                key={w}
                type="button"
                aria-label={`粗细 ${w}`}
                aria-pressed={strokeWidth === w}
                onClick={() => setStrokeWidth(w)}
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg',
                  strokeWidth === w ? 'bg-surface-sunken' : 'hover:bg-surface-sunken',
                )}
              >
                <span className="bg-foreground rounded-full" style={{ width: 18, height: w }} />
              </button>
            ))}
          </nav>

          <SketchCanvas
            frame={frame}
            items={items}
            tool={tool}
            color={color}
            strokeWidth={strokeWidth}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onLive={setItems}
            onCommit={commit}
          />

          {/* 组件库 + 属性 */}
          <aside
            className={cn(
              'border-border bg-surface w-full shrink-0 flex-col overflow-y-auto lg:flex lg:w-72 lg:border-l',
              paletteOpen
                ? 'shadow-float absolute inset-y-0 right-0 z-20 flex max-w-80 border-l'
                : 'hidden',
            )}
          >
            {/* 选中元素时属性面板放在上面，组件库始终可用，方便连续放多个组件 */}
            {selected && (
              <div className="border-border border-b border-dashed">
                <Inspector
                  key={selected.id}
                  item={selected}
                  onChange={(patch) => updateItem(selected.id, patch)}
                  onDelete={removeSelected}
                  onLayer={(dir) => {
                    const rest = items.filter((i) => i.id !== selected.id)
                    commit(dir === 'up' ? [...rest, selected] : [selected, ...rest], items)
                  }}
                />
              </div>
            )}
            <Palette onPick={addComponent} />
          </aside>
        </div>

        <footer className="border-border text-tiny text-muted hidden items-center gap-3 border-t px-3 py-1.5 md:flex">
          <span>{items.length} 个元素</span>
          <span>V 选择 · P 画笔 · R 矩形 · O 椭圆 · A 箭头 · T 文字 · E 橡皮 · Delete 删除</span>
          <span className="ml-auto">组件在下层，笔迹和文字在上层</span>
        </footer>
      </div>
    </div>
  )
}

function BarButton({
  icon,
  label,
  onClick,
  disabled,
  className,
}: {
  icon: IconName
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'text-muted hover:bg-surface-sunken flex size-9 items-center justify-center rounded-full disabled:opacity-35',
        className,
      )}
    >
      <Icon name={icon} size={18} />
    </button>
  )
}

function Palette({ onPick }: { onPick: (entry: ComponentEntry) => void }) {
  const [query, setQuery] = useState('')
  const q = query.trim()
  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <p className="font-semibold">引用组件</p>
        <p className="text-tiny text-muted">点一下放到画板中间，再拖到想要的位置</p>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索组件"
        aria-label="搜索组件"
        className="border-border bg-surface text-caption focus:border-primary h-9 rounded-xl border px-3 outline-none"
      />
      {groups.map((g) => {
        const list = componentRegistry.filter(
          (c) => c.group === g && (!q || c.label.includes(q) || c.ref.includes(q)),
        )
        if (list.length === 0) return null
        return (
          <section key={g}>
            <p className="text-tiny text-muted mb-1.5 font-semibold">{g}</p>
            <ul className="grid grid-cols-2 gap-1.5">
              {list.map((c) => (
                <li key={c.ref}>
                  <button
                    type="button"
                    onClick={() => onPick(c)}
                    className="border-border bg-background hover:border-primary hover:bg-primary-soft/40 flex h-16 w-full flex-col items-start justify-between overflow-hidden rounded-xl border p-2 text-left transition-colors"
                  >
                    <span className="text-caption font-semibold">{c.label}</span>
                    <span className="text-tiny text-subtle font-mono">{c.ref}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function Inspector({
  item,
  onChange,
  onDelete,
  onLayer,
}: {
  item: SketchItem
  onChange: (patch: (i: SketchItem) => SketchItem) => void
  onDelete: () => void
  onLayer: (dir: 'up' | 'down') => void
}) {
  const entry = item.kind === 'component' ? getComponentEntry(item.ref) : undefined
  const b = bbox(item)
  const kindLabel: Record<SketchItem['kind'], string> = {
    stroke: '笔迹',
    rect: '矩形',
    ellipse: '椭圆',
    arrow: '箭头',
    text: '文字',
    component: entry?.label ?? '组件',
    image: '截图',
  }
  return (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <p className="font-semibold">{kindLabel[item.kind]}</p>
        <p className="text-tiny text-muted font-mono">
          {Math.round(b.x)}, {Math.round(b.y)} · {Math.round(b.w)}×{Math.round(b.h)}
        </p>
      </div>

      {item.kind === 'component' && entry && (
        <>
          {entry.props.map((spec) => (
            <label
              key={spec.key}
              className="text-tiny text-muted flex flex-col gap-1 font-semibold"
            >
              {spec.label}
              {spec.type === 'select' ? (
                <select
                  value={item.props[spec.key] ?? spec.default}
                  onChange={(e) =>
                    onChange((i) =>
                      i.kind === 'component'
                        ? { ...i, props: { ...i.props, [spec.key]: e.target.value } }
                        : i,
                    )
                  }
                  className="border-border bg-surface text-caption text-foreground h-9 rounded-xl border px-2 font-normal"
                >
                  {spec.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  defaultValue={item.props[spec.key] ?? spec.default}
                  onBlur={(e) => {
                    const value = e.target.value
                    onChange((i) =>
                      i.kind === 'component'
                        ? { ...i, props: { ...i.props, [spec.key]: value } }
                        : i,
                    )
                  }}
                  className="border-border bg-surface text-caption text-foreground h-9 rounded-xl border px-2 font-normal"
                />
              )}
            </label>
          ))}
          <label className="text-tiny text-muted flex flex-col gap-1 font-semibold">
            说明（显示在组件上方）
            <textarea
              defaultValue={item.note ?? ''}
              placeholder="例如：这里换成大号按钮"
              onBlur={(e) => {
                const note = e.target.value.trim()
                onChange((i) => (i.kind === 'component' ? { ...i, note: note || undefined } : i))
              }}
              className="border-border bg-surface text-caption text-foreground min-h-16 rounded-xl border p-2 font-normal"
            />
          </label>
        </>
      )}

      {item.kind === 'text' && <p className="text-tiny text-muted">双击画板上的文字可以修改内容</p>}

      <div className="flex flex-wrap gap-1.5">
        <SmallButton onClick={() => onLayer('up')}>移到最上</SmallButton>
        <SmallButton onClick={() => onLayer('down')}>移到最下</SmallButton>
        <SmallButton onClick={onDelete} danger>
          删除
        </SmallButton>
      </div>
      <p className="text-tiny text-subtle">拖右下角的方块改尺寸；Esc 取消选择</p>
    </div>
  )
}

function SmallButton({
  children,
  onClick,
  danger = false,
}: {
  children: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-tiny h-8 rounded-full px-3 font-semibold',
        danger ? 'bg-danger-soft text-danger-ink' : 'bg-surface-sunken hover:bg-border',
      )}
    >
      {children}
    </button>
  )
}
