'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import * as z from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapse } from '@/components/ui/collapse'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { DateField } from '@/components/ui/date-field'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Form, type FormErrors } from '@/components/ui/form'
import { Icon } from '@/components/ui/icon'
import { Sheet } from '@/components/ui/sheet'
import { useInfiniteQuery } from '@/lib/api'
import { todoEventsQuery } from '@/lib/api/queries/todos'
import { cn } from '@/lib/cn'
import { combineLocalDateTime, formatDateTime, toLocalDateTimeValue } from '@/lib/time'
import { isOverdueTodo, TODO_EVENT_META } from '../rules'
import {
  CreateTodoSchema,
  TODO_ABANDON_REASON_MAX,
  TODO_DEFAULT_GROUP_NAME,
  TODO_GROUP_NAME_MAX,
  TODO_NOTE_MAX,
  TODO_TAG_MAX_LENGTH,
  TODO_TAGS_MAX_COUNT,
  TODO_TITLE_MAX,
  UpdateTodoSchema,
  type CreateTodo,
  type Todo,
  type TodoGroup,
  type TodoPriority,
  type TodoTag,
  type UpdateTodo,
} from '../schemas'
import { TodoPriorityPicker } from './todo-priority-picker'

/*
 * 新建待办 & 单条待办管理抽屉（统一复用 Base UI Sheet + Form + Combobox + ConfirmDialog）：
 * - 新建模式：标题、所属分组（可下拉选已有或直接输入新建，不选默认「默认待办」）、四象限优先级（默认不重要不紧急）、
 *   自定义标签（多选/可新建，最多 5 个）、DDL、备注（上限 2000 字）。
 * - 管理模式（点击待办主体进入）：编辑上述全部字段 + 状态流转（标记完成 / 放弃待办[可选原因] / 恢复待办 / 删除[二次确认]）
 *   + 可折叠的该条待办迷你历程时间轴（按需加载）。
 */

export type TodoSheetSubmit =
  { kind: 'create'; input: CreateTodo } | { kind: 'update'; patch: UpdateTodo }

interface TodoSheetProps {
  session?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  todo: Todo | null
  groups: readonly TodoGroup[]
  defaultGroupId: string
  availableTags: readonly TodoTag[]
  timeZone: string
  now: Date
  submitting: boolean
  serverErrors?: FormErrors
  onSubmit: (value: TodoSheetSubmit) => void
  /** 在管理抽屉里直接触发状态流转（完成 / 放弃 / 恢复） */
  onQuickStatus?: (todo: Todo, patch: UpdateTodo) => void
  /** 在管理抽屉里请求删除（由外层弹出 ConfirmDialog 二次确认） */
  onRequestDelete?: (todo: Todo) => void
}

const FORM_ID = 'todo-sheet-form'
const NEW_GROUP_PREFIX = '__new_group__:'

const ConfirmDialog = dynamic(
  () => import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog),
  { loading: () => null },
)

export function TodoSheet({
  session = 0,
  open,
  onOpenChange,
  todo,
  groups,
  defaultGroupId,
  availableTags,
  timeZone,
  now,
  submitting,
  serverErrors,
  onSubmit,
  onQuickStatus,
  onRequestDelete,
}: TodoSheetProps) {
  const [dirty, setDirty] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmLoaded, setConfirmLoaded] = useState(false)
  if (confirmOpen && !confirmLoaded) setConfirmLoaded(true)

  function close() {
    setDirty(false)
    onOpenChange(false)
  }

  function requestOpenChange(next: boolean) {
    if (!next && dirty && !submitting) return setConfirmOpen(true)
    if (next) onOpenChange(true)
    else close()
  }

  const overdue = todo ? isOverdueTodo(todo, now) : false
  const statusLabel = todo
    ? todo.isArchived
      ? todo.status === 'abandoned'
        ? '已归档 · 已放弃'
        : '已归档 · 已完成'
      : todo.status === 'done'
        ? '已完成'
        : todo.status === 'abandoned'
          ? '已放弃'
          : overdue
            ? '已过期'
            : '进行中'
    : null

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={requestOpenChange}
        title={todo ? '管理待办' : '新建待办'}
        description={statusLabel ? `当前状态：${statusLabel}` : undefined}
        footer={
          <Button type="submit" form={FORM_ID} className="w-full" loading={submitting}>
            {todo ? '保存修改' : '记下来'}
          </Button>
        }
      >
        <TodoSheetForm
          key={`${session}-${todo?.id ?? 'new'}`}
          todo={todo}
          groups={groups}
          defaultGroupId={defaultGroupId}
          availableTags={availableTags}
          timeZone={timeZone}
          submitting={submitting}
          serverErrors={serverErrors}
          onDirtyChange={setDirty}
          onNoopClose={close}
          onSubmit={onSubmit}
          onQuickStatus={onQuickStatus}
          onRequestDelete={onRequestDelete}
        />
      </Sheet>
      {confirmLoaded && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="还没保存，确定关闭？"
          description="填了的内容会丢掉"
          confirmLabel="不保存，关闭"
          cancelLabel="继续编辑"
          tone="danger"
          onConfirm={close}
        />
      )}
    </>
  )
}

