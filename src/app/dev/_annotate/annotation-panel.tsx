'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Icon, type IconName } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { SketchThumb } from './sketch/sketch-thumb'
import {
  annotationStore,
  buildExport,
  exportFileName,
  importExport,
  parseExport,
  useSketches,
} from './store'
import { annotationCategories, type Annotation } from './types'

const categoryLabel = new Map<string, string>(annotationCategories.map((c) => [c.value, c.label]))

const priorityClass: Record<Annotation['priority'], string> = {
  P0: 'bg-danger text-surface',
  P1: 'bg-warning text-foreground',
  P2: 'bg-surface/20 text-surface',
}

interface AnnotationPanelProps {
  items: Annotation[]
  route: string
  onLocate: (a: Annotation) => void
  onEdit: (a: Annotation) => void
  onOpenSketch: (a: Annotation) => void
  /** 框选截图，截好后放进画板 */
  onScreenshot: () => void
  onClose: () => void
}

/** 批注列表：本页 / 全部切换，逐条定位、编辑、标记解决；底部导入导出 */
export function AnnotationPanel({
  items,
  route,
  onLocate,
  onEdit,
  onOpenSketch,
  onScreenshot,
  onClose,
}: AnnotationPanelProps) {
  const sketches = useSketches()
  const sketchById = new Map(sketches.map((s) => [s.id, s]))
  const thumbFor = (a: Annotation) => {
    const sketch = a.sketchId ? sketchById.get(a.sketchId) : undefined
    if (!sketch) return null
    return (
      <button
        type="button"
        onClick={() => onOpenSketch(a)}
        title="打开草图"
        className="mt-1.5 block rounded-lg transition-transform hover:scale-[1.02]"
      >
        <SketchThumb sketch={sketch} height={88} />
      </button>
    )
  }
  const [scope, setScope] = useState<'page' | 'all'>('page')
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const shown = scope === 'page' ? items.filter((a) => a.route === route) : items
  const openCount = shown.filter((a) => a.status === 'open').length

  function flash(msg: string) {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 2000)
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(buildExport(items), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportFileName()
    a.click()
    URL.revokeObjectURL(url)
    flash(`已导出 ${items.length} 条，放进 docs/designs/reviews/`)
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildExport(items), null, 2))
      flash('已复制到剪贴板')
    } catch {
      flash('复制失败，请改用导出')
    }
  }

  async function importJson(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = parseExport(JSON.parse(await file.text()))
      importExport(parsed)
      flash(`已导入 ${parsed.items.length} 条批注、${parsed.sketches.length} 张草图`)
    } catch {
      flash('文件不是有效的批注 JSON')
    }
  }

  return (
    <section
      data-annotator-ui=""
      aria-label="批注列表"
      className="animate-pop-in bg-foreground text-surface shadow-float fixed right-3 bottom-[calc(var(--safe-bottom)+4.5rem)] z-[2147483600] flex max-h-[min(640px,calc(100dvh-6.5rem))] w-[min(380px,calc(100vw-24px))] flex-col rounded-2xl"
    >
      <header className="border-surface/10 flex items-center gap-2 border-b px-4 py-3">
        <Icon name="pin" size={18} className="text-primary" />
        <h2 className="flex-1 font-semibold">
          批注 <span className="text-caption text-subtle font-normal">· 待处理 {openCount}</span>
        </h2>
        <div className="bg-surface/10 text-tiny flex rounded-full p-0.5 font-semibold">
          {(['page', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={cn(
                'h-7 rounded-full px-2.5',
                scope === s ? 'bg-surface text-foreground' : 'text-surface/70',
              )}
            >
              {s === 'page' ? '本页' : '全部'}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="关闭批注列表"
          onClick={onClose}
          className="hover:bg-surface/10 flex size-8 items-center justify-center rounded-full"
        >
          <Icon name="x" size={16} />
        </button>
      </header>

      <ol className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {shown.length === 0 && (
          <li className="text-caption text-subtle px-3 py-8 text-center">
            还没有批注。点右下角的图钉进入批注模式，再点页面上的区块。
          </li>
        )}
        {shown.map((a, i) => (
          <li
            key={a.id}
            className={cn(
              'group hover:bg-surface/5 rounded-xl px-3 py-2.5',
              a.status === 'resolved' && 'opacity-50',
            )}
          >
            <div className="text-tiny mb-1 flex items-center gap-1.5">
              <span className="bg-primary text-on-primary flex size-5 items-center justify-center rounded-full font-bold">
                {i + 1}
              </span>
              <span className={cn('rounded px-1.5 font-semibold', priorityClass[a.priority])}>
                {a.priority}
              </span>
              <span className="text-subtle">{categoryLabel.get(a.category)}</span>
              {scope === 'all' && <span className="text-subtle truncate font-mono">{a.route}</span>}
            </div>
            <p className={cn('text-caption', a.status === 'resolved' && 'line-through')}>
              {a.comment}
            </p>
            <p className="text-tiny text-subtle mt-0.5 truncate font-mono">
              {a.target.annId ?? a.target.selector}
            </p>
            {thumbFor(a)}

            <div className="mt-1.5 flex flex-wrap gap-1">
              <PanelAction icon="pin" label="定位" onClick={() => onLocate(a)} />
              <PanelAction icon="edit" label="编辑" onClick={() => onEdit(a)} />
              <PanelAction
                icon="palette"
                label={a.sketchId ? '草图' : '加草图'}
                onClick={() => onOpenSketch(a)}
              />
              <PanelAction
                icon="check"
                label={a.status === 'open' ? '标记解决' : '重新打开'}
                onClick={() =>
                  annotationStore.update(a.id, {
                    status: a.status === 'open' ? 'resolved' : 'open',
                  })
                }
              />
              <PanelAction icon="trash" label="删除" onClick={() => annotationStore.remove(a.id)} />
            </div>
          </li>
        ))}
      </ol>

      <footer className="border-surface/10 flex flex-wrap items-center gap-1.5 border-t px-3 py-2.5">
        <PanelAction icon="download" label="导出 JSON" onClick={exportJson} strong />
        <PanelAction icon="copy" label="复制" onClick={copyJson} />
        <PanelAction icon="plus" label="导入" onClick={() => fileRef.current?.click()} />
        <PanelAction icon="camera" label="截图" onClick={onScreenshot} />
        <PanelAction
          icon="trash"
          label="清空"
          onClick={() => {
            if (window.confirm(`清空全部 ${items.length} 条批注？清空前建议先导出。`)) {
              annotationStore.clear()
            }
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={importJson}
        />
        {notice && (
          <span role="status" className="text-tiny text-diet w-full px-1 pt-1">
            {notice}
          </span>
        )}
      </footer>
    </section>
  )
}

function PanelAction({
  icon,
  label,
  onClick,
  strong = false,
}: {
  icon: IconName
  label: string
  onClick: () => void
  strong?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-tiny inline-flex h-8 items-center gap-1 rounded-full px-2.5 font-semibold transition-colors',
        strong ? 'bg-primary text-on-primary' : 'text-surface/80 hover:bg-surface/10',
      )}
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  )
}
