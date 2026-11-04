'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
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
import { BUSINESS_TIME_ZONE } from '@/lib/time'
import { progressText, targetText } from '../format'
import type { CreateCheckinInput, GoalProgress } from '../schemas'
import {
  deleteSmartHistoryRecord,
  getSmartHistoryRecord,
  getSmartPageViewMode,
  markSmartHistoryConfirmed,
  peekPendingSmartCapture,
  registerSmartBackHandler,
  setPendingSmartCapture,
  setSmartPageViewMode,
  setUnconfirmedSmartRecord,
  useSmartHistory,
  useSmartPageViewMode,
  type SmartHistoryRecord,
  type SmartInputMode,
} from '../smart-handoff'
import type { SmartRecognitionResult } from '../smart-schemas'
import { DietForm } from './diet-form'
import type { ModuleFormProps, SmartFillContext } from './form-types'
import { CustomForm, ExerciseForm, SleepForm, StudyForm } from './module-forms'
import { SmartHistoryDetailView, SmartHistoryListView } from './smart-history-view'
import {
  SmartMagicTurnBanner,
  SmartPartitionSearchLoader,
  useMagicStreamFill,
} from './smart-magic-stream'
import { SmartModuleDetector, SmartScannerLens } from './smart-scanner'

/*
 * 全局智能识别与历史记录页（/checkin/smart）：
 * 1. 实时扫描视图（scanner）：
 *    - 未扫描前（idle）：只展示 SmartScannerLens 扫描镜；
 *    - 扫描进行中（scanning）：扫描条上下往返 + 1/2/3 步骤转圈 + SmartPartitionSearchLoader 分区搜索动画；
 *    - 识别完成后（done）：锁定识别分区 + Agent 流式魔法输出摘要 + 表单各字段按序流式填入；
 *    - 未确认记录直接退出时，触发二次确认弹窗并提示可在右上角查看历史拍摄记录。
 * 2. 历史记录列表视图（history）：
 *    - 顶部概要与双栏操作卡 + 下方触底类表格容器（SmartHistoryListView）。
 * 3. 历史记录只读详情视图（history-detail）：
 *    - 从历史列表点选进入纯只读模式（SmartHistoryDetailView），点击返回直接回退到历史列表，绝不弹确认退出框。
 */

export function SmartTopBarActions() {
  const viewMode = useSmartPageViewMode()
  const isHistory = viewMode === 'history' || viewMode === 'history-detail'

  return (
    <IconButton
      icon="clock"
      label="历史拍摄记录"
      variant={isHistory ? 'soft' : 'ghost'}
      onClick={() => setSmartPageViewMode(isHistory ? 'scanner' : 'history')}
    />
  )
}

