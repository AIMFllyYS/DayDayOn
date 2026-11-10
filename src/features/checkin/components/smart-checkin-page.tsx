'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Input } from '@/components/ui/field'
import { IconButton } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { moduleMeta } from '@/components/ui/tone'
import { GoalLinkButton } from '@/features/goal/components/goal-link-button'
import type { Module } from '@/features/shared/schemas'
import { errorMessage, isApiError, newIdempotencyKey, useQuery } from '@/lib/api'
import {
  checkinDayQuery,
  checkinGoalQuery,
  checkinMeQuery,
  checkinTodayQuery,
  useCreateCheckin,
} from '@/lib/api/queries/checkins'
import { goalListQuery } from '@/lib/api/queries/goals'
import { cn } from '@/lib/cn'
import { BUSINESS_TIME_ZONE } from '@/lib/time'
import { CheckinFlow } from '../flow/checkin-flow'
import { FillSection } from '../flow/fill-section'
import { moduleDef } from '../modules/registry'
import type { Checkin, CreateCheckinInput } from '../schemas'
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
import { periodOf } from './checkin-flow-page'
import { SmartHistoryDetailView, SmartHistoryListView } from './smart-history-view'
import { SmartPartitionSearchLoader } from './smart-magic-stream'
import { SmartModuleDetector, SmartScannerLens, type SmartScannerSnapshot } from './smart-scanner'

