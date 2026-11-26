'use client'

import dynamic from 'next/dynamic'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Icon } from '@/components/ui/icon'
import { ProgressRing } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { moduleMeta, softToneClass } from '@/components/ui/tone'
import { LinkButton } from '@/features/dashboard/components/link-button'
import type { OverallProgress } from '@/features/dashboard/schemas'
import { computeOverallPeriod } from '@/features/goal/period'
import type { Goal } from '@/features/goal/schemas'
import type { Me, RemindMode } from '@/features/me/schemas'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { dashboardTodayQuery } from '@/lib/api/queries/dashboard'
import { goalListQuery } from '@/lib/api/queries/goals'
import { useMe } from '@/lib/api/queries/me'
import { cn } from '@/lib/cn'
import { localDateOf } from '@/lib/time'
import { GoalModuleCard } from './goal-module-card'
import type { GoalSettingsFooterMode, GoalSettingsSheetView } from './goal-settings-sheet'

/*
 * 「我的 → 目标设置」（/goals）：全局唯一的目标设置入口（checkin-modules.md 第 5 节，Issue #103）。
 * - 一屏紧凑布局：移除独立板块选择大卡，将「要坚持的打卡板块」与「时间周期设置」统一收口进右侧「设置」Dock；
 * - 轮播上方升级为单行 36px 紧凑目标胶囊条，支持含多个自定义小目标在内的任意目标一键直达；
 * - 「新建自定义小目标」与「已归档的目标」按严格互补视口断点自动排版：空间充裕放页面底部，紧凑屏自动归入设置 Dock。
 */

export type GoalSettingsTab = 'plan' | 'schedule' | 'rules'

const GoalSettingsSheet = dynamic(
  () => import('./goal-settings-sheet').then((m) => m.GoalSettingsSheet),
  { loading: () => null },
)

export function GoalSettingsView({ initialTab = 'plan' }: { initialTab?: GoalSettingsTab }) {
  const active = useQuery(goalListQuery('active'))
  const archived = useQuery(goalListQuery('archived'))
  const me = useMe()
  const dashboard = useQuery(dashboardTodayQuery())

  if (active.isPending || archived.isPending || me.isPending) return <SettingsSkeleton />
  if (active.isError || archived.isError || me.isError || !me.data) {
    const e = active.error ?? archived.error ?? me.error
    return (
      <ErrorState
        title="目标设置没加载出来"
        message={isApiError(e) ? errorMessage(e) : undefined}
        onRetry={() => {
          void active.refetch()
          void archived.refetch()
          void me.refetch()
        }}
      />
    )
  }

  return (
    <GoalSettingsContent
      active={active.data.items}
      archived={archived.data.items}
      me={me.data}
      today={dashboard.data?.localDate}
      overall={dashboard.data?.overall}
      initialTab={initialTab}
    />
  )
}

