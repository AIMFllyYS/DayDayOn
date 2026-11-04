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
import type { CheckinClock, CheckinGoal, ModuleFormProps, SmartFillContext } from './form-types'
import { CustomForm, ExerciseForm, SleepForm, StudyForm } from './module-forms'
import {
  SmartMagicTurnBanner,
  SmartPartitionSearchLoader,
  useMagicStreamFill,
} from './smart-magic-stream'
import { CheckinModeTabs, SmartScannerLens, type CheckinInputMode } from './smart-scanner'

/*
 * 打卡页主体（原型 Playbook pages/_screens/checkin.tsx）：目标信息 + 今天进度 → 板块表单 →
 * "补昨天"开关 → "这一项今天满意吗" → 成功后盖章 + 团团欢呼 + 进度。
 * 在「智能拍照 / 智能上传」Tab 下，扫描未出结果前隐藏下方表单，展示搜索动画，识别完成后以流式魔法动画填入表单。
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
  const [inputMode, setInputMode] = useState<CheckinInputMode>(
    props.initialMethod === 'photo' ? 'smart-capture' : 'manual',
  )
  const [smartPhase, setSmartPhase] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [smartContext, setSmartContext] = useState<SmartFillContext | null>(null)
  const [isMakeup, setMakeup] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>()
  const [done, setDone] = useState<CheckinSubmitResult | null>(null)
  // 每次成功后重置表单
  const [formKey, setFormKey] = useState(0)

  const magic = useMagicStreamFill(inputMode === 'manual' ? null : smartContext)

  const tone = goal.module
  const day = isMakeup ? addDays(today, -1) : today
  const shownProgress = done && done.localDate === today ? done.progress : progress

  async function submit(input: CreateCheckinInput) {
    if (submitting) return
    magic.finishImmediately()
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
              setSmartContext(null)
              setSmartPhase('idle')
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
    smartContext: inputMode === 'manual' ? null : smartContext,
    streamedContext: inputMode === 'manual' ? null : magic.streamedContext,
    magicStreaming: inputMode === 'manual' ? false : magic.isMagicStreaming,
    magicStage: inputMode === 'manual' ? 4 : magic.magicStage,
    onSubmit: (input) => void submit(input),
  }

  const isSmartMode = inputMode !== 'manual' && !isMakeup
  const showFormCard = !isSmartMode || smartPhase === 'done'

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

      {/* 全板块统一的「手动填写 | 智能拍照 | 智能上传」三态 Tab 栏 */}
      <CheckinModeTabs
        value={inputMode}
        onValueChange={(next) => {
          setInputMode(next)
          setErrors(undefined)
        }}
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

      {/* 单板块打卡页已明确知道所属方向，切换至智能拍照/智能上传时直接挂载扫描镜（跳过板块判别器） */}
      {isSmartMode && (
        <SmartScannerLens
          mode={inputMode}
          hintModule={goal.module}
          goalId={goal.id}
          tone={tone}
          onScanStart={() => {
            setSmartContext(null)
            setSmartPhase('scanning')
          }}
          onRecognized={(res) => {
            setSmartContext(res)
            setSmartPhase('done')
            setErrors(undefined)
          }}
          onScanError={() => {
            setSmartPhase('idle')
          }}
          onManualFallback={() => {
            setInputMode('manual')
          }}
        />
      )}

      {/* 扫描进行中：展示当前板块专属的提取加载动画，不提前暴露空白表单 */}
      {isSmartMode && smartPhase === 'scanning' && (
        <SmartPartitionSearchLoader knownModule={tone} />
      )}

      {/* 识别完成后：Agent 流式魔法摘要条 */}
      {isSmartMode && smartPhase === 'done' && smartContext && (
        <SmartMagicTurnBanner
          tone={tone}
          summary={magic.streamedSummary}
          streaming={magic.isMagicStreaming}
          magicStage={magic.magicStage}
        />
      )}

      {showFormCard && (
        <Card
          key={`${formKey}-${smartContext?.aiRunId ?? 'manual'}`}
          onPointerDown={() => magic.finishImmediately()}
          className={isSmartMode ? 'animate-fade-up' : undefined}
        >
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
      )}

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
