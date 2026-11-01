'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { AnnotationEditor } from './annotation-editor'
import { AnnotationPanel } from './annotation-panel'
import {
  describeElement,
  flashElement,
  isAnnotatorUi,
  pickTarget,
  pinPosition,
  resolveElement,
} from './dom'
import { captureRegion, RegionSelector, startTabCapture, type Region } from './screenshot'
import { SketchBoard } from './sketch/sketch-board'
import { frameSize, type Sketch } from './sketch/types'
import { annotationStore, sketchStore, useAnnotations, useSketches } from './store'
import type { Annotation, AnnotationDraft } from './types'

interface HoverBox {
  x: number
  y: number
  width: number
  height: number
  label: string
}

interface Pin {
  id: string
  n: number
  x: number
  y: number
  found: boolean
  priority: Annotation['priority']
}

const subscribeNothing = () => () => {}

/** 画板从哪里打开：新批注的编辑框、独立的"画板"按钮、或列表里已有的批注 */
type BoardContext =
  | { from: 'draft'; sketch: Sketch }
  | { from: 'standalone'; sketch: Sketch }
  | { from: 'annotation'; sketch: Sketch; annotationId: string }

function newSketch(title: string, route: string): Sketch {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title,
    route,
    frame: window.innerWidth < 768 ? 'phone' : 'desktop',
    items: [],
    createdAt: now,
    updatedAt: now,
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5))

/** 在当前页高亮批注对应的区块；区块找不到时滚到批注时记录的位置 */
function locateOnPage(a: Annotation) {
  const el = resolveElement(a)
  if (el) flashElement(el)
  else window.scrollTo({ top: a.target.rect.y - 120, behavior: 'smooth' })
}

/**
 * 调试批注工具（只挂在 /dev 下）。
 * 流程：点图钉或按 Alt+Shift+A 进入拾取 → 悬停高亮区块 → 点击写批注 → 列表里导出 JSON。
 * 导出的文件放到 docs/designs/reviews/，下一轮按文件逐条修改。
 */
