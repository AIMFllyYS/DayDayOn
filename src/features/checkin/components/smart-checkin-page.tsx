'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import type { FormErrors } from '@/components/ui/form'
import { Icon } from '@/components/ui/icon'
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
import { BUSINESS_TIME_ZONE, calendarDateOf, formatMonthDay } from '@/lib/time'
import { progressText, targetText } from '../format'
import type { CreateCheckinInput, GoalProgress } from '../schemas'
import {
  deleteSmartHistoryRecord,
  getSmartHistoryRecord,
  markSmartHistoryConfirmed,
  peekPendingSmartCapture,
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
import {
  SmartMagicTurnBanner,
  SmartPartitionSearchLoader,
  useMagicStreamFill,
} from './smart-magic-stream'
import {
  SMART_IMAGE_ACCEPT,
  SMART_UPLOAD_ACCEPT,
  SmartModuleDetector,
  SmartScannerLens,
} from './smart-scanner'

/*
 * 全局智能识别与历史拍摄记录页面（/checkin/smart）：
 * 1. 扫描视图（scanner）：
 *    - 未扫描前（idle）：只展示 SmartScannerLens 扫描镜，不提前暴露下方分区与表单；
 *    - 扫描进行中（scanning）：扫描条上下往返 + 1/2/3 步骤转圈 + 下方展示 SmartPartitionSearchLoader 分区搜索动画；
 *    - 识别完成后（done）：锁定识别分区 + Agent 流式魔法输出摘要 + 表单各字段按序逐字流式填入；
 *    - 未确认记录直接退出时，触发二次确认弹窗并提示可在右上角查看历史拍摄记录。
 * 2. 历史拍摄记录视图（history）：
 *    - 顶栏右上角与打卡抽屉右上角（叉号左侧）均可进入；
 *    - 复用 Agent 对话历史列表结构样式，全屏展示并带独立滚动机制；
 *    - 点进去可查看之前拍摄/上传识别出的完整内容，仅存图片相对路径，无原图时展示温馨提示。
 */

export function SmartTopBarActions() {
  const viewMode = useSmartPageViewMode()
  const isHistory = viewMode === 'history'

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
    initialRecord?.mode ?? (initialAction === 'upload' ? 'smart-upload' : 'smart-capture'),
  )
  const [scanPhase, setScanPhase] = useState<'idle' | 'scanning' | 'done' | 'manual'>(
    initialRecord ? 'done' : hasPendingOnMount ? 'scanning' : 'idle',
  )
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(initialRecord?.id ?? null)
  const [selectedModule, setSelectedModule] = useState<Module>(
    initialRecord?.result.draft.detectedModule ?? 'diet',
  )
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(
    initialRecord?.result.draft.matchedGoalId ?? null,
  )
  const [smartContext, setSmartContext] = useState<SmartFillContext | null>(
    initialRecord?.result ?? null,
  )
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
    setSmartPageViewMode(initialView)
  }, [initialView])

  const activeHistoryRecord = activeHistoryId
    ? (historyRecords.find((r) => r.id === activeHistoryId) ?? null)
    : null

  const magic = useMagicStreamFill(activeHistoryRecord ? null : smartContext)

  // 未确认记录退出守卫：当已识别出结果且尚未点击「确认记录」入库时，拦截顶栏返回按钮弹出二次确认
  const isCurrentRecordConfirmed = Boolean(done || activeHistoryRecord?.confirmed)
  const shouldGuardExit = Boolean(
    viewMode === 'scanner' && scanPhase === 'done' && smartContext && !isCurrentRecordConfirmed,
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
    setActiveHistoryId(null)
    setActiveMode(savedRecord.mode)
    setSmartContext(res)
    setSelectedModule(res.draft.detectedModule)
    setSelectedGoalId(res.draft.matchedGoalId)
    setScanPhase('done')
    setErrors(undefined)
    setDone(null)
  }

  function handleSelectHistoryRecord(record: SmartHistoryRecord) {
    setActiveHistoryId(record.id)
    setActiveMode(record.mode)
    setSmartContext(record.result)
    setSelectedModule(record.result.draft.detectedModule)
    setSelectedGoalId(record.result.draft.matchedGoalId)
    setScanPhase('done')
    setErrors(undefined)
    setDone(null)
    setSmartPageViewMode('scanner')
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

  // 全屏一级菜单列表视图：历史智能拍摄 / 上传记录（复用 Agent 对话历史列表结构与全屏滚动机制）
  if (viewMode === 'history') {
    return (
      <SmartHistoryListView
        records={historyRecords}
        activeRecordId={activeHistoryId}
        timeZone={timeZone}
        onSelectRecord={handleSelectHistoryRecord}
        onDeleteRecord={(id) => {
          deleteSmartHistoryRecord(id)
          if (activeHistoryId === id) {
            setActiveHistoryId(null)
            setSmartContext(null)
            setScanPhase('idle')
          }
          toast.success('已删除历史拍摄记录')
        }}
        onStartNewScan={(file, mode) => {
          setActiveHistoryId(null)
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
              setActiveHistoryId(null)
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
        streamedContext: activeHistoryRecord ? smartContext : magic.streamedContext,
        magicStreaming: activeHistoryRecord ? false : magic.isMagicStreaming,
        magicStage: activeHistoryRecord ? 4 : magic.magicStage,
        onSubmit: (input) => void handleSubmit(input),
      }
    : null

  const showResultSection = scanPhase === 'done' || scanPhase === 'manual'

  return (
    <div className="mx-auto flex w-full max-w-lg min-w-0 flex-col gap-2.5 pt-1.5 pb-6">
      {/* 若正在回看某条历史拍摄记录，顶部提供返回历史列表快捷条 */}
      {activeHistoryRecord && (
        <div className="bg-surface-sunken/70 flex min-w-0 items-center justify-between gap-2 rounded-full px-3 py-1.5">
          <button
            type="button"
            onClick={() => setSmartPageViewMode('history')}
            className="text-primary-ink text-tiny inline-flex items-center gap-1 font-semibold hover:underline"
          >
            <Icon name="chevron-left" size={14} lineOnly />
            <span>返回历史拍摄记录列表</span>
          </button>
          <span className="text-tiny text-muted truncate">
            {formatMonthDay(calendarDateOf(activeHistoryRecord.createdAt, timeZone))} ·{' '}
            {activeHistoryRecord.mode === 'smart-capture' ? '智能拍照' : '智能上传'}
          </span>
        </div>
      )}

      {/* 1. 极简扫描镜 */}
      <SmartScannerLens
        mode={activeMode}
        tone={selectedModule}
        historyRecord={activeHistoryRecord}
        onScanStart={(nextMode) => {
          setActiveHistoryId(null)
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
            magicHighlight={!activeHistoryRecord && magic.isMagicStreaming}
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
              summary={activeHistoryRecord ? smartContext.draft.summary : magic.streamedSummary}
              streaming={activeHistoryRecord ? false : magic.isMagicStreaming}
              magicStage={activeHistoryRecord ? 4 : magic.magicStage}
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
                <Badge
                  tone={activeHistoryRecord?.confirmed ? 'success' : selectedModule}
                  className="shrink-0"
                >
                  {activeHistoryRecord?.confirmed
                    ? '已确认记录'
                    : magic.isMagicStreaming
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

/**
 * 历史智能拍摄 / 上传记录单页视图：
 * - 顶部：完整展示标题说明与「智能拍照 / 智能上传」双栏快捷入口卡片（上下分层，杜绝文字挤压截断）；
 * - 下方：类表格结构的历史记录容器，通过抵消 AppShell 主区域的底栏预留留白，直接延伸贴合至页面最底部，彻底消除底部悬空断层。
 */
function SmartHistoryListView({
  records,
  activeRecordId,
  timeZone,
  onSelectRecord,
  onDeleteRecord,
  onStartNewScan,
}: {
  records: readonly SmartHistoryRecord[]
  activeRecordId: string | null
  timeZone: string
  onSelectRecord: (record: SmartHistoryRecord) => void
  onDeleteRecord: (id: string) => void
  onStartNewScan: (file: File, mode: SmartInputMode) => void
}) {
  const captureInputRef = useRef<HTMLInputElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  const pendingCount = records.filter((r) => !r.confirmed).length

  function handleCaptureChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onStartNewScan(file, 'smart-capture')
  }

  function handleUploadChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onStartNewScan(file, 'smart-upload')
  }

  return (
    <div className="mx-auto -mb-[calc(var(--safe-bottom)+6.5rem)] flex min-h-[calc(100dvh-3.5rem)] w-full max-w-lg min-w-0 flex-1 flex-col gap-3 pt-1.5 md:-mb-8 md:min-h-[calc(100dvh-4.5rem)]">
      <input
        ref={captureInputRef}
        type="file"
        accept={SMART_IMAGE_ACCEPT}
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleCaptureChange}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept={SMART_UPLOAD_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleUploadChange}
      />

      {/* 顶部概要与快捷操作卡片（上下分层，标题与副标题完整显示不截断） */}
      <Card className="flex shrink-0 flex-col gap-3 p-3.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <IconTile icon="clock" tone="primary" size="sm" />
            <div className="min-w-0 flex-1">
              <h2 className="text-caption font-bold">识别与打卡历史记录</h2>
              <p className="text-tiny text-muted truncate">
                仅保存图片相对路径 · 点选记录可回看或补确认入库
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge tone="neutral">共 {records.length} 条</Badge>
            {pendingCount > 0 && <Badge tone="warning">{pendingCount} 待确认</Badge>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="soft"
            icon="camera"
            className="h-9 w-full"
            onClick={() => captureInputRef.current?.click()}
          >
            智能拍照
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon="sparkles"
            className="h-9 w-full"
            onClick={() => uploadInputRef.current?.click()}
          >
            智能上传
          </Button>
        </div>
      </Card>

      {/* 下方类表格历史记录区：延伸贴合至页面最底部，消除底部悬空断层 */}
      <div className="border-border bg-surface shadow-soft flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-3xl border-x border-t pb-[calc(var(--safe-bottom,0px)+0.5rem)] md:rounded-t-3xl">
        {/* 表头栏 */}
        <div className="bg-surface-sunken/75 border-border text-muted text-tiny flex shrink-0 items-center justify-between border-b px-4 py-2.5 font-semibold">
          <span>识别记录 / 图片相对路径</span>
          <span>状态 · 日期 · 操作</span>
        </div>

        {/* 表格内容行 */}
        <div
          role="list"
          aria-label="历史智能拍摄与上传记录列表"
          className="divide-border flex min-h-0 flex-1 flex-col divide-y overflow-x-hidden overflow-y-auto overscroll-contain"
        >
          {records.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4 py-12">
              <EmptyState
                size="compact"
                title="还没有历史拍摄或上传记录"
                description="点击上方「智能拍照」或「智能上传」，识别出的记录会自动保存在这里"
              />
            </div>
          ) : (
            <>
              {records.map((record) => {
                const mod = record.result.draft.detectedModule
                const isSelected = record.id === activeRecordId
                const relPath = record.relativeImagePath ?? `captures/${record.fileName}`
                return (
                  <div
                    key={record.id}
                    role="listitem"
                    className={cn(
                      'group flex w-full min-w-0 items-center gap-1 pr-2 transition-colors',
                      isSelected
                        ? 'bg-primary-soft/65 text-foreground'
                        : 'text-muted hover:bg-surface-sunken/60 hover:text-foreground',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectRecord(record)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 py-3 pl-3.5 text-left"
                    >
                      <IconTile icon={moduleMeta[mod].icon} tone={mod} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-caption text-foreground truncate font-semibold">
                          {record.result.draft.summary}
                        </p>
                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                          <span className="bg-surface-sunken text-subtle text-tiny shrink-0 rounded-md px-1.5 py-0.5 font-medium">
                            {record.mode === 'smart-capture' ? '智能拍照' : '智能上传'}
                          </span>
                          <span className="text-tiny text-muted min-w-0 flex-1 truncate font-mono">
                            {relPath}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 pl-1">
                        <Badge tone={record.confirmed ? 'success' : 'warning'} className="shrink-0">
                          {record.confirmed ? '已确认' : '待确认'}
                        </Badge>
                        <span className="text-tiny text-subtle tabular-nums">
                          {formatMonthDay(calendarDateOf(record.createdAt, timeZone))}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={`删除记录 ${record.result.draft.summary}`}
                      onClick={() => onDeleteRecord(record.id)}
                      className="text-subtle hover:text-danger-ink hover:bg-danger-soft/40 flex size-8 shrink-0 items-center justify-center rounded-full opacity-75 transition-colors hover:opacity-100"
                    >
                      <Icon name="trash" size={14} lineOnly />
                    </button>
                  </div>
                )
              })}
              <div className="border-border text-subtle text-tiny border-t px-4 py-3 text-center">
                已展示全部 {records.length} 条识别记录 · 仅保留图片相对路径
              </div>
            </>
          )}
        </div>
      </div>
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
