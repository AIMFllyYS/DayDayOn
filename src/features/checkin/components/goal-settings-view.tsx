'use client'

import dynamic from 'next/dynamic'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapse } from '@/components/ui/collapse'
import { ErrorState } from '@/components/ui/error-state'
import { Icon } from '@/components/ui/icon'
import { ProgressRing } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { moduleMeta, softToneClass } from '@/components/ui/tone'
import { LinkButton } from '@/features/dashboard/components/link-button'
import type { OverallProgress } from '@/features/dashboard/schemas'
import { DEFAULT_GOALS } from '@/features/goal/defaults'
import { computeOverallPeriod } from '@/features/goal/period'
import type { Goal } from '@/features/goal/schemas'
import type { Me, RemindMode } from '@/features/me/schemas'
import { ModulesStep } from '@/features/onboarding/components/onboarding-steps'
import { MODULES, type Module } from '@/features/shared/schemas'
import {
  apiFetch,
  errorMessage,
  isApiError,
  newIdempotencyKey,
  useQuery,
  useQueryClient,
} from '@/lib/api'
import { afterCheckinChange, keys } from '@/lib/api/keys'
import { dashboardTodayQuery } from '@/lib/api/queries/dashboard'
import { goalListQuery } from '@/lib/api/queries/goals'
import { useMe } from '@/lib/api/queries/me'
import { cn } from '@/lib/cn'
import { localDateOf } from '@/lib/time'
import { GoalModuleCard } from './goal-module-card'

/*
 * 「我的 → 目标设置」（/goals）：全局唯一的目标设置入口（checkin-modules.md 第 5 节）。
 * - 顶部总览卡：双行清晰展示板块数/周期与截止日/提醒，右侧「设置」按钮唤起底部「周期与提醒」Sheet；
 * - 移除繁杂的顶部分类 Tab 栏，默认上方展示「要坚持的打卡板块」选择条（支持一键定位卡片与增减板块）；
 * - 下方为可左右滑动翻页的板块卡片轮播，每张卡片完整承载该板块的「目标与计划」与「达标规则」折叠面板。
 */

export type GoalSettingsTab = 'plan' | 'schedule' | 'rules'

