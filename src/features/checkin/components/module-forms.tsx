'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Form } from '@/components/ui/form'
import { NumberField } from '@/components/ui/number-field'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { TimeRangeField } from '@/components/ui/time-range-field'
import { toast } from '@/components/ui/toast'
import { buildSchema, sanitizeCustomValues } from '@/features/goal/build-schema'
import { SchemaForm } from '@/features/goal/components/schema-form'
import { clearChangedErrors } from '@/features/goal/form-errors'
import type { FieldValues } from '@/features/goal/schemas'
import { sleepRangeForDay } from '@/lib/time'
import * as z from 'zod'
import { intensityLabel } from '../format'
import { EXERCISE_CATEGORIES, NOTE_MAX, type Intensity } from '../schemas'
import { NOTE_PLACEHOLDER, type ModuleFormProps } from './form-types'
import { MagicFieldBlock } from './smart-magic-stream'

/*
 * 运动、睡眠、学习、自定义四个板块的打卡表单（PRD 2.4 表）。饮食在 diet-form.tsx。
 * 输入用界面单位（分钟），提交前换算成接口单位（秒）。
 * 支持流式魔法填充（magicStreaming + streamedContext）：流式阶段实时呈现逐字输入与数字滚动。
 */

// 组合框是弹层类组件，懒加载（ui-primitives.md 第 3 节）
const Combobox = dynamic(() => import('@/components/ui/combobox').then((m) => m.Combobox), {
  loading: () => <div className="border-border bg-surface h-12 rounded-xl border" />,
})

const intensityOptions = (['easy', 'moderate', 'hard'] as const).map((v) => ({
  value: v,
  label: intensityLabel[v],
}))

function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="备注" htmlFor="checkin-note" name="note" aside="可选" className="min-w-0 gap-1">
      <Textarea
        id="checkin-note"
        rows={2}
        value={value}
        maxLength={NOTE_MAX}
        placeholder={NOTE_PLACEHOLDER}
        onChange={(e) => onChange(e.target.value)}
        className="text-caption min-h-16 px-3 py-2"
      />
    </Field>
  )
}

const noteOf = (note: string) => (note.trim() === '' ? null : note.trim())

function SubmitButton({ submitting }: { submitting: boolean }) {
  return (
    <Button type="submit" size="sm" icon="check" className="h-10 w-full" loading={submitting}>
      确认记录
    </Button>
  )
}