export function Annotator() {
  const pathname = usePathname()
  const router = useRouter()
  const items = useAnnotations()
  const sketches = useSketches()
  const isClient = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  )

  const [picking, setPicking] = useState(false)
  const [hover, setHover] = useState<HoverBox | null>(null)
  const [draft, setDraft] = useState<AnnotationDraft | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [pins, setPins] = useState<Pin[]>([])
  const [pendingLocate, setPendingLocate] = useState<string | null>(null)
  const [board, setBoard] = useState<BoardContext | null>(null)
  // 截图流程：idle → selecting（框选）→ capturing（隐藏所有批注界面后取帧）→ 打开画板
  const [shot, setShot] = useState<'idle' | 'selecting' | 'capturing'>('idle')
  const [toast, setToast] = useState<string | null>(null)
  const shotStream = useRef<MediaStream | null>(null)

  // 快捷键：Alt+Shift+A 切换拾取，Esc 退出拾取
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === 'KeyA') {
        e.preventDefault()
        setPicking((v) => !v)
        setHover(null)
      } else if (e.key === 'Escape') {
        setPicking(false)
        setHover(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 拾取模式：捕获阶段拦截点击，避免触发页面上的链接和按钮
  useEffect(() => {
    if (!picking) return
    const onMove = (e: PointerEvent) => {
      const t = e.target
      if (!(t instanceof Element) || isAnnotatorUi(t)) return setHover(null)
      const el = pickTarget(t)
      const r = el.getBoundingClientRect()
      setHover({
        x: r.left,
        y: r.top,
        width: r.width,
        height: r.height,
        label: el.getAttribute('data-ann') ?? `<${el.tagName.toLowerCase()}>`,
      })
    }
    const block = (e: Event) => {
      const t = e.target
      if (t instanceof Element && !isAnnotatorUi(t)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const onClick = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Element) || isAnnotatorUi(t)) return
      e.preventDefault()
      e.stopPropagation()
      const el = pickTarget(t)
      const r = el.getBoundingClientRect()
      setDraft({
        editingId: null,
        target: describeElement(el),
        point: {
          rx: clamp01((e.clientX - r.left) / r.width),
          ry: clamp01((e.clientY - r.top) / r.height),
        },
        anchor: { x: e.clientX, y: e.clientY },
        comment: '',
        category: 'visual',
        priority: 'P1',
        sketchId: null,
      })
      setPicking(false)
      setHover(null)
    }
    document.addEventListener('pointermove', onMove, true)
    document.addEventListener('pointerdown', block, true)
    document.addEventListener('click', onClick, true)
    const root = document.documentElement
    root.style.cursor = 'crosshair'
    return () => {
      document.removeEventListener('pointermove', onMove, true)
      document.removeEventListener('pointerdown', block, true)
      document.removeEventListener('click', onClick, true)
      root.style.cursor = ''
    }
  }, [picking])

  // 图钉位置依赖页面布局：批注变化、路由变化、窗口和页面尺寸变化时重新计算
  useEffect(() => {
    let raf = 0
    const recompute = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const onPage = items.filter((a) => a.route === pathname)
        setPins(
          onPage
            .map((a, i) => ({ a, n: i + 1 }))
            .filter(({ a }) => a.status === 'open')
            .map(({ a, n }) => ({ id: a.id, n, priority: a.priority, ...pinPosition(a) })),
        )
      })
    }
    recompute()
    window.addEventListener('resize', recompute)
    const ro = new ResizeObserver(recompute)
    ro.observe(document.body)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', recompute)
      ro.disconnect()
    }
  }, [items, pathname])

  // 从"全部"列表定位到其他页面的批注：跳转后等页面渲染完再高亮
  useEffect(() => {
    if (!pendingLocate) return
    const timer = window.setTimeout(() => {
      const a = items.find((x) => x.id === pendingLocate)
      if (a && a.route === pathname) locateOnPage(a)
      setPendingLocate(null)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [pendingLocate, pathname, items])

  function locate(a: Annotation) {
    if (a.route === pathname) return locateOnPage(a)
    setPendingLocate(a.id)
    router.push(a.route)
  }

  function edit(a: Annotation) {
    setDraft({
      editingId: a.id,
      target: a.target,
      point: a.point,
      anchor: { x: window.innerWidth / 2 - 160, y: 120 },
      comment: a.comment,
      category: a.category,
      priority: a.priority,
      sketchId: a.sketchId ?? null,
    })
  }

  function openSketchForDraft(comment: string) {
    if (!draft) return
    const existing = draft.sketchId ? sketchStore.get(draft.sketchId) : undefined
    setBoard({ from: 'draft', sketch: existing ?? newSketch(comment.trim() || '草图', pathname) })
  }

  function openSketchForAnnotation(a: Annotation) {
    const existing = a.sketchId ? sketchStore.get(a.sketchId) : undefined
    setBoard({
      from: 'annotation',
      annotationId: a.id,
      sketch: existing ?? newSketch(a.comment, a.route),
    })
  }

  function saveSketch(sketch: Sketch) {
    if (!board) return
    sketchStore.save(sketch)
    if (board.from === 'draft' && draft) {
      setDraft({ ...draft, sketchId: sketch.id })
    } else if (board.from === 'annotation') {
      annotationStore.update(board.annotationId, { sketchId: sketch.id })
    } else if (board.from === 'standalone') {
      // 独立画的草图挂到"整页"上，接着弹出编辑框补充说明和优先级
      setDraft({
        editingId: null,
        target: describeElement(document.body),
        point: { rx: 0.02, ry: 0.02 },
        anchor: { x: window.innerWidth / 2 - 160, y: 120 },
        comment: sketch.title,
        category: 'layout',
        priority: 'P1',
        sketchId: sketch.id,
      })
    }
    setBoard(null)
  }

  function showToast(text: string) {
    setToast(text)
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 3200)
  }

  function stopShot() {
    shotStream.current?.getTracks().forEach((t) => t.stop())
    shotStream.current = null
    setShot('idle')
  }

  async function startScreenshot() {
    try {
      const stream = await startTabCapture()
      shotStream.current = stream
      // 用户在浏览器的共享提示条上点了"停止共享"
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (shotStream.current === stream) stopShot()
      })
      setPicking(false)
      setShot('selecting')
    } catch (err) {
      const denied = err instanceof DOMException && err.name === 'NotAllowedError'
      showToast(
        denied ? '没有截图：需要在弹窗里选择"当前标签页"并允许共享' : '这个浏览器不支持页面截图',
      )
    }
  }

  async function finishScreenshot(region: Region) {
    const stream = shotStream.current
    if (!stream) return setShot('idle')
    setShot('capturing')
    try {
      const src = await captureRegion(stream, region)
      const sketch = newSketch(`截图 ${new Date().toTimeString().slice(0, 5)}`, pathname)
      // 截图等比缩放进画框，留出边距
      const { width, height } = frameSize[sketch.frame]
      const top = sketch.frame === 'desktop' ? 56 : 24
      const scale = Math.min(1, (width - 48) / region.w, (height - top - 24) / region.h)
      sketch.items = [
        {
          id: crypto.randomUUID(),
          kind: 'image',
          color: 'ink',
          src,
          x: 24,
          y: top,
          w: Math.round(region.w * scale),
          h: Math.round(region.h * scale),
          source: { route: pathname, rect: region },
        },
      ]
      setBoard({ from: 'standalone', sketch })
    } catch {
      showToast('截图失败，请重试')
    } finally {
      shotStream.current = null
      setShot('idle')
    }
  }

  function cancelDraft() {
    // 新建批注时画的草图，如果批注最后没保存就一起丢掉
    if (draft && !draft.editingId && draft.sketchId) sketchStore.remove(draft.sketchId)
    setDraft(null)
  }

  function save(values: Pick<Annotation, 'comment' | 'category' | 'priority'>) {
    if (!draft) return
    if (draft.editingId) {
      annotationStore.update(draft.editingId, { ...values, sketchId: draft.sketchId })
    } else {
      const now = new Date().toISOString()
      annotationStore.add({
        id: crypto.randomUUID(),
        route: pathname,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          dpr: Math.round(window.devicePixelRatio * 100) / 100,
        },
        target: draft.target,
        point: draft.point,
        status: 'open',
        sketchId: draft.sketchId,
        createdAt: now,
        updatedAt: now,
        ...values,
      })
    }
    setDraft(null)
  }

  if (!isClient) return null
  // 截图时整套批注界面（图钉、启动器、列表）都不渲染，避免被截进图里
  if (shot !== 'idle') {
    return shot === 'selecting'
      ? createPortal(
          <RegionSelector onSelect={finishScreenshot} onCancel={stopShot} />,
          document.body,
        )
      : null
  }
  const openOnPage = items.filter((a) => a.route === pathname && a.status === 'open').length

  return createPortal(
    <>
      {/* 图钉：文档坐标，随页面滚动 */}
      <div
        data-annotator-ui=""
        className="pointer-events-none absolute inset-x-0 top-0 z-[2147483590] overflow-x-clip"
      >
        {pins.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-label={`批注 ${p.n}`}
            onClick={() => {
              setPanelOpen(true)
              const a = items.find((x) => x.id === p.id)
              if (a) locateOnPage(a)
            }}
            className={cn(
              'text-tiny shadow-float ring-surface pointer-events-auto absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-bold ring-2 transition-transform hover:scale-125',
              p.priority === 'P0' ? 'bg-danger text-surface' : 'bg-primary text-on-primary',
              // 区块找不到时图钉半透明，提示"位置可能不准"
              !p.found && 'opacity-60',
            )}
            style={{
              left: Math.min(p.x, typeof window !== 'undefined' ? window.innerWidth - 24 : p.x),
              top: p.y,
            }}
          >
            {p.n}
          </button>
        ))}
      </div>

      {picking && hover && (
        <div
          data-annotator-ui=""
          className="border-primary bg-primary/10 pointer-events-none fixed z-[2147483595] rounded-lg border-2 border-dashed"
          style={{ left: hover.x, top: hover.y, width: hover.width, height: hover.height }}
        >
          <span className="bg-foreground text-tiny text-surface absolute -top-6 left-0 max-w-[60vw] truncate rounded-md px-1.5 py-0.5 font-mono">
            {hover.label}
          </span>
        </div>
      )}

      {/* 启动器 */}
      <div
        data-annotator-ui=""
        className="bg-foreground text-surface shadow-float fixed right-4 bottom-[calc(var(--safe-bottom)+1rem)] z-[2147483600] flex items-center gap-1 rounded-full p-1"
      >
        <button
          type="button"
          onClick={() => {
            setPicking((v) => !v)
            setHover(null)
          }}
          aria-pressed={picking}
          title="批注模式（Alt+Shift+A）"
          className={cn(
            'text-caption flex h-10 items-center gap-1.5 rounded-full px-3 font-semibold transition-colors',
            picking ? 'bg-primary text-on-primary' : 'hover:bg-surface/10',
          )}
        >
          <Icon name="pin" size={18} />
          {picking ? '点选区块…' : '批注'}
        </button>
        <button
          type="button"
          onClick={() => setBoard({ from: 'standalone', sketch: newSketch('新草图', pathname) })}
          aria-label="画板"
          title="画板：手绘 + 引用组件"
          className="hover:bg-surface/10 flex size-10 items-center justify-center rounded-full"
        >
          <Icon name="palette" size={18} />
        </button>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          aria-label="批注列表"
          title="批注列表"
          className="hover:bg-surface/10 relative flex size-10 items-center justify-center rounded-full"
        >
          <Icon name="menu" size={18} />
          {openOnPage > 0 && (
            <span className="bg-primary text-on-primary text-tiny absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full font-bold">
              {openOnPage}
            </span>
          )}
        </button>
      </div>

      {panelOpen && (
        <AnnotationPanel
          items={items}
          route={pathname}
          onLocate={locate}
          onEdit={edit}
          onOpenSketch={openSketchForAnnotation}
          onScreenshot={startScreenshot}
          onClose={() => setPanelOpen(false)}
        />
      )}

      {draft && (
        <AnnotationEditor
          key={draft.editingId ?? `${draft.anchor.x}-${draft.anchor.y}`}
          draft={draft}
          onSave={save}
          onCancel={cancelDraft}
          sketch={draft.sketchId ? sketches.find((s) => s.id === draft.sketchId) : undefined}
          onOpenSketch={openSketchForDraft}
        />
      )}

      {toast && (
        <p
          data-annotator-ui=""
          role="status"
          className="animate-pop-in bg-foreground text-caption text-surface shadow-float fixed right-4 bottom-[calc(var(--safe-bottom)+4.5rem)] z-[2147483601] max-w-80 rounded-2xl px-4 py-2.5"
        >
          {toast}
        </p>
      )}

      {board && (
        <SketchBoard
          key={board.sketch.id}
          initial={board.sketch}
          onSave={saveSketch}
          onClose={() => setBoard(null)}
        />
      )}
    </>,
    document.body,
  )
}