const GoalPeriodSheet = dynamic(
  () => import('./goal-period-sheet').then((m) => m.GoalPeriodSheet),
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
}: {
  active: Goal[]
  archived: Goal[]
  me: Pick<Me, 'profile' | 'preferences'>
  today?: string
  overall?: OverallProgress
  initialTab?: GoalSettingsTab
}) {
  const [periodSheetOpen, setPeriodSheetOpen] = useState(false)
  const [periodSheetLoaded, setPeriodSheetLoaded] = useState(false)
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
  const focusedModule = activeGoals[clampedIndex]?.module ?? null

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

  function openPeriodSheet() {
    setPeriodSheetLoaded(true)
    setPeriodSheetOpen(true)
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3.5 pb-10">
      {/* 顶部总览卡：双行清晰排布 + 右侧「设置」按钮弹出底部周期与提醒 Sheet */}
      <SettingsOverviewCard
        activeCount={activeGoals.length}
        checkedDays={overall.checkedDays}
        targetDays={overall.targetDays}
        hasDeadline={overall.hasDeadline}
        deadlineDate={overall.deadlineDate}
        remindAt={me.preferences.remindAt}
        remindMode={me.preferences.remindMode}
        onOpenPeriodSettings={openPeriodSheet}
      />

      {/* 要坚持的打卡板块选择条：点已选板块直接定位下方卡片，点「增减板块」展开勾选项 */}
      <ModuleSelectorStrip
        active={activeGoals}
        archived={archivedGoals}
        focusedModule={focusedModule}
        onFocusModule={(mod) => {
          const idx = activeGoals.findIndex((g) => g.module === mod)
          if (idx >= 0) scrollToCard(idx)
        }}
      />

      {/* 下方可左右滑动翻页的板块卡片轮播（每张卡完整含目标计划与达标规则） */}
      {activeGoals.length === 0 ? (
        <Card className="p-5 text-center">
          <p className="text-caption text-muted">先在上方选择至少一个要坚持的打卡板块吧</p>
        </Card>
      ) : (
        <section className="flex flex-col gap-2" aria-label="板块目标与规则卡片">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1.5">
              {activeGoals.map((g, idx) => (
                <button
                  key={g.id}
                  type="button"
                  aria-label={`切换到 ${g.title}`}
                  onClick={() => scrollToCard(idx)}
                  className={cn(
                    'h-2 rounded-full transition-all duration-(--dur-base)',
                    idx === clampedIndex ? 'bg-primary w-5' : 'bg-border-strong w-2',
                  )}
                />
              ))}
            </div>

            {activeGoals.length > 1 && (
              <div className="flex items-center gap-1">
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

      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <LinkButton href="/goals/new?module=custom" variant="soft" icon="plus" size="sm">
          新建自定义小目标
        </LinkButton>
        <LinkButton href="/goals?status=archived" variant="soft" icon="clock" size="sm">
          已归档的目标
        </LinkButton>
      </div>

      {periodSheetLoaded && (
        <GoalPeriodSheet
          open={periodSheetOpen}
          onOpenChange={setPeriodSheetOpen}
          active={activeGoals}
          startDate={earliestStart}
          today={today}
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
  onOpenPeriodSettings,
}: {
  activeCount: number
  checkedDays: number
  targetDays: number
  hasDeadline: boolean
  deadlineDate: string | null
  remindAt: string | null
  remindMode: RemindMode
  onOpenPeriodSettings: () => void
}) {
  const remindPart = remindMode !== 'off' && remindAt ? `提醒 ${remindAt}` : '提醒未开'

  return (
    <Card variant="sticker" className="flex items-center gap-3 p-3.5">
      <ProgressRing
        value={checkedDays}
        max={Math.max(1, targetDays)}
        tone="success"
        size={52}
        thickness={5.5}
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

      <button
        type="button"
        data-open-period-sheet="true"
        onClick={onOpenPeriodSettings}
        className="ease-spring bg-primary-soft text-primary-ink text-tiny inline-flex h-8.5 shrink-0 items-center gap-1 rounded-full px-3 font-semibold transition-[transform,filter] duration-(--dur-fast) hover:brightness-95 active:scale-95"
      >
        <Icon name="sliders" size={14} lineOnly />
        <span>设置</span>
      </button>
    </Card>
  )
}

/** 要坚持的打卡板块选择条：快速点击切换下方卡片，点「增减板块」展开增删勾选 */
function ModuleSelectorStrip({
  active,
  archived,
  focusedModule,
  onFocusModule,
}: {
  active: Goal[]
  archived: Goal[]
  focusedModule: Module | null
  onFocusModule: (module: Module) => void
}) {
  const qc = useQueryClient()
  const activeModules = [...new Set(active.map((g) => g.module))]
  const [selected, setSelected] = useState<Module[]>(activeModules)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const dirty =
    selected.length !== activeModules.length || selected.some((m) => !activeModules.includes(m))

  async function save() {
    if (selected.length === 0) {
      setError('至少保留一个打卡板块')
      return
    }
    setSaving(true)
    setError(undefined)
    const want = new Set(selected)
    const sharedDeadline = active.find((g) => g.deadlineDate)?.deadlineDate ?? null
    const tasks: Promise<unknown>[] = []
    for (const g of active) {
      if (!want.has(g.module)) {
        tasks.push(
          apiFetch(`/goals/${encodeURIComponent(g.id)}`, {
            method: 'PATCH',
            json: { status: 'archived' },
          }),
        )
      }
    }
    for (const m of selected) {
      if (activeModules.includes(m)) continue
      const old = archived.find((g) => g.module === m)
      tasks.push(
        old
          ? apiFetch(`/goals/${encodeURIComponent(old.id)}`, {
              method: 'PATCH',
              json: { status: 'active' },
            })
          : apiFetch('/goals', {
              method: 'POST',
              json: {
                ...DEFAULT_GOALS[m],
                ...(sharedDeadline ? { deadlineDate: sharedDeadline } : {}),
              },
              idempotencyKey: newIdempotencyKey(),
            }),
      )
    }
    try {
      await Promise.all(tasks)
      toast.success('打卡板块已更新')
      setEditOpen(false)
    } catch (e) {
      toast.error(isApiError(e) ? errorMessage(e) : '有一项没保存成功，刷新后再试试')
    } finally {
      void qc.invalidateQueries({ queryKey: keys.goals.all })
      for (const k of afterCheckinChange) void qc.invalidateQueries({ queryKey: k })
      setSaving(false)
    }
  }

  return (
    <Card className="flex flex-col gap-2.5 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-caption font-bold">要坚持的打卡板块</h2>
        <button
          type="button"
          aria-expanded={editOpen}
          onClick={() => {
            setSelected(activeModules)
            setError(undefined)
            setEditOpen((o) => !o)
          }}
          className="text-tiny text-primary-ink hover:bg-primary-soft/60 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold transition-colors"
        >
          <span>{editOpen ? '收起' : '增减板块'}</span>
          <Icon
            name="chevron-down"
            size={13}
            className={cn('transition-transform duration-(--dur-base)', editOpen && 'rotate-180')}
            lineOnly
          />
        </button>
      </div>

      {/* 5 个板块紧凑快选条：已启用板块点击直接定位下方对应卡片 */}
      <div className="grid grid-cols-5 gap-1.5">
        {MODULES.map((m) => {
          const isActive = activeModules.includes(m)
          const isFocused = isActive && focusedModule === m
          return (
            <button
              key={m}
              type="button"
              onClick={() => {
                if (isActive) {
                  onFocusModule(m)
                } else {
                  setSelected((prev) => (prev.includes(m) ? prev : [...prev, m]))
                  setEditOpen(true)
                }
              }}
              className={cn(
                'ease-spring flex flex-col items-center justify-center gap-1 rounded-xl border py-2 transition-[transform,background-color,border-color,box-shadow] duration-(--dur-fast) active:scale-95',
                isActive
                  ? cn(
                      softToneClass[m],
                      isFocused
                        ? 'border-primary ring-primary/35 shadow-soft ring-2'
                        : 'border-transparent opacity-80 hover:opacity-100',
                    )
                  : 'border-border bg-surface-sunken/50 text-subtle hover:text-muted border-dashed',
              )}
            >
              <Icon name={moduleMeta[m].icon} size={18} />
              <span className="text-tiny leading-none font-semibold">{moduleMeta[m].label}</span>
            </button>
          )
        })}
      </div>

      {/* 展开「增减板块」时完整支持勾选与归档恢复 */}
      <Collapse open={editOpen} unmountOnCollapse>
        <div className="border-border/70 flex flex-col gap-2.5 border-t pt-3">
          <ModulesStep value={selected} onChange={setSelected} error={error} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-tiny text-muted">取消勾选将归档，历史记录保留</span>
            {dirty && (
              <Button size="sm" loading={saving} onClick={() => void save()}>
                保存板块
              </Button>
            )}
          </div>
        </div>
      </Collapse>
    </Card>
  )
}

function SettingsSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="mx-auto grid w-full max-w-2xl gap-3">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  )
}
