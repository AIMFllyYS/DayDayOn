'use client'

import { useState, type ReactNode } from 'react'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Form } from '@/components/ui/form'
import { TimeField } from '@/components/ui/time-field'
import type { Module } from '@/features/shared/schemas'
import { goalFormErrors, type GoalFormErrors } from '../form-errors'
import {
  CreateGoalSchema,
  GOAL_DESCRIPTION_MAX,
  GOAL_TITLE_MAX,
  type CreateGoal,
  type FieldDef,
} from '../schemas'
import { FieldEditor } from './field-editor'
import { TargetEditor, type TargetDraft } from './target-editor'
import { WeekdayPicker } from './weekday-picker'

/** 表单的初始值：新建时来自 DEFAULT_GOALS，编辑时来自当前目标 */
export interface GoalFormInitial {
  title: string
  description: string | null
  target: TargetDraft
  weekdays: readonly number[]
  plannedTime: string | null
  fields?: readonly FieldDef[] | null
}

interface GoalFormProps {
  module: Module
  initial: GoalFormInitial
  /** 校验通过后的值（CreateGoalSchema 解析结果）；编辑时由调用方去掉 module 组成 PATCH */
  onSubmit: (values: CreateGoal) => void
  /** 服务端返回的错误（400 VALIDATION_FAILED 的 fields 整理后） */
  serverErrors?: GoalFormErrors
  /** 编辑时自定义字段有打卡记录：提示"改字段会生成新版本" */
  fieldsHint?: string
  id: string
  /** 表单底部（新建页的提交按钮）；放在 Sheet 的 footer 时用 form={id} 关联 */
  children?: ReactNode
}

/**
 * 目标表单（PRD 2.3）：标题、说明、每日目标量、计划星期、计划时间；自定义目标多一个字段编辑器。
 * 受控状态 + 提交时用与接口相同的 CreateGoalSchema 校验（client-data-and-forms.md 第 6 节）。
 */
export function GoalForm({
  module,
  initial,
  onSubmit,
  serverErrors,
  fieldsHint,
  id,
  children,
}: GoalFormProps) {
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description ?? '')
  const [target, setTarget] = useState<TargetDraft>(initial.target)
  const [weekdays, setWeekdays] = useState<number[]>([...initial.weekdays])
  const [plannedTime, setPlannedTime] = useState(initial.plannedTime ?? '')
  const [fields, setFields] = useState<FieldDef[]>([...(initial.fields ?? [])])
  const [clientErrors, setClientErrors] = useState<GoalFormErrors>()
  // 服务端错误换了一份（新的提交失败）时重新显示；用户改动后清掉
  const [shownServer, setShownServer] = useState(serverErrors)
  const [prevServer, setPrevServer] = useState(serverErrors)
  if (serverErrors !== prevServer) {
    setPrevServer(serverErrors)
    setShownServer(serverErrors)
  }

  const errors = clientErrors ?? shownServer
  const err = (key: string) => errors?.top[key]?.[0]

  function touched() {
    setClientErrors(undefined)
    setShownServer(undefined)
  }

  function submit() {
    const r = CreateGoalSchema.safeParse({
      module,
      title,
      description: description.trim() === '' ? null : description,
      target: { kind: target.kind, value: target.value ?? 0 },
      weekdays,
      plannedTime: plannedTime === '' ? null : plannedTime,
      fields: module === 'custom' ? fields : undefined,
    })
    if (!r.success) {
      setClientErrors(goalFormErrors(r.error))
      return
    }
    setClientErrors(undefined)
    onSubmit(r.data)
  }

  return (
    <Form id={id} onFormSubmit={submit} aria-label="目标设置" className="gap-5">
      <Field
        label="标题"
        htmlFor={`${id}-title`}
        error={err('title')}
        aside={`${title.trim().length} / ${GOAL_TITLE_MAX}`}
      >
        <Input
          id={`${id}-title`}
          value={title}
          maxLength={GOAL_TITLE_MAX}
          aria-invalid={err('title') ? true : undefined}
          onChange={(e) => {
            touched()
            setTitle(e.target.value)
          }}
        />
      </Field>

      <Field
        label="说明"
        htmlFor={`${id}-desc`}
        error={err('description')}
        aside="可选"
        hint="写给自己的一句话，比如为什么想坚持"
      >
        <Textarea
          id={`${id}-desc`}
          value={description}
          maxLength={GOAL_DESCRIPTION_MAX}
          rows={2}
          aria-invalid={err('description') ? true : undefined}
          onChange={(e: { target: { value: string } }) => {
            touched()
            setDescription(e.target.value)
          }}
        />
      </Field>

      <Field
        label="每天的目标"
        htmlFor={`${id}-target`}
        error={err('target')}
        hint={module === 'sleep' ? '睡够多久算完成' : '达到这个量就算完成今天'}
      >
        <TargetEditor
          id={`${id}-target`}
          module={module}
          value={target}
          onValueChange={(t) => {
            touched()
            setTarget(t)
          }}
        />
      </Field>

      <Field
        label="哪几天要做"
        htmlFor={`${id}-weekdays`}
        error={err('weekdays')}
        hint="其他日子也能打卡，只是不算进当天的计划"
      >
        <WeekdayPicker
          id={`${id}-weekdays`}
          value={weekdays}
          invalid={err('weekdays') !== undefined}
          onValueChange={(w) => {
            touched()
            setWeekdays(w)
          }}
        />
      </Field>

      <TimeField
        id={`${id}-time`}
        label="计划时间"
        aside="可选"
        hint="只用来提醒自己，不影响打卡"
        value={plannedTime}
        error={err('plannedTime')}
        onValueChange={(t) => {
          touched()
          setPlannedTime(t)
        }}
      />

      {module === 'custom' && (
        <section className="flex flex-col gap-2">
          <div>
            <h3 className="text-subhead font-bold">打卡时填什么</h3>
            <p className="text-caption text-muted">
              {fieldsHint ?? '最多 10 个字段；每次打卡按这些字段记一条'}
            </p>
          </div>
          <FieldEditor
            idPrefix={`${id}-f`}
            value={fields}
            errors={{ form: errors?.fieldsForm, byIndex: errors?.fieldsByIndex }}
            onValueChange={(f) => {
              touched()
              setFields(f)
            }}
          />
        </section>
      )}

      {children}
    </Form>
  )
}
