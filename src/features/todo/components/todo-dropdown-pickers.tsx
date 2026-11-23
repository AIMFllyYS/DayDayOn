'use client'

import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Icon } from '@/components/ui/icon'
import { Popover } from '@/components/ui/popover'
import { cn } from '@/lib/cn'
import {
  TODO_DEFAULT_GROUP_NAME,
  TODO_GROUP_NAME_MAX,
  TODO_TAG_MAX_LENGTH,
  TODO_TAGS_MAX_COUNT,
} from '../schemas'

/*
 * 新建 / 管理待办底栏的「设置分组」与「设置标签」同排下拉菜单：
 * - 复用 Base UI Popover，默认向上展开（side="top"）避免在底部抽屉内被裁切；
 * - 菜单末项固定为「新建分组」/「新建标签」，点击后同步 flushSync 切为原生 16px 输入框并立即 focus()，
 *   保证 iOS / Android 手机软键盘在同一次用户手势内顺畅弹出；回车或点「确认」自动保存并选中。
 */

export interface DropdownOption {
  value: string
  label: string
}

interface TodoGroupDropdownProps {
  options: readonly DropdownOption[]
  value: string | null
  onSelect: (value: string) => void
  /** 保存新建分组并返回选中值（可异步写后端或本地占位） */
  onCreateGroup: (name: string) => Promise<string | null> | string | null
  disabled?: boolean
}

export function TodoGroupDropdown({
  options,
  value,
  onSelect,
  onCreateGroup,
  disabled = false,
}: TodoGroupDropdownProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentLabel = options.find((o) => o.value === value)?.label ?? TODO_DEFAULT_GROUP_NAME

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setCreating(false)
      setDraft('')
    }
  }

  function startCreate() {
    // flushSync 保证 input.focus() 留在点击手势同步栈内，确保手机端软键盘可靠弹出
    flushSync(() => {
      setCreating(true)
      setDraft('')
    })
    inputRef.current?.focus()
    inputRef.current?.scrollIntoView({ block: 'nearest' })
  }

  async function commitCreate() {
    const trimmed = draft.trim().slice(0, TODO_GROUP_NAME_MAX)
    if (!trimmed || saving) return
    setSaving(true)
    try {
      const createdValue = await onCreateGroup(trimmed)
      if (createdValue) {
        onSelect(createdValue)
        handleOpenChange(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-tiny text-muted font-semibold">设置分组</span>
      <Popover
        open={open}
        onOpenChange={handleOpenChange}
        side="top"
        align="start"
        sideOffset={6}
        clean
        positionerClassName="z-[60]"
        className="w-56 max-w-[calc(100vw-2rem)] p-1.5"
        trigger={
          <button
            type="button"
            disabled={disabled}
            aria-label={`设置分组：${currentLabel}`}
            data-todo-picker="group"
            className={cn(
              'border-border bg-surface text-caption text-foreground hover:border-border-strong flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border px-3 text-left font-semibold transition-colors duration-(--dur-fast) disabled:opacity-50',
              open && 'border-primary ring-primary-soft ring-4',
            )}
          >
            <Icon name="folder" size={16} className="text-primary-ink shrink-0" lineOnly />
            <span className="min-w-0 flex-1 truncate">{currentLabel}</span>
            <Icon
              name="chevron-down"
              size={15}
              className={cn(
                'text-muted shrink-0 transition-transform duration-(--dur-base)',
                open && 'rotate-180',
              )}
              lineOnly
            />
          </button>
        }
      >
        <div className="flex flex-col" data-base-ui-swipe-ignore>
          <div className="max-h-44 overflow-y-auto overscroll-contain">
            {options.map((opt) => {
              const selected = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onSelect(opt.value)
                    handleOpenChange(false)
                  }}
                  className={cn(
                    'text-caption flex min-h-9.5 w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left transition-colors',
                    selected
                      ? 'bg-primary-soft text-primary-ink font-semibold'
                      : 'text-foreground hover:bg-surface-sunken font-medium',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                  {selected && <Icon name="check" size={15} className="shrink-0" lineOnly />}
                </button>
              )
            })}
          </div>

          <div className="bg-border mx-1.5 my-1 h-px" />

          {creating ? (
            <div className="flex items-center gap-1.5 px-1 py-0.5">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                maxLength={TODO_GROUP_NAME_MAX}
                enterKeyHint="done"
                autoComplete="off"
                placeholder="输入新分组名"
                aria-label="新建分组名称"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    void commitCreate()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setCreating(false)
                    setDraft('')
                  }
                }}
                className="border-primary bg-surface text-body text-foreground placeholder:text-subtle h-9 min-w-0 flex-1 rounded-lg border px-2.5 outline-none"
              />
              <button
                type="button"
                disabled={saving || draft.trim().length === 0}
                onClick={() => void commitCreate()}
                className="bg-primary text-on-primary text-tiny inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-2.5 font-semibold disabled:opacity-45"
              >
                {saving ? '保存中' : '确认'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-todo-create-trigger="group"
              onClick={startCreate}
              className="text-caption text-primary-ink hover:bg-primary-soft/60 flex min-h-9.5 w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left font-semibold transition-colors"
            >
              <Icon name="plus" size={15} lineOnly />
              <span>新建分组</span>
            </button>
          )}
        </div>
      </Popover>
    </div>
  )
}