export function ExerciseForm({
  isMakeup,
  submitting,
  errors,
  smartContext,
  streamedContext,
  magicStreaming,
  magicStage,
  onSubmit,
}: ModuleFormProps) {
  const aiEx = smartContext?.draft.exercise
  const streamEx = streamedContext?.draft.exercise
  const [options, setOptions] = useState<{ value: string; label: string }[]>(() => {
    const base = EXERCISE_CATEGORIES.map((c) => ({ value: c, label: c }))
    if (
      aiEx?.category &&
      !EXERCISE_CATEGORIES.includes(aiEx.category as (typeof EXERCISE_CATEGORIES)[number])
    ) {
      return [...base, { value: aiEx.category, label: aiEx.category }]
    }
    return base
  })
  const [category, setCategory] = useState<string | null>(
    aiEx?.category ?? (smartContext ? '跑步' : null),
  )
  const [minutes, setMinutes] = useState<number | null>(aiEx?.durationMinutes ?? 30)
  const [intensity, setIntensity] = useState<Intensity>(aiEx?.intensity ?? 'moderate')
  const [note, setNote] = useState(aiEx?.note ?? '')

  const shownCategory = magicStreaming && streamEx ? streamEx.category : category
  const shownMinutes = magicStreaming && streamEx ? streamEx.durationMinutes : minutes
  const shownNote = magicStreaming && streamEx ? (streamEx.note ?? '') : note

  const aiMeta =
    smartContext && !isMakeup
      ? {
          source: 'ai' as const,
          aiRunId: smartContext.aiRunId,
          parsedText: smartContext.draft.summary,
        }
      : {}
  return (
    <Form
      errors={errors}
      className="min-w-0 gap-2.5"
      onFormSubmit={() =>
        onSubmit({
          module: 'exercise',
          isMakeup,
          category: (category ?? '').trim() || (smartContext ? '跑步' : ''),
          intensity,
          durationSeconds: Math.round((minutes ?? 30) * 60),
          note: noteOf(note),
          ...aiMeta,
        })
      }
    >
      <MagicFieldBlock stage={1} activeStage={magicStage} streaming={magicStreaming}>
        <Field
          label="运动品类"
          htmlFor="checkin-category"
          name="category"
          hint="没有合适的可以直接输入新建"
          className="min-w-0 gap-1"
        >
          <Combobox
            id="checkin-category"
            options={options}
            value={shownCategory}
            onValueChange={setCategory}
            placeholder="跑步、瑜伽……"
            creatable
            onCreate={(label) => {
              const v = label.slice(0, 10)
              setOptions((o) => [...o, { value: v, label: v }])
              return v
            }}
          />
        </Field>
      </MagicFieldBlock>

      <MagicFieldBlock
        stage={2}
        activeStage={magicStage}
        streaming={magicStreaming}
        className="flex flex-col gap-2.5"
      >
        <Field
          label="时长"
          htmlFor="checkin-minutes"
          name="durationSeconds"
          hint="1–600 分钟"
          className="min-w-0 gap-1"
        >
          <NumberField
            id="checkin-minutes"
            size="sm"
            value={shownMinutes}
            onValueChange={setMinutes}
            min={1}
            max={600}
            step={5}
            unit="分钟"
          />
        </Field>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-caption font-semibold">强度</span>
          <SegmentedControl
            options={intensityOptions}
            value={intensity}
            onValueChange={setIntensity}
            label="强度"
            size="sm"
          />
          <p className="text-tiny text-muted">消耗按 MET × 体重 × 时长估算，估算结果，非医疗建议</p>
        </div>
      </MagicFieldBlock>

      <MagicFieldBlock stage={3} activeStage={magicStage} streaming={magicStreaming}>
        <NoteField value={shownNote} onChange={setNote} />
      </MagicFieldBlock>
      <SubmitButton submitting={submitting} />
    </Form>
  )
}

