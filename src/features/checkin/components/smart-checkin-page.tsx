'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import type { FormErrors } from '@/components/ui/form'
import { ProgressBar } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Stamp } from '@/components/ui/stamp'
import { toast } from '@/components/ui/toast'
import { moduleMeta } from '@/components/ui/tone'
import { GoalLinkButton } from '@/features/goal/components/goal-link-button'
import type { Module } from '@/features/shared/schemas'
import { errorMessage, isApiError, newIdempotencyKey, useQuery } from '@/lib/api'
import { checkinMeQuery, checkinTodayQuery, useCreateCheckin } from '@/lib/api/queries/checkins'
import { goalListQuery } from '@/lib/api/queries/goals'
import { cn } from '@/lib/cn'
import { progressText, targetText } from '../format'
import type { CreateCheckinInput, GoalProgress } from '../schemas'
import type { SmartRecognitionResult } from '../smart-schemas'
import { DietForm } from './diet-form'
import type { ModuleFormProps, SmartFillContext } from './form-types'
import { CustomForm, ExerciseForm, SleepForm, StudyForm } from './module-forms'
import { SmartModuleDetector, SmartScannerLens } from './smart-scanner'

/*
 * 全局智能识别页面（/checkin/smart）：
 * 1. SmartScannerLens（扫描镜）：支持拍照或上传图片 / TXT / HTML 附件，实时显示 3 步扫描进度；
 * 2. SmartModuleDetector（一行识别方向条）：AI 自动高亮识别出的打卡板块，用户也可点选同行胶囊秒切方向；
 * 3. 5 选 1 板块表单：自动匹配该板块下进行中的目标并预填识别出的数值，用户确认或微调后提交入库。
 */

