'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { SketchThumb } from './sketch/sketch-thumb'
import type { Sketch } from './sketch/types'
import {
  annotationCategories,
  annotationPriorities,
  type AnnotationCategory,
  type AnnotationDraft,
  type AnnotationPriority,
} from './types'

const EDITOR_WIDTH = 320
const EDITOR_HEIGHT_GUESS = 400

interface AnnotationEditorProps {
  draft: AnnotationDraft
  onSave: (values: {
    comment: string
    category: AnnotationCategory
    priority: AnnotationPriority
  }) => void
  onCancel: () => void
  /** 当前附带的草图（如果有） */
  sketch?: Sketch
  /** 打开画板；把正在输入的文字带过去当草图标题 */
  onOpenSketch: (comment: string) => void
}

/** 批注输入框：出现在点击位置附近，超出视口时向内收 */
export function AnnotationEditor({
  draft,
  onSave,
  onCancel,
  sketch,
  onOpenSketch,
}: AnnotationEditorProps) {
  const [comment, setComment] = useState(draft.comment)
  const [category, setCategory] = useState<AnnotationCategory>(draft.category)
  const [priority, setPriority] = useState<AnnotationPriority>(draft.priority)

  const left = Math.min(Math.max(12, draft.anchor.x + 12), window.innerWidth - EDITOR_WIDTH - 12)
  const top = Math.min(
    Math.max(12, draft.anchor.y + 12),
    window.innerHeight - EDITOR_HEIGHT_GUESS - 12,
  )
  const canSave = comment.trim().length > 0

  function save() {
    if (canSave) onSave({ comment: comment.trim(), category, priority })
  }

  return (
    <div
      data-annotator-ui=""
      role="dialog"
      aria-label={draft.editingId ? '编辑批注' : '新建批注'}
      className="animate-pop-in bg-foreground text-surface shadow-float fixed z-[2147483601] w-[min(320px,calc(100vw-24px))] rounded-2xl p-3"
      style={{ left: Math.max(12, left), top: Math.max(12, top) }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save()
      }}
    >
      <p className="text-tiny text-subtle mb-2 truncate font-mono">
        {draft.target.annId ?? `<${draft.target.tag}> ${draft.target.text}`}
      </p>
      <textarea
        autoFocus
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="哪里需要优化？例如：标题字号太大、按钮和卡片间距不够"
        className="bg-surface/10 text-caption text-surface placeholder:text-subtle focus:ring-primary h-24 w-full resize-none rounded-xl p-2.5 focus:ring-2 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onOpenSketch(comment)}
        className="hover:bg-surface/10 border-surface/25 mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed p-2 text-left"
      >
        {sketch ? (
          <>
            <SketchThumb sketch={sketch} height={56} />
            <span className="text-tiny min-w-0 flex-1">
              <span className="block truncate font-semibold">{sketch.title}</span>
              <span className="text-subtle">{sketch.items.length} 个元素 · 点击继续画</span>
            </span>
          </>
        ) : (
          <>
            <Icon name="palette" size={18} className="text-primary" />
            <span className="text-tiny flex-1">
              <span className="block font-semibold">画个草图</span>
              <span className="text-subtle">手绘 + 引用现有组件，说明想要的样子</span>
            </span>
          </>
        )}
      </button>
      <ChipRow
        label="类型"
        options={annotationCategories}
        value={category}
        onChange={(v) => setCategory(v)}
      />
      <ChipRow
        label="优先级"
        options={annotationPriorities}
        value={priority}
        onChange={(v) => setPriority(v)}
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-tiny text-subtle mr-auto">Ctrl + Enter 保存</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-caption text-surface/80 hover:bg-surface/10 h-9 rounded-full px-3 font-semibold"
        >
          取消
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="bg-primary text-caption text-on-primary h-9 rounded-full px-4 font-semibold disabled:opacity-40"
        >
          保存
        </button>
      </div>
    </div>
  )
}

function ChipRow<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: V; label: string }[]
  value: V
  onChange: (v: V) => void
}) {
  return (
    <div className="mt-2.5" role="radiogroup" aria-label={label}>
      <p className="text-tiny text-subtle mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              'text-tiny h-7 rounded-full px-2.5 font-semibold transition-colors',
              o.value === value
                ? 'bg-primary text-on-primary'
                : 'bg-surface/10 text-surface/80 hover:bg-surface/20',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
