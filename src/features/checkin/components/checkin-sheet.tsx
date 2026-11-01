'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { checkinTodayQuery } from '@/lib/api/queries/checkins'
import type { CheckinToday } from '../schemas'
import { useCheckinLauncher, type CheckinLauncherView } from '../launcher-store'
import { CheckinSheetList, type CheckinSheetListProps } from './checkin-sheet-list'
import { MoodPanel } from './mood-panel'
import { WeightPanel } from './weight-panel'

/*
 * 打卡弹层（PRD 2.4、7.2，原型 Playbook _components/checkin-sheet.tsx）。
 * 列表 / 体重 / 心情在同一个弹层里切换内容（不开第二层弹层），视图由 launcher-store 决定。
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
}

export function CheckinSheet({ open, view, onOpenChange }: CheckinSheetProps) {
  const launcher = useCheckinLauncher()
  const router = useRouter()
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
          : undefined

  const footer =
    view === 'list' && data?.dietPhotoGoalId ? (
      <Button
        variant="soft"
        icon="camera"
        className="w-full"
        onClick={() => {
          close()
          router.push(`/goals/${data.dietPhotoGoalId}/checkin?mode=photo`)
        }}
      >
        拍照记一餐
      </Button>
    ) : view !== 'list' ? (
      <Button
        variant="ghost"
        icon="chevron-left"
        className="w-full"
        onClick={() => launcher.open('list')}
      >
        返回打卡列表
      </Button>
    ) : undefined

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={titles[view]}
      description={description}
      footer={footer}
    >
      <SheetBody
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
  view,
  state,
  onNavigate,
  onOpenView,
}: {
  view: CheckinLauncherView
  state: QueryState
  onNavigate: () => void
  onOpenView: CheckinSheetListProps['onOpenView']
}) {
  const launcher = useCheckinLauncher()
  const router = useRouter()
  // 记完体重 / 心情后回到列表
  const back = () => launcher.open('list')

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
  if (view === 'weight') return <WeightPanel currentGrams={data.weightGrams} onSaved={back} />
  if (view === 'mood') return <MoodPanel value={data.mood} onSaved={back} />
  if (data.goals.length === 0 && data.completion.planned === 0) {
    return (
      <div className="flex flex-col gap-3">
        <EmptyState
          size="compact"
          title="今天没有计划的目标"
          description="设定一个小目标，每天来这里打卡"
          action={
            <Button
              variant="soft"
              onClick={() => {
                onNavigate()
                router.push('/goals/new')
              }}
            >
              去设定目标
            </Button>
          }
        />
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