export function SleepForm({
  day,
  isMakeup,
  clock,
  submitting,
  errors,
  smartContext,
  streamedContext,
  magicStreaming,
  magicStage,
  onSubmit,
}: ModuleFormProps) {
  const aiSl = smartContext?.draft.sleep
  const streamSl = streamedContext?.draft.sleep
  const [bed, setBed] = useState(aiSl?.bedTime ?? '23:00')
  const [wake, setWake] = useState(aiSl?.wakeTime ?? '07:00')
  const [quality, setQuality] = useState<RatingValue | null>(
    (aiSl?.quality as RatingValue | undefined) ?? (smartContext ? 4 : null),
  )
  const [note, setNote] = useState(aiSl?.note ?? '')
  const [localError, setLocalError] = useState<string>()

  const shownBed = magicStreaming && streamSl ? streamSl.bedTime : bed
  const shownWake = magicStreaming && streamSl ? streamSl.wakeTime : wake
  const shownQuality =
    magicStreaming && streamSl
      ? ((streamSl.quality as RatingValue | undefined) ?? quality)
      : quality
  const shownNote = magicStreaming && streamSl ? (streamSl.note ?? '') : note

  const wakeError =
    localError ?? (typeof errors?.wakeAt === 'string' ? errors.wakeAt : errors?.wakeAt?.[0])
  const aiMeta =
    smartContext && !isMakeup
      ? {
          source: 'ai' as const,
          aiRunId: smartContext.aiRunId,
          parsedText: smartContext.draft.summary,
        }
      : {}
  return (
    <Form
      errors={errors}
      className="min-w-0 gap-2.5"
      onFormSubmit={() => {
        const range = sleepRangeForDay(day, bed, wake, clock.timeZone, clock.dayStartHour)
        if (!range) {
          const msg = '入睡和起床时间不能一样'
          setLocalError(msg)
          toast.error(msg)
          return
        }
        if (quality === null) {
          const msg = '给睡眠质量打个分吧'
          setLocalError(msg)
          toast.error(msg)
          return
        }
        setLocalError(undefined)
        onSubmit({
          module: 'sleep',
          isMakeup,
          bedAt: range.bedAt.toISOString(),
          wakeAt: range.wakeAt.toISOString(),
          quality,
          note: noteOf(note),
          ...aiMeta,
        })
      }}
    >
      <MagicFieldBlock stage={1} activeStage={magicStage} streaming={magicStreaming}>
        <TimeRangeField
          label={isMakeup ? '昨天的睡眠' : '昨晚的睡眠'}
          start={shownBed}
          end={shownWake}
          onStartChange={(v) => {
            setBed(v)
            setLocalError(undefined)
          }}
          onEndChange={(v) => {
            setWake(v)
            setLocalError(undefined)
          }}
          error={wakeError}
          hint="记到起床那天"
        />
      </MagicFieldBlock>

      <MagicFieldBlock stage={2} activeStage={magicStage} streaming={magicStreaming}>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-caption font-semibold">睡眠质量</span>
          <Rating
            value={shownQuality}
            onValueChange={(v) => {
              setQuality(v)
              setLocalError(undefined)
            }}
            label="睡眠质量"
            tone="sleep"
          />
        </div>
      </MagicFieldBlock>

      <MagicFieldBlock stage={3} activeStage={magicStage} streaming={magicStreaming}>
        <NoteField value={shownNote} onChange={setNote} />
      </MagicFieldBlock>
      <SubmitButton submitting={submitting} />
    </Form>
  )
}

export function StudyForm({
  isMakeup,
  submitting,
  errors,
  smartContext,
  streamedContext,
  magicStreaming,
  magicStage,
  onSubmit,
}: ModuleFormProps) {
  const aiSt = smartContext?.draft.study
  const streamSt = streamedContext?.draft.study
  const [what, setWhat] = useState(
    aiSt?.what ?? (smartContext ? smartContext.draft.summary.slice(0, 60) : ''),
  )
  const [minutes, setMinutes] = useState<number | null>(
    aiSt?.durationMinutes ?? (smartContext ? 30 : null),
  )
  const [note, setNote] = useState(aiSt?.note ?? '')

  const shownWhat = magicStreaming && streamSt ? streamSt.what : what
  const shownMinutes = magicStreaming && streamSt ? streamSt.durationMinutes : minutes
  const shownNote = magicStreaming && streamSt ? (streamSt.note ?? '') : note

  const aiMeta =
    smartContext && !isMakeup
      ? {
          source: 'ai' as const,
          aiRunId: smartContext.aiRunId,
          parsedText: smartContext.draft.summary,
        }
      : {}
  return (
    <Form
      errors={errors}
      className="min-w-0 gap-2.5"
      onFormSubmit={() =>
        onSubmit({
          module: 'study',
          isMakeup,
          what: what.trim() || (smartContext ? '学习打卡' : ''),
          durationSeconds: minutes === null ? undefined : Math.round(minutes * 60),
          note: noteOf(note),
          ...aiMeta,
        })
      }
    >
      <MagicFieldBlock stage={1} activeStage={magicStage} streaming={magicStreaming}>
        <Field
          label="学了什么"
          htmlFor="checkin-what"
          name="what"
          aside={`${shownWhat.length} / 60`}
          className="min-w-0 gap-1"
        >
          <Input
            id="checkin-what"
            value={shownWhat}
            maxLength={60}
            placeholder="例如：背了 30 个单词"
            onChange={(e) => setWhat(e.target.value)}
            className="text-caption h-10 px-3"
          />
        </Field>
      </MagicFieldBlock>

      <MagicFieldBlock stage={2} activeStage={magicStage} streaming={magicStreaming}>
        <Field
          label="时长"
          htmlFor="checkin-study-minutes"
          name="durationSeconds"
          aside="可选"
          className="min-w-0 gap-1"
        >
          <NumberField
            id="checkin-study-minutes"
            size="sm"
            value={shownMinutes}
            onValueChange={setMinutes}
            min={1}
            max={1440}
            step={5}
            unit="分钟"
          />
        </Field>
      </MagicFieldBlock>

      <MagicFieldBlock stage={3} activeStage={magicStage} streaming={magicStreaming}>
        <NoteField value={shownNote} onChange={setNote} />
      </MagicFieldBlock>
      <SubmitButton submitting={submitting} />
    </Form>
  )
}