function TodoSheetForm({
  todo,
  groups,
  defaultGroupId,
  availableTags,
  timeZone,
  submitting,
  serverErrors,
  onDirtyChange,
  onNoopClose,
  onSubmit,
  onQuickStatus,
  onRequestDelete,
}: {
  todo: Todo | null
  groups: readonly TodoGroup[]
  defaultGroupId: string
  availableTags: readonly TodoTag[]
  timeZone: string
  submitting: boolean
  serverErrors?: FormErrors
  onDirtyChange: (dirty: boolean) => void
  onNoopClose: () => void
  onSubmit: (value: TodoSheetSubmit) => void
  onQuickStatus?: (todo: Todo, patch: UpdateTodo) => void
  onRequestDelete?: (todo: Todo) => void
}) {
  const [title, setTitle] = useState(todo?.title ?? '')
  const [note, setNote] = useState(todo?.note ?? '')
  const [due, setDue] = useState(todo?.dueAt ? toLocalDateTimeValue(todo.dueAt, timeZone) : '')
  const [priority, setPriority] = useState<TodoPriority>(
    todo?.priority ?? 'not-important-not-urgent',
  )
  const [groupValue, setGroupValue] = useState<string | null>(todo?.groupId ?? defaultGroupId)
  const [createdGroups, setCreatedGroups] = useState<ComboboxOption[]>([])
  const [tags, setTags] = useState<string[]>(todo?.tags ?? [])
  const [localTags, setLocalTags] = useState<string[]>([])
  const [abandonPanelOpen, setAbandonPanelOpen] = useState(false)
  const [abandonReason, setAbandonReason] = useState(todo?.abandonReason ?? '')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [errors, setErrors] = useState<FormErrors>()

  const shown = useMemo<FormErrors>(() => ({ ...serverErrors, ...errors }), [serverErrors, errors])

  const groupOptions = useMemo<ComboboxOption[]>(() => {
    const base = groups.map((g) => ({ value: g.id, label: g.name }))
    if (base.length === 0) {
      base.push({ value: defaultGroupId, label: TODO_DEFAULT_GROUP_NAME })
    }
    return [...base, ...createdGroups]
  }, [groups, defaultGroupId, createdGroups])

  const tagOptions = useMemo<ComboboxOption[]>(() => {
    const names = new Set<string>()
    for (const t of availableTags) names.add(t.name)
    for (const t of tags) names.add(t)
    for (const t of localTags) names.add(t)
    return [...names].map((name) => ({ value: name, label: name }))
  }, [availableTags, tags, localTags])

  const [initial] = useState(() => JSON.stringify([title, note, due, priority, groupValue, tags]))
  const dirty = JSON.stringify([title, note, due, priority, groupValue, tags]) !== initial

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  function dueInstant(): string | null {
    return due === '' ? null : combineLocalDateTime(due, timeZone).toISOString()
  }

  function handleCreateGroupOption(rawLabel: string): string {
    const trimmed = rawLabel.trim().slice(0, TODO_GROUP_NAME_MAX)
    const existing = groupOptions.find((o) => o.label === trimmed)
    if (existing) return existing.value
    const nextVal = `${NEW_GROUP_PREFIX}${trimmed}`
    setCreatedGroups((prev) =>
      prev.some((o) => o.value === nextVal) ? prev : [...prev, { value: nextVal, label: trimmed }],
    )
    return nextVal
  }

  function handleCreateTagOption(rawLabel: string): string {
    const trimmed = rawLabel.trim().slice(0, TODO_TAG_MAX_LENGTH)
    if (!trimmed) return ''
    setLocalTags((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
    return trimmed
  }

  function submit() {
    const selectedGroup = groupValue ?? defaultGroupId
    const isNewGroup = selectedGroup.startsWith(NEW_GROUP_PREFIX)
    const newGroupName = isNewGroup ? selectedGroup.slice(NEW_GROUP_PREFIX.length) : undefined
    const groupId = isNewGroup ? undefined : selectedGroup

    if (todo === null) {
      const parsed = CreateTodoSchema.safeParse({
        title,
        note: note.trim() === '' ? null : note,
        dueAt: dueInstant(),
        priority,
        tags,
        ...(newGroupName ? { newGroupName } : groupId ? { groupId } : {}),
      })
      if (!parsed.success) return setErrors(z.flattenError(parsed.error).fieldErrors)
      setErrors(undefined)
      return onSubmit({ kind: 'create', input: parsed.data })
    }

    const draft: UpdateTodo = {}
    const nextDue = dueInstant()
    const nextNote = note.trim() === '' ? null : note.trim()
    if (title.trim() !== todo.title) draft.title = title
    if (nextNote !== (todo.note ?? null)) draft.note = nextNote
    if (nextDue !== (todo.dueAt === null ? null : new Date(todo.dueAt).toISOString())) {
      draft.dueAt = nextDue
    }
    if (priority !== todo.priority) draft.priority = priority
    if (JSON.stringify(tags) !== JSON.stringify(todo.tags)) draft.tags = tags
    if (newGroupName) {
      draft.newGroupName = newGroupName
    } else if (groupId && groupId !== todo.groupId) {
      draft.groupId = groupId
    }

    if (Object.keys(draft).length === 0) return onNoopClose()
    const parsed = UpdateTodoSchema.safeParse(draft)
    if (!parsed.success) return setErrors(z.flattenError(parsed.error).fieldErrors)
    setErrors(undefined)
    onSubmit({ kind: 'update', patch: parsed.data })
  }

  const dueError = shown.dueAt
  const tagError = shown.tags

  return (
    <div className="flex flex-col gap-3.5">
      <Form id={FORM_ID} errors={shown} onFormSubmit={submit} aria-label="待办表单">
        <Field
          label="要做什么"
          htmlFor="todo-title"
          name="title"
          aside={`${title.trim().length} / ${TODO_TITLE_MAX}`}
        >
          <Input
            id="todo-title"
            value={title}
            maxLength={TODO_TITLE_MAX}
            placeholder="比如：交实验报告"
            autoComplete="off"
            onChange={(e) => {
              setTitle(e.target.value)
              setErrors((prev) => (prev?.title ? { ...prev, title: undefined } : prev))
            }}
          />
        </Field>

        <Field
          label="所属分组"
          htmlFor="todo-group"
          name="groupId"
          hint={`可选已有分组或直接输入新建；不选默认在「${TODO_DEFAULT_GROUP_NAME}」`}
        >
          <Combobox
            id="todo-group"
            label="所属分组"
            options={groupOptions}
            value={groupValue}
            onValueChange={(next) => setGroupValue(next ?? defaultGroupId)}
            placeholder={`搜索或输入新分组（默认：${TODO_DEFAULT_GROUP_NAME}）`}
            creatable
            onCreate={handleCreateGroupOption}
          />
        </Field>

        <TodoPriorityPicker value={priority} onValueChange={setPriority} disabled={submitting} />

        <Field
          label="自定义标签"
          htmlFor="todo-tags"
          name="tags"
          aside={`${tags.length} / ${TODO_TAGS_MAX_COUNT}`}
          hint="支持多选或直接输入新建标签，最多 5 个"
          error={typeof tagError === 'string' ? tagError : tagError?.[0]}
        >
          <Combobox
            id="todo-tags"
            label="自定义标签"
            multiple
            options={tagOptions}
            value={tags}
            onValueChange={(next) => {
              const cleaned = next.filter(Boolean).slice(0, TODO_TAGS_MAX_COUNT)
              setTags(cleaned)
              setErrors((prev) => (prev?.tags ? { ...prev, tags: undefined } : prev))
            }}
            placeholder="选择或输入新标签，如：高数、采购"
            creatable
            onCreate={handleCreateTagOption}
          />
        </Field>

        <DateField
          label="DDL"
          id="todo-due"
          withTime
          value={due}
          onValueChange={(next) => {
            setDue(next)
            setErrors((prev) => (prev?.dueAt ? { ...prev, dueAt: undefined } : prev))
          }}
          aside="可选"
          hint="到点前 24 小时标出「快到期」，超时自动归入「已过期」分组"
          error={typeof dueError === 'string' ? dueError : dueError?.[0]}
        />
        {due !== '' && (
          <Button
            variant="ghost"
            size="sm"
            className="-mt-2 self-start"
            onClick={() => {
              setDue('')
              setErrors((prev) => (prev?.dueAt ? { ...prev, dueAt: undefined } : prev))
            }}
          >
            不设 DDL
          </Button>
        )}

        <Field
          label="待办备注"
          htmlFor="todo-note"
          name="note"
          aside={`${note.length} / ${TODO_NOTE_MAX}`}
          hint="可写详细步骤、链接或要点，最多 2000 字"
        >
          <Textarea
            id="todo-note"
            value={note}
            maxLength={TODO_NOTE_MAX}
            rows={4}
            placeholder="写下补充说明、步骤或重要信息…"
            onChange={(e) => {
              setNote(e.target.value)
              setErrors((prev) => (prev?.note ? { ...prev, note: undefined } : prev))
            }}
          />
        </Field>
      </Form>

      {/* 管理模式专属：状态操作区（完成 / 放弃待办 / 恢复 / 删除二次确认）与迷你历程 */}
      {todo !== null && (
        <div className="border-border flex flex-col gap-2.5 border-t border-dashed pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {todo.status === 'open' ? (
              <>
                <Button
                  size="sm"
                  variant="soft"
                  icon="check"
                  disabled={submitting}
                  onClick={() => onQuickStatus?.(todo, { status: 'done' })}
                >
                  标记完成
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="ban"
                  disabled={submitting}
                  onClick={() => setAbandonPanelOpen((o) => !o)}
                >
                  放弃待办
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="soft"
                icon="undo"
                disabled={submitting}
                onClick={() => onQuickStatus?.(todo, { status: 'open' })}
              >
                恢复为进行中
              </Button>
            )}

            <Button
              size="sm"
              variant="danger"
              icon="trash"
              className="ml-auto"
              disabled={submitting}
              onClick={() => onRequestDelete?.(todo)}
            >
              删除
            </Button>
          </div>

          <Collapse open={abandonPanelOpen && todo.status === 'open'}>
            <div className="border-warning/35 bg-warning-soft/35 flex flex-col gap-2 rounded-xl border p-2.5">
              <p className="text-tiny text-warning-ink font-semibold">
                放弃后将移入「已放弃」分组（默认自动折叠），30 天后自动归档
              </p>
              <Input
                aria-label="放弃原因（可选）"
                value={abandonReason}
                maxLength={TODO_ABANDON_REASON_MAX}
                placeholder="可选：简单记下放弃原因，方便复盘"
                onChange={(e) => setAbandonReason(e.target.value)}
              />
              <div className="flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setAbandonPanelOpen(false)}>
                  取消
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={submitting}
                  onClick={() =>
                    onQuickStatus?.(todo, {
                      status: 'abandoned',
                      abandonReason: abandonReason.trim() || null,
                    })
                  }
                >
                  确认放弃
                </Button>
              </div>
            </div>
          </Collapse>

          {/* 单条待办迷你历程（默认折叠，点开按需查询） */}
          <div className="border-border bg-surface-sunken/55 rounded-xl border">
            <button
              type="button"
              aria-expanded={historyOpen}
              onClick={() => setHistoryOpen((o) => !o)}
              className="flex min-h-10 w-full items-center gap-2 px-3 py-1.5 text-left"
            >
              <Icon name="clock" size={14} className="text-muted shrink-0" />
              <span className="text-tiny text-muted flex-1 font-semibold">查看这条待办的历程</span>
              <Icon
                name="chevron-down"
                size={14}
                className={cn(
                  'text-subtle transition-transform duration-(--dur-base)',
                  historyOpen && 'rotate-180',
                )}
              />
            </button>
            <Collapse open={historyOpen} unmountOnCollapse>
              <TodoMiniTimeline todoId={todo.id} timeZone={timeZone} />
            </Collapse>
          </div>
        </div>
      )}
    </div>
  )
}

