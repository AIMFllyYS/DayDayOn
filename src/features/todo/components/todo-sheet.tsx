'use client'

import { useState } from 'react'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import { Field, Input } from '@/components/ui/field'
import { Form, type FormErrors } from '@/components/ui/form'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Sheet } from '@/components/ui/sheet'
import { combineLocalDateTime, toLocalDateTimeValue } from '@/lib/time'
import {
  CreateTodoSchema,
  TODO_TITLE_MAX,
  UpdateTodoSchema,
  type CreateTodo,
  type Todo,
  type TodoPriority,
  type UpdateTodo,
} from '../schemas'

/*
 * 新建 / 编辑待办的抽屉（PRD 2.10）。字段：标题、DDL（datetime-local，按用户时区转成时刻）、优先级。
 * 校验用与接口相同的 zod schema；服务端 400 的 fields 由调用方通过 serverErrors 传回来。
 * 编辑时只提交改动过的字段；什么都没改直接关闭。
 * 调用方在打开时用 key 重新挂载（key = todo?.id ?? 'new'），表单状态从 todo 初始化。
 */

const priorities = [
  { value: 'normal', label: '普通' },
  { value: 'important', label: '重要' },
] as const

export type TodoSheetSubmit =
  { kind: 'create'; input: CreateTodo } | { kind: 'update'; patch: UpdateTodo }

interface TodoSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 编辑的待办；null 为新建 */
  todo: Todo | null
  timeZone: string
  submitting: boolean
  serverErrors?: FormErrors
  onSubmit: (value: TodoSheetSubmit) => void
}

const FORM_ID = 'todo-sheet-form'

export function TodoSheet({
  open,
  onOpenChange,
  todo,
  timeZone,
  submitting,
  serverErrors,
  onSubmit,
}: TodoSheetProps) {
  const [title, setTitle] = useState(todo?.title ?? '')
  const [due, setDue] = useState(todo?.dueAt ? toLocalDateTimeValue(todo.dueAt, timeZone) : '')
  const [priority, setPriority] = useState<TodoPriority>(todo?.priority ?? 'normal')
  const [errors, setErrors] = useState<FormErrors>()
  const shown = { ...serverErrors, ...errors }

  function dueInstant(): string | null {
    return due === '' ? null : combineLocalDateTime(due, timeZone).toISOString()
  }

  function submit() {
    if (todo === null) {
      const r = CreateTodoSchema.safeParse({ title, dueAt: dueInstant(), priority })
      if (!r.success) return setErrors(z.flattenError(r.error).fieldErrors)
      setErrors(undefined)
      return onSubmit({ kind: 'create', input: r.data })
    }
    const draft: UpdateTodo = {}
    const nextDue = dueInstant()
    if (title.trim() !== todo.title) draft.title = title
    if (nextDue !== (todo.dueAt === null ? null : new Date(todo.dueAt).toISOString()))
      draft.dueAt = nextDue
    if (priority !== todo.priority) draft.priority = priority
    if (Object.keys(draft).length === 0) return onOpenChange(false)
    const r = UpdateTodoSchema.safeParse(draft)
    if (!r.success) return setErrors(z.flattenError(r.error).fieldErrors)
    setErrors(undefined)
    onSubmit({ kind: 'update', patch: r.data })
  }

  const dueError = shown.dueAt
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={todo ? '编辑待办' : '新建待办'}
      footer={
        <Button type="submit" form={FORM_ID} className="w-full" loading={submitting}>
          {todo ? '保存' : '记下来'}
        </Button>
      }
    >
      <Form id={FORM_ID} errors={shown} onFormSubmit={submit} aria-label="待办">
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
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <DateField
          label="DDL"
          id="todo-due"
          withTime
          value={due}
          onValueChange={setDue}
          aside="可选"
          hint="到点前 24 小时会标出“快到期”"
          error={typeof dueError === 'string' ? dueError : dueError?.[0]}
        />
        {due !== '' && (
          <Button variant="ghost" size="sm" className="-mt-2 self-start" onClick={() => setDue('')}>
            不设 DDL
          </Button>
        )}
        <div className="flex flex-col gap-1.5">
          <span aria-hidden className="text-caption font-semibold">
            优先级
          </span>
          <SegmentedControl
            options={priorities}
            value={priority}
            onValueChange={setPriority}
            label="优先级"
            className="w-48"
          />
        </div>
      </Form>
    </Sheet>
  )
}