export function SmartCheckinPage({
  initialAction = 'capture',
  initialView = 'scanner',
  initialRecordId,
}: {
  initialAction?: 'capture' | 'upload'
  initialView?: 'scanner' | 'history'
  initialRecordId?: string
}) {
  const goals = useQuery(goalListQuery('active'))
  const today = useQuery(checkinTodayQuery())
  const me = useQuery(checkinMeQuery())
  const create = useCreateCheckin()
  const historyRecords = useSmartHistory()
  const viewMode = useSmartPageViewMode()

  const initialRecord = initialRecordId ? getSmartHistoryRecord(initialRecordId) : null
  const hasPendingOnMount = Boolean(peekPendingSmartCapture())

  const [activeMode, setActiveMode] = useState<SmartInputMode>(
    initialAction === 'upload' ? 'smart-upload' : 'smart-capture',
  )
  const [scanPhase, setScanPhase] = useState<'idle' | 'scanning' | 'done' | 'manual'>(
    hasPendingOnMount ? 'scanning' : 'idle',
  )
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(initialRecord?.id ?? null)
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

  useEffect(() => {
    if (initialRecordId && getSmartHistoryRecord(initialRecordId)) {
      setSmartPageViewMode('history-detail')
    } else {
      setSmartPageViewMode(initialView)
    }
  }, [initialView, initialRecordId])

  // 注册顶栏左上角返回键拦截器：
  // 处于只读历史详情（history-detail）时，点击返回直接回退到历史记录列表（history），绝不弹退出确认弹窗
  useEffect(() => {
    return registerSmartBackHandler(() => {
      if (getSmartPageViewMode() === 'history-detail') {
        setSmartPageViewMode('history')
        return true
      }
      return false
    })
  }, [])

  const viewingHistoryRecord = viewingHistoryId
    ? (historyRecords.find((r) => r.id === viewingHistoryId) ?? null)
    : null

  const magic = useMagicStreamFill(viewMode === 'scanner' ? smartContext : null)

  // 未确认记录退出守卫：仅当处于实时扫描视图（scanner）且刚识别出结果尚未确认入库时才激活
  const shouldGuardExit = Boolean(
    viewMode === 'scanner' && scanPhase === 'done' && smartContext && !done,
  )

  useEffect(() => {
    setUnconfirmedSmartRecord(shouldGuardExit)
    return () => {
      setUnconfirmedSmartRecord(false)
    }
  }, [shouldGuardExit])

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

  const timeZone = me.data.profile.timeZone ?? BUSINESS_TIME_ZONE
  const allGoals = goals.data.items
  const moduleGoals = allGoals.filter((g) => g.module === selectedModule)
  const activeGoal = moduleGoals.find((g) => g.id === selectedGoalId) ?? moduleGoals[0] ?? null

  function handleRecognized(res: SmartRecognitionResult, savedRecord: SmartHistoryRecord) {
    setViewingHistoryId(null)
    setActiveMode(savedRecord.mode)
    setSmartContext(res)
    setSelectedModule(res.draft.detectedModule)
    setSelectedGoalId(res.draft.matchedGoalId)
    setScanPhase('done')
    setErrors(undefined)
    setDone(null)
  }

  function handleSelectHistoryRecord(record: SmartHistoryRecord) {
    setViewingHistoryId(record.id)
    setSmartPageViewMode('history-detail')
  }

  async function handleSubmit(input: CreateCheckinInput) {
    if (!activeGoal || submitting) return
    magic.finishImmediately()
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
      if (smartContext) {
        markSmartHistoryConfirmed(smartContext.aiRunId, activeGoal.title)
      }
      setUnconfirmedSmartRecord(false)
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
        const firstMsg = Object.values(e.fields).flat().find(Boolean)
        toast.error(firstMsg ?? errorMessage(e))
      } else {
        toast.error(isApiError(e) ? errorMessage(e) : '出了点小状况，稍后再试试')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // 1. 历史记录只读详情视图：点选历史记录后进入纯只读模式，退出直接回退历史列表
  if (viewMode === 'history-detail' && viewingHistoryRecord) {
    return (
      <SmartHistoryDetailView
        record={viewingHistoryRecord}
        timeZone={timeZone}
        onBackToList={() => setSmartPageViewMode('history')}
      />
    )
  }

  // 2. 历史记录单页列表视图：顶部操作卡片 + 下方触底表格容器
  if (viewMode === 'history' || (viewMode === 'history-detail' && !viewingHistoryRecord)) {
    return (
      <SmartHistoryListView
        records={historyRecords}
        activeRecordId={viewingHistoryId}
        timeZone={timeZone}
        onSelectRecord={handleSelectHistoryRecord}
        onDeleteRecord={(id) => {
          deleteSmartHistoryRecord(id)
          if (viewingHistoryId === id) {
            setViewingHistoryId(null)
          }
          toast.success('已删除历史拍摄记录')
        }}
        onStartNewScan={(file, mode) => {
          setViewingHistoryId(null)
          setActiveMode(mode)
          setDone(null)
          setPendingSmartCapture({ file, mode })
          setSmartPageViewMode('scanner')
        }}
      />
    )
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
              setViewingHistoryId(null)
              setSmartContext(null)
              setScanPhase('idle')
            }}
          >
            {activeMode === 'smart-upload' ? '继续上传' : '继续拍摄'}
          </Button>
          <Button
            variant="secondary"
            icon="clock"
            onClick={() => {
              setDone(null)
              setSmartPageViewMode('history')
            }}
          >
            查看历史记录
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
        streamedContext: magic.streamedContext,
        magicStreaming: magic.isMagicStreaming,
        magicStage: magic.magicStage,
        onSubmit: (input) => void handleSubmit(input),
      }
    : null

  const showResultSection = scanPhase === 'done' || scanPhase === 'manual'

  return (
    <div className="mx-auto flex w-full max-w-lg min-w-0 flex-col gap-2.5 pt-1.5 pb-6">
      {/* 1. 极简扫描镜 */}
      <SmartScannerLens
        mode={activeMode}
        tone={selectedModule}
        onScanStart={(nextMode) => {
          setViewingHistoryId(null)
          setActiveMode(nextMode)
          setSmartContext(null)
          setScanPhase('scanning')
        }}
        onRecognized={handleRecognized}
        onScanError={() => {
          setScanPhase('idle')
        }}
        onManualFallback={() => {
          setScanPhase('manual')
        }}
      />

      {/* 2. 扫描进行中：展示「正在搜索哪个打卡分区」自定义懒加载动画 */}
      {scanPhase === 'scanning' && <SmartPartitionSearchLoader />}

      {/* 3. 识别出结果后（或点击手动填写兜底后）：展示一行识别方向条 + 流式魔法填充表单 */}
      {showResultSection && (
        <>
          <SmartModuleDetector
            selectedModule={selectedModule}
            magicHighlight={magic.isMagicStreaming}
            onSelectModule={(m) => {
              magic.finishImmediately()
              setSelectedModule(m)
              setSelectedGoalId(null)
              setErrors(undefined)
            }}
          />

          {smartContext && (
            <SmartMagicTurnBanner
              tone={selectedModule}
              summary={magic.streamedSummary}
              streaming={magic.isMagicStreaming}
              magicStage={magic.magicStage}
            />
          )}

          {!activeGoal || !formProps ? (
            <Card className="animate-fade-up w-full min-w-0 overflow-hidden p-3.5 md:p-4">
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
              onPointerDown={() => magic.finishImmediately()}
              className="animate-fade-up flex w-full min-w-0 flex-col gap-2.5 overflow-hidden p-3.5 md:p-4"
            >
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <IconTile
                    icon={moduleMeta[selectedModule].icon}
                    tone={selectedModule}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-caption truncate font-bold">{activeGoal.title}</p>
                    <p className="text-tiny text-muted truncate">
                      {targetText(activeGoal.target)} · 今天{' '}
                      {progressText(activeGoal.target.kind, progress)}
                    </p>
                  </div>
                </div>
                <Badge tone={selectedModule} className="shrink-0">
                  {magic.isMagicStreaming
                    ? '魔法写入中…'
                    : smartContext
                      ? 'AI 已预填'
                      : moduleMeta[selectedModule].label}
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
                          'text-tiny rounded-full px-2.5 py-1 font-semibold transition-colors',
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
        </>
      )}
    </div>
  )
}

function SmartCheckinSkeleton() {
  return (
    <div
      role="status"
      aria-label="加载中"
      className="mx-auto flex w-full max-w-lg min-w-0 flex-col gap-2.5 pt-1.5"
    >
      <Skeleton className="h-52 w-full rounded-2xl" />
    </div>
  )
}