function TodoMiniTimeline({ todoId, timeZone }: { todoId: string; timeZone: string }) {
  const query = useInfiniteQuery(todoEventsQuery({ todoId }))
  const events = query.data?.pages.flatMap((p) => p.items) ?? []

  if (query.isPending) {
    return <p className="text-tiny text-subtle px-3 pb-3">正在读取历程…</p>
  }
  if (events.length === 0) {
    return <p className="text-tiny text-subtle px-3 pb-3">还没有记录到变动历程</p>
  }

  return (
    <ol className="border-border/60 flex flex-col gap-1.5 border-t border-dashed px-3 py-2.5">
      {events.map((ev) => {
        const meta = TODO_EVENT_META[ev.eventType]
        return (
          <li key={ev.id} className="flex items-center gap-2">
            <Badge tone={meta.tone} size="sm">
              {meta.label}
            </Badge>
            <span className="text-tiny text-foreground min-w-0 flex-1 truncate">
              {ev.eventType === 'moved' && ev.meta.fromGroup && ev.meta.toGroup
                ? `${ev.meta.fromGroup} → ${ev.meta.toGroup}`
                : ev.meta.reason
                  ? `${meta.verb}（${ev.meta.reason}）`
                  : `${meta.verb} · ${ev.groupName}`}
            </span>
            <time className="text-tiny text-subtle shrink-0 tabular-nums">
              {formatDateTime(ev.occurredAt, timeZone)}
            </time>
          </li>
        )
      })}
    </ol>
  )
}