interface TodoTagDropdownProps {
  options: readonly DropdownOption[]
  selectedTags: readonly string[]
  onToggleTag: (tag: string) => void
  onCreateAndSelectTag: (name: string) => void
  disabled?: boolean
}

export function TodoTagDropdown({
  options,
  selectedTags,
  onToggleTag,
  onCreateAndSelectTag,
  disabled = false,
}: TodoTagDropdownProps) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const atLimit = selectedTags.length >= TODO_TAGS_MAX_COUNT
  const triggerText =
    selectedTags.length === 0
      ? '添加标签'
      : selectedTags.length === 1
        ? `#${selectedTags[0]}`
        : `已选 ${selectedTags.length} 个`

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setCreating(false)
      setDraft('')
    }
  }

  function startCreate() {
    flushSync(() => {
      setCreating(true)
      setDraft('')
    })
    inputRef.current?.focus()
    inputRef.current?.scrollIntoView({ block: 'nearest' })
  }

  function commitCreate() {
    const trimmed = draft.trim().slice(0, TODO_TAG_MAX_LENGTH)
    if (!trimmed) return
    onCreateAndSelectTag(trimmed)
    setCreating(false)
    setDraft('')
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between gap-1">
        <span className="text-tiny text-muted font-semibold">设置标签</span>
        <span className="text-tiny text-subtle tabular-nums">
          {selectedTags.length}/{TODO_TAGS_MAX_COUNT}
        </span>
      </div>
      <Popover
        open={open}
        onOpenChange={handleOpenChange}
        side="top"
        align="end"
        sideOffset={6}
        clean
        positionerClassName="z-[60]"
        className="w-56 max-w-[calc(100vw-2rem)] p-1.5"
        trigger={
          <button
            type="button"
            disabled={disabled}
            aria-label={`设置标签：${triggerText}`}
            data-todo-picker="tag"
            className={cn(
              'border-border bg-surface text-caption hover:border-border-strong flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border px-3 text-left font-semibold transition-colors duration-(--dur-fast) disabled:opacity-50',
              selectedTags.length > 0 ? 'text-foreground' : 'text-muted',
              open && 'border-primary ring-primary-soft ring-4',
            )}
          >
            <Icon name="tag" size={16} className="text-primary-ink shrink-0" lineOnly />
            <span className="min-w-0 flex-1 truncate">{triggerText}</span>
            <Icon
              name="chevron-down"
              size={15}
              className={cn(
                'text-muted shrink-0 transition-transform duration-(--dur-base)',
                open && 'rotate-180',
              )}
              lineOnly
            />
          </button>
        }
      >
        <div className="flex flex-col" data-base-ui-swipe-ignore>
          <div className="max-h-44 overflow-y-auto overscroll-contain">
            {options.length === 0 ? (
              <p className="text-tiny text-subtle px-2.5 py-2 text-center">
                还没有标签，点下方新建
              </p>
            ) : (
              options.map((opt) => {
                const selected = selectedTags.includes(opt.value)
                const itemDisabled = !selected && atLimit
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={itemDisabled}
                    onClick={() => onToggleTag(opt.value)}
                    className={cn(
                      'text-caption flex min-h-9.5 w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left transition-colors disabled:opacity-45',
                      selected
                        ? 'bg-primary-soft text-primary-ink font-semibold'
                        : 'text-foreground hover:bg-surface-sunken font-medium',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">#{opt.label}</span>
                    {selected && <Icon name="check" size={15} className="shrink-0" lineOnly />}
                  </button>
                )
              })
            )}
          </div>

          <div className="bg-border mx-1.5 my-1 h-px" />

          {creating ? (
            <div className="flex items-center gap-1.5 px-1 py-0.5">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                maxLength={TODO_TAG_MAX_LENGTH}
                enterKeyHint="done"
                autoComplete="off"
                placeholder="输入新标签名"
                aria-label="新建标签名称"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    commitCreate()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setCreating(false)
                    setDraft('')
                  }
                }}
                className="border-primary bg-surface text-body text-foreground placeholder:text-subtle h-9 min-w-0 flex-1 rounded-lg border px-2.5 outline-none"
              />
              <button
                type="button"
                disabled={draft.trim().length === 0}
                onClick={commitCreate}
                className="bg-primary text-on-primary text-tiny inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-2.5 font-semibold disabled:opacity-45"
              >
                确认
              </button>
            </div>
          ) : (
            <button
              type="button"
              data-todo-create-trigger="tag"
              disabled={atLimit}
              onClick={startCreate}
              className="text-caption text-primary-ink hover:bg-primary-soft/60 flex min-h-9.5 w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left font-semibold transition-colors disabled:opacity-45"
            >
              <Icon name="plus" size={15} lineOnly />
              <span>{atLimit ? `最多选 ${TODO_TAGS_MAX_COUNT} 个标签` : '新建标签'}</span>
            </button>
          )}
        </div>
      </Popover>
    </div>
  )
}