export function CustomForm({
  goal,
  isMakeup,
  submitting,
  errors,
  smartContext,
  streamedContext,
  magicStreaming,
  magicStage,
  onSubmit,
}: ModuleFormProps) {
  const fields = goal.fields ?? []
  const aiCu = smartContext?.draft.custom
  const streamCu = streamedContext?.draft.custom
  const [values, setValues] = useState<FieldValues>(() =>
    sanitizeCustomValues(fields, aiCu?.values, { fillRequiredDefaults: Boolean(smartContext) }),
  )
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>()
  const [note, setNote] = useState(
    aiCu?.note ?? (smartContext ? smartContext.draft.summary.slice(0, NOTE_MAX) : ''),
  )

  const shownValues =
    magicStreaming && streamCu
      ? sanitizeCustomValues(fields, streamCu.values, { fillRequiredDefaults: true })
      : values
  const shownNote = magicStreaming && streamCu ? (streamCu.note ?? '') : note

  const aiMeta =
    smartContext && !isMakeup
      ? {
          source: 'ai' as const,
          aiRunId: smartContext.aiRunId,
          parsedText: smartContext.draft.summary,
        }
      : {}
  return (
    <Form
      errors={errors}
      className="min-w-0 gap-2.5"
      onFormSubmit={() => {
        const sanitized = sanitizeCustomValues(fields, values, {
          fillRequiredDefaults: Boolean(smartContext),
        })
        const r = buildSchema(fields).safeParse(sanitized)
        if (!r.success) {
          const flat = z.flattenError(r.error)
          setFieldErrors(flat.fieldErrors)
          const firstMsg =
            flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat().find(Boolean)
          toast.error(firstMsg ?? '请先完成必填项后再确认记录')
          return
        }
        setFieldErrors(undefined)
        const clean = Object.fromEntries(
          Object.entries(r.data).filter(
            (e): e is [string, NonNullable<(typeof e)[1]>] => e[1] !== undefined,
          ),
        )
        onSubmit({
          module: 'custom',
          isMakeup,
          fieldVersion: goal.fieldVersion ?? 1,
          values: clean,
          note: noteOf(note),
          ...aiMeta,
        })
      }}
    >
      <MagicFieldBlock stage={1} activeStage={magicStage} streaming={magicStreaming}>
        <SchemaForm
          fields={fields}
          value={shownValues}
          onChange={(next) => {
            setValues(next)
            setFieldErrors((prev) => clearChangedErrors(prev, values, next))
          }}
          errors={fieldErrors}
        />
      </MagicFieldBlock>
      <MagicFieldBlock stage={3} activeStage={magicStage} streaming={magicStreaming}>
        <NoteField value={shownNote} onChange={setNote} />
      </MagicFieldBlock>
      <SubmitButton submitting={submitting} />
    </Form>
  )
}