/*
 * 全局智能识别与历史记录页（/checkin/smart · 方案 A 唯一核心复用）：
 * 1. 待扫描 / 扫描进行中（idle / scanning）：
 *    - 展示统一的 SmartScannerLens（网页端直接拉系统多选文件管理器，安卓端走流式缩略图相册或原生高清相机）+ 备注框 + 分区搜索动画；
 * 2. 识别完成后（done / manual）：
 *    - 顶部保留一行 SmartModuleDetector 5 板块切换胶囊条（防误判秒切）+ 同板块多目标切换；
 *    - 下方原地直接挂载与 /goals/[goalId]/checkin 100% 同源的 <CheckinFlow>！
 *      完整复用对应打卡板块的折叠表单、今日已打记录回填、FolderCard 分析报告折页、团团流式裁判抽屉与庆祝盖章弹窗。
 * 3. 历史记录列表与只读详情（history / history-detail）：只读回看历史识别快照。
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
  const router = useRouter()
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
  const [smartSnapshot, setSmartSnapshot] = useState<{
    result: SmartRecognitionResult
    preview?: SmartScannerSnapshot | null
  } | null>(null)
  const [confirmedCurrent, setConfirmedCurrent] = useState(false)
  const [scanNote, setScanNote] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)

  const subPageBackRef = useRef<(() => boolean) | null>(null)
  const registerSubPageBack = useCallback((handler: () => boolean) => {
    subPageBackRef.current = handler
    return () => {
      if (subPageBackRef.current === handler) {
        subPageBackRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (initialRecordId && getSmartHistoryRecord(initialRecordId)) {
      setSmartPageViewMode('history-detail')
    } else {
      setSmartPageViewMode(initialView)
    }
  }, [initialView, initialRecordId])

  // 顶栏返回键拦截：先响应 CheckinFlow 内部二级页（达标规则/评判依据/完整报告），其次响应历史只读详情返回列表
  useEffect(() => {
    return registerSmartBackHandler(() => {
      if (getSmartPageViewMode() === 'scanner' && subPageBackRef.current?.()) {
        return true
      }
      if (getSmartPageViewMode() === 'history-detail') {
        setSmartPageViewMode('history')
        return true
      }
      return false
    })
  }, [])

  const shouldGuardExit = Boolean(
    viewMode === 'scanner' && scanPhase === 'done' && smartSnapshot && !confirmedCurrent,
  )

  useEffect(() => {
    setUnconfirmedSmartRecord(shouldGuardExit)
    return () => {
      setUnconfirmedSmartRecord(false)
    }
  }, [shouldGuardExit])

  const allGoals = goals.data?.items ?? []
  const moduleGoals = allGoals.filter((g) => g.module === selectedModule)
  const activeGoalBrief = moduleGoals.find((g) => g.id === selectedGoalId) ?? moduleGoals[0] ?? null
  const localDate = today.data?.localDate ?? ''
  const showWorkspace =
    viewMode === 'scanner' && (scanPhase === 'done' || scanPhase === 'manual') && activeGoalBrief

  const goalDetail = useQuery({
    ...checkinGoalQuery(activeGoalBrief?.id ?? ''),
    enabled: Boolean(showWorkspace && activeGoalBrief?.id),
  })
  const dayCheckins = useQuery({
    ...checkinDayQuery(activeGoalBrief?.id ?? '', localDate),
    enabled: Boolean(showWorkspace && activeGoalBrief?.id && localDate),
  })

  if (goals.isPending || today.isPending || me.isPending) {
    return <SmartCheckinSkeleton />
  }

  const error = goals.error ?? today.error ?? me.error
  if (error || !goals.data || !today.data || !me.data) {
    return (
      <div className="px-4 pt-6">
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
      </div>
    )
  }

  const timeZone = me.data.profile.timeZone ?? BUSINESS_TIME_ZONE
  const viewingHistoryRecord = viewingHistoryId
    ? (historyRecords.find((r) => r.id === viewingHistoryId) ?? null)
    : null

  function handleRecognized(
    res: SmartRecognitionResult,
    savedRecord: SmartHistoryRecord,
    preview?: SmartScannerSnapshot,
  ) {
    setViewingHistoryId(null)
    setActiveMode(savedRecord.mode)
    setSmartSnapshot({ result: res, preview })
    setSelectedModule(res.draft.detectedModule)
    setSelectedGoalId(res.draft.matchedGoalId)
    setConfirmedCurrent(false)
    setScanPhase('done')
  }

  // 1. 历史记录只读详情视图
  if (viewMode === 'history-detail' && viewingHistoryRecord) {
    return (
      <SmartHistoryDetailView
        record={viewingHistoryRecord}
        timeZone={timeZone}
        onBackToList={() => setSmartPageViewMode('history')}
      />
    )
  }

  // 2. 历史记录单页列表视图
  if (viewMode === 'history' || (viewMode === 'history-detail' && !viewingHistoryRecord)) {
    return (
      <SmartHistoryListView
        records={historyRecords}
        activeRecordId={viewingHistoryId}
        timeZone={timeZone}
        onSelectRecord={(record) => {
          setViewingHistoryId(record.id)
          setSmartPageViewMode('history-detail')
        }}
        onDeleteRecord={(id) => {
          deleteSmartHistoryRecord(id)
          if (viewingHistoryId === id) {
            setViewingHistoryId(null)
          }
          toast.success('已删除历史拍摄记录')
        }}
        onStartNewScan={(file, mode, files) => {
          setViewingHistoryId(null)
          setActiveMode(mode)
          setConfirmedCurrent(false)
          setSmartSnapshot(null)
          setScanPhase('scanning')
          setPendingSmartCapture({ file, files, mode })
          setSmartPageViewMode('scanner')
        }}
      />
    )
  }

  const switcherSlot = (
    <div className="flex flex-col gap-2">
      <SmartModuleDetector
        selectedModule={selectedModule}
        onSelectModule={(m) => {
          setSelectedModule(m)
          setSelectedGoalId(null)
        }}
      />
      {moduleGoals.length > 1 && activeGoalBrief && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="选择具体目标">
          {moduleGoals.map((g) => {
            const isSelected = g.id === activeGoalBrief.id
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
    </div>
  )

  // 3. 识别完成后（方案 A）：原地直接挂载对应板块的唯一核心引擎 CheckinFlow
  if (scanPhase === 'done' || scanPhase === 'manual') {
    if (!activeGoalBrief) {
      return (
        <div className="mx-auto flex w-full max-w-lg min-w-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pt-2 pb-8">
          {switcherSlot}
          <Card className="animate-fade-up w-full min-w-0 overflow-hidden p-4">
            <EmptyState
              size="compact"
              title={`还没有「${moduleMeta[selectedModule].label}」板块的目标`}
              description="先创建一个该板块的小目标，就能把识别结果记进去啦"
              action={<GoalLinkButton href="/goals/new">去新建目标</GoalLinkButton>}
            />
          </Card>
        </div>
      )
    }

    if (goalDetail.isPending || dayCheckins.isPending || !goalDetail.data) {
      return (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 pt-2">
          {switcherSlot}
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      )
    }

    const g = goalDetail.data
    const def = moduleDef(g.module)
    const clock = {
      timeZone: me.data.profile.timeZone,
      dayStartHour: 0,
    }

    async function handleConfirmCheckin(input: CreateCheckinInput): Promise<Checkin> {
      try {
        const result = await create.mutateAsync({
          goalId: g.id,
          input,
          idempotencyKey: newIdempotencyKey(),
        })
        if (smartSnapshot?.result) {
          markSmartHistoryConfirmed(smartSnapshot.result.aiRunId, g.title)
        }
        setConfirmedCurrent(true)
        setUnconfirmedSmartRecord(false)
        return result.checkin
      } catch (e) {
        if (isApiError(e) && e.fields) {
          const first = Object.values(e.fields).flat().find(Boolean)
          toast.error(first ?? errorMessage(e))
        } else {
          toast.error(isApiError(e) ? errorMessage(e) : '出了点小状况，稍后再试试')
        }
        throw e
      }
    }

    return (
      <CheckinFlow
        key={`${g.id}:${smartSnapshot?.result.aiRunId ?? 'manual'}`}
        def={def}
        goal={g}
        clock={clock}
        today={today.data.localDate}
        todayCheckins={dayCheckins.data?.items ?? []}
        tier={me.data.preferences.refereeTier}
        period={periodOf(g.validDays, g.createdAt.slice(0, 10), g.deadlineDate)}
        initialMode={scanPhase === 'manual' ? 'manual' : activeMode}
        hidePageBar
        topSlot={switcherSlot}
        initialSmart={smartSnapshot}
        onSmartRecognized={handleRecognized}
        registerSubPageBack={registerSubPageBack}
        onConfirm={handleConfirmCheckin}
        onBack={() => (window.history.length > 1 ? router.back() : router.push('/'))}
      />
    )
  }

  // 4. 待扫描 / 扫描中初始态
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4">
      <div className="mx-auto flex w-full max-w-lg min-w-0 flex-col gap-2.5 pt-1.5 pb-8">
        <SmartScannerLens
          mode={activeMode}
          tone={selectedModule}
          note={scanNote}
          onScanStart={(nextMode) => {
            setViewingHistoryId(null)
            setActiveMode(nextMode)
            setSmartSnapshot(null)
            setConfirmedCurrent(false)
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

        <FillSection
          spec={{
            id: 'note',
            label: '备注',
            icon: 'pen',
            filled: scanNote.trim().length > 0,
            summary: scanNote.trim() || '可选：例如「晚上没吃饭只吃菜」「空腹」',
            content: (
              <Input
                aria-label="备注"
                value={scanNote}
                maxLength={200}
                placeholder="例如：晚上没吃饭只吃菜、空腹、外卖少油"
                onChange={(e) => setScanNote(e.target.value)}
              />
            ),
          }}
          tone={selectedModule}
          open={noteOpen}
          ai={false}
          onToggle={() => setNoteOpen((v) => !v)}
        />

        {scanPhase === 'scanning' && <SmartPartitionSearchLoader />}
      </div>
    </div>
  )
}

function SmartCheckinSkeleton() {
  return (
    <div
      role="status"
      aria-label="加载中"
      className="mx-auto flex w-full max-w-lg min-w-0 flex-col gap-2.5 px-4 pt-2"
    >
      <Skeleton className="h-52 w-full rounded-2xl" />
    </div>
  )
}
