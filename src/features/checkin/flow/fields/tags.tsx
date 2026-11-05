'use client'

import { useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import type { ModuleTone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'

/*
 * 「内容 + 常用标签」：饮食的吃了什么、运动的运动类型、学习的主题共用（custom-flow 的 text 组件也是它）。
 * 常用标签存在本机（localStorage），长按（手机）或右键（电脑）分区标题打开设置浮层。
 */

const PREFIX = 'daydayon:favs:'
const listeners = new Set<() => void>()

function read(key: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string').slice(0, 20)
      : null
  } catch {
    return null
  }
}

const cache = new Map<string, { raw: string | null; value: string[] }>()

/** 常用标签：key 区分板块（diet / exercise / study / custom-<goalId>） */
export function useFavorites(key: string, defaults: readonly string[]) {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => {
      const raw = window.localStorage.getItem(PREFIX + key)
      const hit = cache.get(key)
      if (hit && hit.raw === raw) return hit.value
      const next = read(key) ?? [...defaults]
      cache.set(key, { raw, value: next })
      return next
    },
    () => defaults as string[],
  )
  function set(next: string[]) {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(next.slice(0, 20)))
    } catch {
      // 隐私模式写不进去就只在本次会话生效
    }
    listeners.forEach((l) => l())
  }
  return { favs: value, setFavs: set, resetFavs: () => set([...defaults]) }
}

/** 一行横滑的常用标签：点一下加入 / 移出 */
export function TagRow({
  tags,
  selected,
  onToggle,
  tone,
  label,
}: {
  tags: readonly string[]
  selected: readonly string[]
  onToggle: (tag: string) => void
  tone: ModuleTone
  label: string
}) {
  if (tags.length === 0) return null
  return (
    <div
      className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label={label}
    >
      {tags.map((name) => {
        const on = selected.includes(name)
        return (
          <button
            key={name}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(name)}
            className={cn(
              'text-tiny min-h-7 shrink-0 rounded-full border px-2.5 font-semibold whitespace-nowrap transition-colors',
              on
                ? TONE_ON[tone]
                : 'border-border bg-surface-sunken text-muted hover:text-foreground',
            )}
          >
            {name}
          </button>
        )
      })}
    </div>
  )
}

const TONE_ON: Record<ModuleTone, string> = {
  diet: 'border-diet bg-diet-soft text-diet-ink',
  exercise: 'border-exercise bg-exercise-soft text-exercise-ink',
  sleep: 'border-sleep bg-sleep-soft text-sleep-ink',
  study: 'border-study bg-study-soft text-study-ink',
  custom: 'border-custom bg-custom-soft text-custom-ink',
}

const SOFT: Record<ModuleTone, string> = {
  diet: 'bg-diet-soft text-diet-ink',
  exercise: 'bg-exercise-soft text-exercise-ink',
  sleep: 'bg-sleep-soft text-sleep-ink',
  study: 'bg-study-soft text-study-ink',
  custom: 'bg-custom-soft text-custom-ink',
}

/** 设置常用标签的浮层（盖在打卡页上） */
export function FavoritesSheet({
  title,
  hint,
  placeholder,
  favs,
  tone,
  onChange,
  onReset,
  onClose,
}: {
  title: string
  hint: string
  placeholder: string
  favs: readonly string[]
  tone: ModuleTone
  onChange: (next: string[]) => void
  onReset: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState('')
  const name = draft.trim()
  return (
    <div
      className="bg-foreground/30 absolute inset-0 z-30 flex items-end"
      role="dialog"
      aria-label={title}
    >
      <div className="bg-surface animate-fade-up flex w-full flex-col gap-3 rounded-t-xl px-4 pt-4 pb-[calc(var(--safe-bottom)+1.25rem)]">
        <div className="flex flex-col gap-0.5">
          <span className="text-subhead font-bold">{title}</span>
          <span className="text-tiny text-muted">{hint}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {favs.map((f) => (
            <span
              key={f}
              className={cn(
                'text-tiny inline-flex min-h-7 items-center gap-1 rounded-full pr-1.5 pl-2.5 font-semibold',
                SOFT[tone],
              )}
            >
              {f}
              <button
                type="button"
                aria-label={`移除${f}`}
                onClick={() => onChange(favs.filter((x) => x !== f))}
                className="hover:bg-foreground/10 grid size-4 place-items-center rounded-full"
              >
                <Icon name="x" size={10} />
              </button>
            </span>
          ))}
          {favs.length === 0 && <span className="text-tiny text-subtle">还没有，添加一个吧</span>}
        </div>
        <div className="flex gap-2">
          <Input
            aria-label={title}
            value={draft}
            maxLength={20}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button
            variant="soft"
            icon="plus"
            disabled={!name || favs.includes(name)}
            onClick={() => {
              onChange([...favs, name])
              setDraft('')
            }}
          >
            添加
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onReset}>
            恢复系统推荐
          </Button>
          <Button className="flex-1" onClick={onClose}>
            完成
          </Button>
        </div>
      </div>
    </div>
  )
}

/** 顿号、逗号、加号、换行都能分隔 */
export function splitNames(text: string): string[] {
  return text
    .split(/[、,，;；+＋\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}
