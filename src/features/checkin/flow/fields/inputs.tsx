'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'

/*
 * 分区里的原子输入（checkin-modules.md 第 2 节 flow/fields/）：
 * InlineRow = 标签在左的单行（运动时长、距离、组数，学习专注时长）；
 * PointsEditor = 逐条要点（学习要点，自定义的 points 组件）。
 */

export function InlineRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-tiny text-muted w-14 shrink-0 font-semibold">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** 一次写一条，回车或点「添加」；每条可以单独移除 */
export function PointsEditor({
  points,
  onChange,
  max = 10,
  placeholder = '写一条收获，回车添加',
}: {
  points: readonly string[]
  onChange: (next: string[]) => void
  max?: number
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  function add() {
    const t = draft.trim().slice(0, 80)
    if (!t || points.length >= max) return
    onChange([...points, t])
    setDraft('')
  }
  return (
    <>
      <div className="flex gap-2">
        <Input
          aria-label="要点"
          value={draft}
          maxLength={80}
          placeholder={points.length >= max ? `最多 ${max} 条` : placeholder}
          disabled={points.length >= max}
          onChange={(ev) => setDraft(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault()
              add()
            }
          }}
        />
        <Button variant="soft" size="sm" icon="plus" disabled={!draft.trim()} onClick={add}>
          添加
        </Button>
      </div>
      {points.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {points.map((p, i) => (
            <li
              key={`${i}-${p}`}
              className="bg-surface-sunken animate-fade-up flex items-start gap-2 rounded-lg px-2.5 py-2"
            >
              <span className="bg-study-soft text-study-ink text-tiny mt-px grid size-5 shrink-0 place-items-center rounded-md leading-none font-bold">
                {i + 1}
              </span>
              <span className="text-tiny min-w-0 flex-1 leading-snug break-words">{p}</span>
              <button
                type="button"
                aria-label={`移除要点 ${i + 1}`}
                onClick={() => onChange(points.filter((_, j) => j !== i))}
                className="text-subtle hover:text-foreground grid size-5 shrink-0 place-items-center rounded-full"
              >
                <Icon name="x" size={12} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