export function GoalSettingsContent({
  active: activeGoals,
  archived: archivedGoals,
  me,
  today: todayOverride,
  overall: overallOverride,
  initialTab = 'plan',
  footerMode = 'auto',
}: {
  active: Goal[]
  archived: Goal[]
  me: Pick<Me, 'profile' | 'preferences'>
  today?: string
  overall?: OverallProgress
  initialTab?: GoalSettingsTab
  /** Playbook 预览可显式指定 inline / dock 验收双态，正式页面默认 auto 按视口互补切换 */
  footerMode?: GoalSettingsFooterMode
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetLoaded, setSheetLoaded] = useState(false)
  const [sheetView, setSheetView] = useState<GoalSettingsSheetView>('menu')
  const [activeIndex, setActiveIndex] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  const timeZone = me.profile.timeZone
  const dayStartHour = me.preferences.dayStartHour ?? 4
  const today = todayOverride ?? localDateOf(new Date(), timeZone, dayStartHour)

  let earliestStart = today
  if (activeGoals.length > 0) {
    earliestStart = activeGoals.reduce(
      (min, g) => {
        const d = localDateOf(g.createdAt, timeZone, dayStartHour)
        return d < min ? d : min
      },
      localDateOf(activeGoals[0]!.createdAt, timeZone, dayStartHour),
    )
  }

  const overall =
    overallOverride ??
    computeOverallPeriod({
      checkedDays: 0,
      startDate: activeGoals.length > 0 ? earliestStart : null,
      deadlineDates: activeGoals.map((g) => g.deadlineDate),
    })

  const clampedIndex = Math.min(activeIndex, Math.max(0, activeGoals.length - 1))

  function scrollToCard(index: number) {
    const safeIdx = Math.max(0, Math.min(index, activeGoals.length - 1))
    setActiveIndex(safeIdx)
    const el = carouselRef.current
    const child = el?.children.item(safeIdx) as HTMLElement | null
    if (el && child) {
      el.scrollTo({
        left: child.offsetLeft - el.offsetLeft - 16,
        behavior: 'smooth',
      })
    }
  }

  function handleCarouselScroll() {
    const el = carouselRef.current
    if (!el || activeGoals.length <= 1) return
    const center = el.scrollLeft + el.clientWidth / 2
    let bestIdx = 0
    let bestDist = Number.POSITIVE_INFINITY
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children.item(i) as HTMLElement | null
      if (!child) continue
      const childCenter = child.offsetLeft - el.offsetLeft + child.clientWidth / 2
      const dist = Math.abs(childCenter - center)
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = i
      }
    }
    if (bestIdx !== clampedIndex) setActiveIndex(bestIdx)
  }

  function openSettingsSheet(view: GoalSettingsSheetView = 'menu') {
    setSheetView(view)
    setSheetLoaded(true)
    setSheetOpen(true)
  }

  const inlineFooterClass =
    footerMode === 'inline' ? 'flex' : footerMode === 'dock' ? 'hidden' : 'goals-footer-inline'

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 pb-2">
      {/* 顶部总览卡：双行清晰排布 + 右侧 44px 触控区「设置」按钮唤起统一设置 Dock */}
      <SettingsOverviewCard
        activeCount={activeGoals.length}
        checkedDays={overall.checkedDays}
        targetDays={overall.targetDays}
        hasDeadline={overall.hasDeadline}
        deadlineDate={overall.deadlineDate}
        remindAt={me.preferences.remindAt}
        remindMode={me.preferences.remindMode}
        onOpenSettings={() => openSettingsSheet('menu')}
      />

      {/* 下方可左右滑动翻页的板块卡片轮播（单行 36px 目标胶囊直达每一张卡） */}
      {activeGoals.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            title="还没有进行中的打卡板块"
            description="点下方按钮选一两个想坚持的小事，就能在这里调整目标与达标规则"
            action={
              <Button icon="plus" onClick={() => openSettingsSheet('modules')}>
                选择打卡板块
              </Button>
            }
          />
        </Card>
      ) : (
        <section className="flex flex-col gap-2" aria-label="板块目标与规则卡片">
          <div className="flex h-9 items-center gap-2">
            <div
              role="tablist"
              aria-label="切换目标卡片"
              className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto py-0.5"
            >
              {activeGoals.map((g, idx) => {
                const selected = idx === clampedIndex
                return (
                  <button
                    key={g.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => scrollToCard(idx)}
                    className={cn(
                      'ease-spring text-tiny inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 font-semibold whitespace-nowrap transition-[transform,background-color,border-color,color] duration-(--dur-fast) active:scale-95',
                      selected
                        ? cn(softToneClass[g.module], 'border-primary/40 shadow-xs')
                        : 'border-border bg-surface text-muted hover:text-foreground',
                    )}
                  >
                    <Icon name={moduleMeta[g.module].icon} size={13} />
                    <span className="max-w-[7.5rem] truncate">{g.title}</span>
                  </button>
                )
              })}
            </div>

            {activeGoals.length > 1 && (
              <div className="hidden shrink-0 items-center gap-1 sm:flex">
                <button
                  type="button"
                  aria-label="上一个板块"
                  disabled={clampedIndex <= 0}
                  onClick={() => scrollToCard(clampedIndex - 1)}
                  className="text-muted hover:bg-surface-sunken inline-flex size-7 items-center justify-center rounded-full disabled:opacity-35"
                >
                  <Icon name="chevron-left" size={16} lineOnly />
                </button>
                <span className="font-display text-tiny text-muted tabular-nums">
                  {clampedIndex + 1} / {activeGoals.length}
                </span>
                <button
                  type="button"
                  aria-label="下一个板块"
                  disabled={clampedIndex >= activeGoals.length - 1}
                  onClick={() => scrollToCard(clampedIndex + 1)}
                  className="text-muted hover:bg-surface-sunken inline-flex size-7 items-center justify-center rounded-full disabled:opacity-35"
                >
                  <Icon name="chevron-right" size={16} lineOnly />
                </button>
              </div>
            )}
          </div>

          <div
            ref={carouselRef}
            data-goal-carousel="true"
            onScroll={handleCarouselScroll}
            className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 md:mx-0 md:px-0"
          >
            {activeGoals.map((g) => (
              <div
                key={`${g.id}-${g.updatedAt}`}
                className={cn(
                  'shrink-0 snap-center',
                  activeGoals.length > 1
                    ? 'w-[calc(100%-1.5rem)] sm:w-[calc(100%-2.5rem)]'
                    : 'w-full',
                )}
              >
                <GoalModuleCard
                  goal={g}
                  today={today}
                  tier={me.preferences.refereeTier}
                  defaultRulesOpen={initialTab === 'rules'}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 宽裕视口放页面底部；紧凑视口隐藏并由 GoalSettingsSheet 的「更多目标管理」互补承接 */}
      <div
        data-goals-inline-links="true"
        className={cn(inlineFooterClass, 'flex-wrap justify-center gap-2 pt-0.5')}
      >
        <LinkButton href="/goals/new?module=custom" variant="soft" icon="plus" size="sm">
          新建自定义小目标
        </LinkButton>
        <LinkButton href="/goals?status=archived" variant="soft" icon="clock" size="sm">
          {archivedGoals.length > 0 ? `已归档的目标（${archivedGoals.length}）` : '已归档的目标'}
        </LinkButton>
      </div>

      {sheetLoaded && (
        <GoalSettingsSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          initialView={sheetView}
          footerMode={footerMode}
          active={activeGoals}
          archived={archivedGoals}
          startDate={earliestStart}
          today={today}
          hasDeadline={overall.hasDeadline}
          targetDays={overall.targetDays}
          initialDeadline={overall.deadlineDate ?? ''}
          initialRemindAt={me.preferences.remindAt ?? ''}
          initialRemindMode={me.preferences.remindMode}
        />
      )}
    </div>
  )
}

function SettingsOverviewCard({
  activeCount,
  checkedDays,
  targetDays,
  hasDeadline,
  deadlineDate,
  remindAt,
  remindMode,
  onOpenSettings,
}: {
  activeCount: number
  checkedDays: number
  targetDays: number
  hasDeadline: boolean
  deadlineDate: string | null
  remindAt: string | null
  remindMode: RemindMode
  onOpenSettings: () => void
}) {
  const remindPart = remindMode !== 'off' && remindAt ? `提醒 ${remindAt}` : '提醒未开'

  return (
    <Card variant="sticker" className="flex items-center gap-3 p-3.5 md:p-3.5">
      <ProgressRing
        value={checkedDays}
        max={Math.max(1, targetDays)}
        tone="success"
        size={48}
        thickness={5}
        label={`总坚持进度：${checkedDays} / ${targetDays} 天`}
        className="shrink-0"
      >
        <span className="flex flex-col items-center leading-none tabular-nums">
          <span className="font-display text-caption font-bold">{checkedDays}</span>
          <span className="text-tiny text-muted">/{targetDays}</span>
        </span>
      </ProgressRing>

      {/* 严格两行清晰展示：第 1 行板块与周期，第 2 行截止日期与提醒 */}
      <div className="min-w-0 flex-1">
        <p className="text-caption truncate font-bold tabular-nums">
          {activeCount} 个板块 · {hasDeadline ? `共 ${targetDays} 天` : `里程碑 ${targetDays} 天`}
        </p>
        <p className="text-tiny text-muted mt-0.5 truncate tabular-nums">
          {hasDeadline && deadlineDate ? `截止 ${deadlineDate}` : '未设截止日'} · {remindPart}
        </p>
      </div>

      <Button
        variant="soft"
        size="sm"
        icon="sliders"
        data-open-settings-sheet="true"
        onClick={onOpenSettings}
        className="min-h-11 shrink-0 rounded-full"
      >
        设置
      </Button>
    </Card>
  )
}

function SettingsSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="mx-auto grid w-full max-w-2xl gap-3">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-9 w-full rounded-full" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  )
}
