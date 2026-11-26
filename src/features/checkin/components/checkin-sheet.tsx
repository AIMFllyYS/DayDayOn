'use client'

import { useRouter } from 'next/navigation'
import { IconButton } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { checkinTodayQuery } from '@/lib/api/queries/checkins'
import type { CheckinToday } from '../schemas'
import { useCheckinLauncher, type CheckinLauncherView } from '../launcher-store'
import { setSmartPageViewMode } from '../smart-handoff'
import {
  CheckinSheetList,
  FirstCheckinCard,
  type CheckinSheetListProps,
} from './checkin-sheet-list'
import { MoodPanel } from './mood-panel'
import { SmartActionBar } from './smart-action-bar'
import { StepsPanel } from './steps-panel'
import { WeightPanel } from './weight-panel'

/*
 * 打卡弹层（PRD 2.4、7.2，原型 Playbook _components/checkin-sheet.tsx）。
 * 列表 / 体重 / 心情 / 步数在同一个弹层里切换内容（不开第二层弹层），视图由 launcher-store 决定。
 * 三个指标 Dock 统一不显示底部「返回打卡列表」，点击空白处或下拉即可收起；右上角时钟直达对应详情页。
 * 挂载点（checkin-launcher.tsx，F3）第一次打开时才懒加载本文件。
 */

export interface CheckinSheetProps {
  open: boolean
  view: CheckinLauncherView
  onOpenChange: (open: boolean) => void
}

const titles: Record<CheckinLauncherView, string> = {
  list: '记录点什么？',
  weight: '记体重',
  mood: '今日心情',
  steps: '今日步数',
}

const clockMeta: Record<CheckinLauncherView, { label: string; href: string }> = {
  list: { label: '历史拍摄记录', href: '/checkin/smart?view=history' },
  weight: { label: '体重统计与记录', href: '/metrics/weight' },
  mood: { label: '心情统计与记录', href: '/metrics/mood' },
  steps: { label: '步数统计与记录', href: '/metrics/steps' },
}

export function CheckinSheet({ open, view, onOpenChange }: CheckinSheetProps) {
  const router = useRouter()
  const launcher = useCheckinLauncher()
  const today = useQuery({ ...checkinTodayQuery(), enabled: open })
  const data = today.data
  const close = () => onOpenChange(false)

  const description =
    view === 'list' && data
      ? `今天完成了 ${data.completion.done} / ${data.completion.planned} 个目标`
      : view === 'weight'
        ? '每天一条，再记就覆盖'
        : view === 'mood'
          ? '今天整体感觉怎么样？'
          : view === 'steps'
            ? '支持同步手机计步或手动记录今日步数'
            : undefined

  const footer = view === 'list' ? <SmartActionBar onNavigate={close} /> : undefined
  const clock = clockMeta[view]

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={titles[view]}
      description={description}
      headerActions={
        <IconButton
          icon="clock"
          label={clock.label}
          onClick={() => {
            close()
            if (view === 'list') setSmartPageViewMode('history')
            router.push(clock.href)
          }}
        />
      }
      footer={footer}
    >
      <SheetBody
        open={open}
        view={view}
        state={today}
        onNavigate={close}
        onOpenView={(v) => launcher.open(v)}
      />
    </Sheet>
  )
}

interface QueryState {
  data: CheckinToday | undefined
  isPending: boolean
  isError: boolean
  error: unknown
  isRefetching: boolean
  refetch: () => unknown
}

function SheetBody({
  open,
  view,
  state,
  onNavigate,
  onOpenView,
}: {
  open: boolean
  view: CheckinLauncherView
  state: QueryState
  onNavigate: () => void
  onOpenView: CheckinSheetListProps['onOpenView']
}) {
  if (state.isPending) return <SheetSkeleton />
  if (state.isError || !state.data) {
    return (
      <ErrorState
        size="compact"
        title="今天的打卡没加载出来"
        message={isApiError(state.error) ? errorMessage(state.error) : undefined}
        onRetry={() => void state.refetch()}
        retrying={state.isRefetching}
      />
    )
  }
  const data = state.data
  if (view === 'weight') {
    return <WeightPanel open={open} localDate={data.localDate} currentGrams={data.weightGrams} />
  }
  if (view === 'mood') {
    return <MoodPanel open={open} localDate={data.localDate} value={data.mood} />
  }
  if (view === 'steps') {
    return <StepsPanel open={open} localDate={data.localDate} currentSteps={data.steps ?? null} />
  }
  if (data.goals.length === 0 && data.completion.planned === 0) {
    return (
      <div className="flex flex-col gap-3">
        <FirstCheckinCard onNavigate={onNavigate} />
        <CheckinSheetList data={data} onNavigate={onNavigate} onOpenView={onOpenView} metricsOnly />
      </div>
    )
  }
  return <CheckinSheetList data={data} onNavigate={onNavigate} onOpenView={onOpenView} />
}

function SheetSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="flex flex-col gap-3">
      <Skeleton className="h-1.5 w-full rounded-full" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-1">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      ))}
    </div>
  )
}
