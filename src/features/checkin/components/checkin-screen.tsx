'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { FormErrors } from '@/components/ui/form'
import { ProgressBar } from '@/components/ui/progress'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { Stamp } from '@/components/ui/stamp'
import { Switch } from '@/components/ui/switch'
import { moduleMeta } from '@/components/ui/tone'
import { addDays, formatLocalDateLabel } from '@/lib/time'
import { progressText, targetText } from '../format'
import type { Checkin, CreateCheckinInput, DietMethod, GoalProgress } from '../schemas'
import { DietForm } from './diet-form'
import type { CheckinClock, CheckinGoal, ModuleFormProps } from './form-types'
import { CustomForm, ExerciseForm, SleepForm, StudyForm } from './module-forms'

/*
 * 打卡页主体（原型 Playbook pages/_screens/checkin.tsx）：目标信息 + 今天进度 → 板块表单 →
 * "补昨天"开关 → "这一项今天满意吗" → 成功后盖章 + 团团欢呼 + 进度。
 * 纯界面：提交、评分由调用方（checkin-page.tsx 接接口，Playbook 用演示函数）传入。
 */

export interface CheckinSubmitResult {
  /** 记到了哪一天 */
  localDate: string
  progress: GoalProgress
}

export interface CheckinScreenProps {
  goal: CheckinGoal
  /** 今天的打卡日 */
  today: string
  /** 今天的进度 */
  progress: GoalProgress
  clock: CheckinClock
  initialMethod?: DietMethod
  /** 今天这个板块的满意度 */
  rating: RatingValue | null
  onRate: (value: RatingValue) => void
  /** 提交；失败时 reject，表单错误由 onError 返回给表单 */
  onSubmit: (input: CreateCheckinInput) => Promise<CheckinSubmitResult>
  /** 把错误转成表单错误（有 fields 时）；返回 undefined 表示已经弹了提示 */
  toFormErrors: (error: unknown) => FormErrors | undefined
  /** AI 识别确认后，取最新进度 */
  onAiConfirmed: (checkin: Checkin) => Promise<CheckinSubmitResult>
}

export function CheckinScreen(props: CheckinScreenProps) {
  const { goal, today, progress, clock, rating, onRate } = props
  const [isMakeup, setMakeup] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>()
  const [done, setDone] = useState<CheckinSubmitResult | null>(null)
  // 每次成功后重置表单
  const [formKey, setFormKey] = useState(0)

  const tone = goal.module
  const day = isMakeup ? addDays(today, -1) : today
  const shownProgress = done && done.localDate === today ? done.progress : progress

  async function submit(input: CreateCheckinInput) {
    if (submitting) return
    setSubmitting(true)
    setErrors(undefined)
    try {
      setDone(await props.onSubmit(input))
    } catch (e) {
      setErrors(props.toFormErrors(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function aiConfirmed(c: Checkin) {
    setDone(await props.onAiConfirmed(c))
  }

  if (done) {
    const [, mm, dd] = done.localDate.split('-')
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center" aria-live="polite">
        <div className="relative">
          <Mascot mood="cheer" size={120} />
          <Stamp
            caption={`${mm}.${dd}`}
            tone={tone}
            animate
            size={72}
            className="absolute -top-2 -right-12"
          />
        </div>
        <p className="text-heading font-bold">
          {done.localDate === today ? `${goal.title}记好啦` : '昨天的补上啦'}
        </p>
        <p className="text-caption text-muted">
          {done.localDate === today ? '今天' : formatLocalDateLabel(done.localDate)}
          {done.progress.done ? '已经完成目标' : '的进度'} ·{' '}
          {progressText(goal.target.kind, done.progress)}
        </p>
        <ProgressBar
          value={done.progress.value}
          max={done.progress.target}
          tone={tone}
          label="进度"
          className="max-w-xs"
        />
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button
            variant="soft"
            onClick={() => {
              setDone(null)
              setFormKey((k) => k + 1)
            }}
          >
            再记一条
          </Button>
          <Link
            href="/"
            className="text-foreground hover:bg-surface-sunken flex h-11 items-center rounded-full px-5 font-semibold"
          >
            回主页
          </Link>
        </div>
      </div>
    )
  }

  const formProps: ModuleFormProps = {
    goal,
    day,
    isMakeup,
    clock,
    submitting,
    errors,
    onSubmit: (input) => void submit(input),
  }

  return (
    <div className="mx-auto grid w-full max-w-xl gap-3 pt-2 pb-8">
      <div className="flex items-center gap-2.5">
        <IconTile icon={moduleMeta[tone].icon} tone={tone} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{goal.title}</p>
          <p className="text-tiny text-muted">
            {targetText(goal.target)} · 今天 {progressText(goal.target.kind, shownProgress)}
          </p>
        </div>
        <Badge tone={tone}>{moduleMeta[tone].label}</Badge>
      </div>
      <ProgressBar
        value={shownProgress.value}
        max={shownProgress.target}
        tone={tone}
        size="sm"
        label="今天的进度"
      />

      <Card variant="outline" className="flex items-center gap-3 py-2 md:py-2">
        <div className="min-w-0 flex-1">
          <p id="makeup-label" className="text-caption font-semibold">
            补昨天
          </p>
          <p className="text-tiny text-muted">
            {isMakeup ? `记到 ${formatLocalDateLabel(day)}` : '昨天忘了记？打开后记到昨天'}
          </p>
        </div>
        <Switch checked={isMakeup} onCheckedChange={setMakeup} label="补昨天" />
      </Card>

      <Card key={formKey}>
        {goal.module === 'exercise' && <ExerciseForm {...formProps} />}
        {goal.module === 'diet' && (
          <DietForm
            {...formProps}
            initialMethod={props.initialMethod}
            onConfirmed={(c) => void aiConfirmed(c)}
          />
        )}
        {goal.module === 'sleep' && <SleepForm {...formProps} />}
        {goal.module === 'study' && <StudyForm {...formProps} />}
        {goal.module === 'custom' && <CustomForm {...formProps} />}
      </Card>

      <Card>
        <p className="text-caption mb-2 font-semibold">这一项今天满意吗？</p>
        <Rating
          value={rating}
          onValueChange={onRate}
          tone={tone}
          label={`${moduleMeta[tone].label}满意度`}
        />
      </Card>
    </div>
  )
}