export function SmartCheckinPage({
  initialAction = 'capture',
}: {
  initialAction?: 'capture' | 'upload'
}) {
  const goals = useQuery(goalListQuery('active'))
  const today = useQuery(checkinTodayQuery())
  const me = useQuery(checkinMeQuery())
  const create = useCreateCheckin()

  const [selectedModule, setSelectedModule] = useState<Module>('diet')
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const [smartContext, setSmartContext] = useState<SmartFillContext | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>()
  const [done, setDone] = useState<{
    localDate: string
    progress: GoalProgress
    goalTitle: string
    module: Module
    targetKind: 'duration' | 'count'
  } | null>(null)
  const [key, setKey] = useState(newIdempotencyKey)
  const [lastBody, setLastBody] = useState<string | null>(null)

  if (goals.isPending || today.isPending || me.isPending) {
    return <SmartCheckinSkeleton />
  }

  const error = goals.error ?? today.error ?? me.error
  if (error || !goals.data || !today.data || !me.data) {
    return (
      <ErrorState
        title="智能识别页没加载出来"
        message={isApiError(error) ? errorMessage(error) : undefined}
        retrying={goals.isRefetching || today.isRefetching || me.isRefetching}
        onRetry={() => {
          void goals.refetch()
          void today.refetch()
          void me.refetch()
        }}
      />
    )
  }

  const allGoals = goals.data.items
  const moduleGoals = allGoals.filter((g) => g.module === selectedModule)
  const activeGoal = moduleGoals.find((g) => g.id === selectedGoalId) ?? moduleGoals[0] ?? null

  function handleRecognized(res: SmartRecognitionResult) {
    setSmartContext(res)
    setSelectedModule(res.draft.detectedModule)
    setSelectedGoalId(res.draft.matchedGoalId)
    setErrors(undefined)
    setDone(null)
  }

  async function handleSubmit(input: CreateCheckinInput) {
    if (!activeGoal || submitting) return
    setSubmitting(true)
    setErrors(undefined)
    try {
      const bodyStr = JSON.stringify(input)
      let k = key
      if (lastBody !== null && lastBody !== bodyStr) {
        k = newIdempotencyKey()
        setKey(k)
      }
      setLastBody(bodyStr)
      const result = await create.mutateAsync({
        goalId: activeGoal.id,
        input,
        idempotencyKey: k,
      })
      setKey(newIdempotencyKey())
      setLastBody(null)
      setDone({
        localDate: result.checkin.localDate,
        progress: result.progress,
        goalTitle: activeGoal.title,
        module: activeGoal.module,
        targetKind: activeGoal.target.kind,
      })
    } catch (e) {
      if (isApiError(e) && e.fields) {
        setErrors(e.fields)
      } else {
        toast.error(isApiError(e) ? errorMessage(e) : '出了点小状况，稍后再试试')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    const [, mm, dd] = done.localDate.split('-')
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center" aria-live="polite">
        <div className="relative">
          <Mascot mood="cheer" size={120} />
          <Stamp
            caption={`${mm}.${dd}`}
            tone={done.module}
            animate
            size={72}
            className="absolute -top-2 -right-12"
          />
        </div>
        <p className="text-heading font-bold">{done.goalTitle}记好啦</p>
        <p className="text-caption text-muted">
          今天{done.progress.done ? '已经完成目标' : '的进度'} ·{' '}
          {progressText(done.targetKind, done.progress)}
        </p>
        <ProgressBar
          value={done.progress.value}
          max={done.progress.target}
          tone={done.module}
          label="进度"
          className="max-w-xs"
        />
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button
            variant="soft"
            onClick={() => {
              setDone(null)
              setSmartContext(null)
            }}
          >
            再扫一条
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

  const todayRow = activeGoal ? today.data.goals.find((x) => x.goalId === activeGoal.id) : undefined
  const progress: GoalProgress = activeGoal
    ? (todayRow?.progress ?? { value: 0, target: activeGoal.target.value, done: false })
    : { value: 0, target: 1, done: false }

  const formProps: ModuleFormProps | null = activeGoal
    ? {
        goal: activeGoal,
        day: today.data.localDate,
        isMakeup: false,
        clock: {
          timeZone: me.data.profile.timeZone,
          dayStartHour: me.data.preferences.dayStartHour,
        },
        submitting,
        errors,
        smartContext,
        onSubmit: (input) => void handleSubmit(input),
      }
    : null

  return (
    <div className="mx-auto grid w-full max-w-xl gap-3 pt-2 pb-8">
      {/* 1. 极简扫描镜 */}
      <SmartScannerLens
        mode={initialAction === 'upload' ? 'smart-upload' : 'smart-capture'}
        tone={selectedModule}
        onRecognized={handleRecognized}
      />

      {/* 2. 一行识别方向胶囊条（AI 自动高亮，可点选秒切） */}
      <SmartModuleDetector
        selectedModule={selectedModule}
        onSelectModule={(m) => {
          setSelectedModule(m)
          setSelectedGoalId(null)
          setErrors(undefined)
        }}
      />

      {/* 3. 动态加载对应打卡板块的子表单 */}
      {!activeGoal || !formProps ? (
        <Card>
          <EmptyState
            size="compact"
            title={`还没有「${moduleMeta[selectedModule].label}」板块的目标`}
            description="先创建一个该板块的小目标，就能把识别结果记进去啦"
            action={<GoalLinkButton href="/goals/new">去新建目标</GoalLinkButton>}
          />
        </Card>
      ) : (
        <Card
          key={`${activeGoal.id}-${smartContext?.aiRunId ?? 'init'}`}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <IconTile icon={moduleMeta[selectedModule].icon} tone={selectedModule} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-caption truncate font-bold">{activeGoal.title}</p>
                <p className="text-tiny text-muted">
                  {targetText(activeGoal.target)} · 今天{' '}
                  {progressText(activeGoal.target.kind, progress)}
                </p>
              </div>
            </div>
            <Badge tone={selectedModule}>
              {smartContext ? 'AI 已预填' : moduleMeta[selectedModule].label}
            </Badge>
          </div>

          {moduleGoals.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="选择具体目标">
              {moduleGoals.map((g) => {
                const isSelected = g.id === activeGoal.id
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedGoalId(g.id)}
                    className={cn(
                      'text-tiny rounded-full px-3 py-1 font-semibold transition-colors',
                      isSelected
                        ? 'bg-primary-soft text-primary-ink font-bold'
                        : 'bg-surface-sunken text-muted hover:text-foreground',
                    )}
                  >
                    {g.title}
                  </button>
                )
              })}
            </div>
          )}

          {selectedModule === 'exercise' && <ExerciseForm {...formProps} />}
          {selectedModule === 'diet' && <DietForm {...formProps} />}
          {selectedModule === 'sleep' && <SleepForm {...formProps} />}
          {selectedModule === 'study' && <StudyForm {...formProps} />}
          {selectedModule === 'custom' && <CustomForm {...formProps} />}
        </Card>
      )}
    </div>
  )
}

function SmartCheckinSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="mx-auto grid w-full max-w-xl gap-3 pt-2">
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-11 w-full rounded-full" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  )
}
