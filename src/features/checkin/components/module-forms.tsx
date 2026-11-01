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
import { buildSchema } from '@/features/goal/build-schema'
import { SchemaForm } from '@/features/goal/components/schema-form'
import type { FieldValues } from '@/features/goal/schemas'
import { sleepRangeForDay } from '@/lib/time'
import * as z from 'zod'
import { intensityLabel } from '../format'
import { EXERCISE_CATEGORIES, NOTE_MAX, type Intensity } from '../schemas'
import { NOTE_PLACEHOLDER, type ModuleFormProps } from './form-types'

/*
 * 运动、睡眠、学习、自定义四个板块的打卡表单（PRD 2.4 表）。饮食在 diet-form.tsx。
 * 输入用界面单位（分钟），提交前换算成接口单位（秒）。
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
    <Field label="备注" htmlFor="checkin-note" name="note" aside="可选">
      <Textarea
        id="checkin-note"
        value={value}
        maxLength={NOTE_MAX}
        placeholder={NOTE_PLACEHOLDER}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

const noteOf = (note: string) => (note.trim() === '' ? null : note.trim())

function SubmitButton({ submitting }: { submitting: boolean }) {
  return (
    <Button type="submit" icon="check" className="w-full" loading={submitting}>
      确认记录
    </Button>
  )
}

export function ExerciseForm({ isMakeup, submitting, errors, onSubmit }: ModuleFormProps) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>(() =>
    EXERCISE_CATEGORIES.map((c) => ({ value: c, label: c })),
  )
  const [category, setCategory] = useState<string | null>(null)
  const [minutes, setMinutes] = useState<number | null>(30)
  const [intensity, setIntensity] = useState<Intensity>('moderate')
  const [note, setNote] = useState('')
  return (
    <Form
      errors={errors}
      onFormSubmit={() =>
        onSubmit({
          module: 'exercise',
          isMakeup,
          category: category ?? '',
          intensity,
          durationSeconds: Math.round((minutes ?? 0) * 60),
          note: noteOf(note),
        })
      }
    >
      <Field
        label="运动品类"
        htmlFor="checkin-category"
        name="category"
        hint="没有合适的可以直接输入新建"
      >
        <Combobox
          id="checkin-category"
          options={options}
          value={category}
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
      <Field label="时长" htmlFor="checkin-minutes" name="durationSeconds" hint="1–600 分钟">
        <NumberField
          id="checkin-minutes"
          value={minutes}
          onValueChange={setMinutes}
          min={1}
          max={600}
          step={5}
          unit="分钟"
        />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-caption font-semibold">强度</span>
        <SegmentedControl
          options={intensityOptions}
          value={intensity}
          onValueChange={setIntensity}
          label="强度"
        />
        <p className="text-tiny text-muted">消耗按 MET × 体重 × 时长估算，估算结果，非医疗建议</p>
      </div>
      <NoteField value={note} onChange={setNote} />
      <SubmitButton submitting={submitting} />
    </Form>
  )
}

export function SleepForm({ day, isMakeup, clock, submitting, errors, onSubmit }: ModuleFormProps) {
  const [bed, setBed] = useState('23:00')
  const [wake, setWake] = useState('07:00')
  const [quality, setQuality] = useState<RatingValue | null>(null)
  const [note, setNote] = useState('')
  const [localError, setLocalError] = useState<string>()
  const wakeError =
    localError ?? (typeof errors?.wakeAt === 'string' ? errors.wakeAt : errors?.wakeAt?.[0])
  return (
    <Form
      errors={errors}
      onFormSubmit={() => {
        const range = sleepRangeForDay(day, bed, wake, clock.timeZone, clock.dayStartHour)
        if (!range) return setLocalError('入睡和起床时间不能一样')
        if (quality === null) return setLocalError('给睡眠质量打个分吧')
        setLocalError(undefined)
        onSubmit({
          module: 'sleep',
          isMakeup,
          bedAt: range.bedAt.toISOString(),
          wakeAt: range.wakeAt.toISOString(),
          quality,
          note: noteOf(note),
        })
      }}
    >
      <TimeRangeField
        label={isMakeup ? '昨天的睡眠' : '昨晚的睡眠'}
        start={bed}
        end={wake}
        onStartChange={setBed}
        onEndChange={setWake}
        error={wakeError}
        hint="记到起床那天"
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-caption font-semibold">睡眠质量</span>
        <Rating value={quality} onValueChange={setQuality} label="睡眠质量" tone="sleep" />
      </div>
      <NoteField value={note} onChange={setNote} />
      <SubmitButton submitting={submitting} />
    </Form>
  )
}

export function StudyForm({ isMakeup, submitting, errors, onSubmit }: ModuleFormProps) {
  const [what, setWhat] = useState('')
  const [minutes, setMinutes] = useState<number | null>(null)
  const [note, setNote] = useState('')
  return (
    <Form
      errors={errors}
      onFormSubmit={() =>
        onSubmit({
          module: 'study',
          isMakeup,
          what,
          durationSeconds: minutes === null ? undefined : Math.round(minutes * 60),
          note: noteOf(note),
        })
      }
    >
      <Field label="学了什么" htmlFor="checkin-what" name="what" aside={`${what.length} / 60`}>
        <Input
          id="checkin-what"
          value={what}
          maxLength={60}
          placeholder="例如：背了 30 个单词"
          onChange={(e) => setWhat(e.target.value)}
        />
      </Field>
      <Field label="时长" htmlFor="checkin-study-minutes" name="durationSeconds" aside="可选">
        <NumberField
          id="checkin-study-minutes"
          value={minutes}
          onValueChange={setMinutes}
          min={1}
          max={1440}
          step={5}
          unit="分钟"
        />
      </Field>
      <NoteField value={note} onChange={setNote} />
      <SubmitButton submitting={submitting} />
    </Form>
  )
}

export function CustomForm({ goal, isMakeup, submitting, errors, onSubmit }: ModuleFormProps) {
  const fields = goal.fields ?? []
  const [values, setValues] = useState<FieldValues>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>()
  const [note, setNote] = useState('')
  return (
    <Form
      errors={errors}
      onFormSubmit={() => {
        const r = buildSchema(fields).safeParse(values)
        if (!r.success) return setFieldErrors(z.flattenError(r.error).fieldErrors)
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
        })
      }}
    >
      <SchemaForm fields={fields} value={values} onChange={setValues} errors={fieldErrors} />
      <NoteField value={note} onChange={setNote} />
      <SubmitButton submitting={submitting} />
    </Form>
  )
}
