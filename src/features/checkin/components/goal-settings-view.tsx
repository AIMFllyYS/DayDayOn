'use client'

import { useState } from 'react'
import { IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { ErrorState } from '@/components/ui/error-state'
import { Field } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { ProgressRing } from '@/components/ui/progress'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { TimeField } from '@/components/ui/time-field'
import { toast } from '@/components/ui/toast'
import { moduleMeta } from '@/components/ui/tone'
import { LinkButton } from '@/features/dashboard/components/link-button'
import { DEFAULT_GOALS } from '@/features/goal/defaults'
import { PeriodPlanPicker } from '@/features/goal/components/period-plan-picker'
import { TargetEditor, type TargetDraft } from '@/features/goal/components/target-editor'
import { WeekdayPicker } from '@/features/goal/components/weekday-picker'
import { computeOverallPeriod } from '@/features/goal/period'
import type { Goal } from '@/features/goal/schemas'
import type { Me, RemindMode } from '@/features/me/schemas'
import type { OverallProgress } from '@/features/dashboard/schemas'
import { ModulesStep } from '@/features/onboarding/components/onboarding-steps'
import { effectiveRules, isDefaultRules } from '@/features/referee/defaults'
import type { RefereeRules, RefereeTier } from '@/features/referee/schemas'
import type { Module } from '@/features/shared/schemas'
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
import { goalListQuery, useUpdateGoal } from '@/lib/api/queries/goals'
import { useMe, useUpdatePreferences } from '@/lib/api/queries/me'
import { cn } from '@/lib/cn'
import { formatDuration, localDateOf } from '@/lib/time'
import { Collapse } from '../flow/folder-card'
import { moduleDef } from '../modules/registry'
import { TierPicker } from '../modules/tier-picker'

/*
 * 「我的 → 目标设置」（/goals）：全局唯一的目标设置入口（checkin-modules.md 第 5 节）。
 * 分层组织为三个清晰页签，避免全部平铺在一个超长页面：
 *   1. plan     板块与总周期（与新人引导一致：打卡板块 + 总坚持天数/截止日期 + 每日总提醒）
 *   2. schedule 每日目标与计划（手风琴折叠：每个目标的每日目标量、每周几天、计划时间、独立期限）
 *   3. rules    达标与裁判规则（个人体质档位 + 各板块折叠规则面板）
 */

export type GoalSettingsTab = 'plan' | 'schedule' | 'rules'

const SETTINGS_TABS: ReadonlyArray<{ value: GoalSettingsTab; label: string }> = [
  { value: 'plan', label: '板块与周期' },
  { value: 'schedule', label: '目标与计划' },
  { value: 'rules', label: '达标规则' },
]

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
  const [tab, setTab] = useState<GoalSettingsTab>(initialTab)
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

  const periodResetKey = `${activeGoals.map((g) => `${g.id}:${g.deadlineDate ?? ''}`).join('|')}|${me.preferences.remindAt ?? ''}|${me.preferences.remindMode}`

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-10">
      <SettingsOverviewCard
        activeCount={activeGoals.length}
        checkedDays={overall.checkedDays}
        targetDays={overall.targetDays}
        hasDeadline={overall.hasDeadline}
        deadlineDate={overall.deadlineDate}
        remindAt={me.preferences.remindAt}
        remindMode={me.preferences.remindMode}
      />

      <SegmentedControl
        label="目标设置分类"
        options={SETTINGS_TABS}
        value={tab}
        onValueChange={setTab}
      />

      {tab === 'plan' && (
        <div className="flex flex-col gap-4">
          <ModuleSelection active={activeGoals} archived={archivedGoals} />
          <GlobalPeriodSection
            key={periodResetKey}
            active={activeGoals}
            startDate={earliestStart}
            today={today}
            initialDeadline={overall.deadlineDate ?? ''}
            initialRemindAt={me.preferences.remindAt ?? ''}
            initialRemindMode={me.preferences.remindMode}
          />
        </div>
      )}

      {tab === 'schedule' && <ScheduleSection active={activeGoals} />}

      {tab === 'rules' && (
        <div className="flex flex-col gap-4">
          <TierSection tier={me.preferences.refereeTier} />
          <RulesAccordionSection active={activeGoals} />
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <LinkButton href="/goals/new?module=custom" variant="soft" icon="plus">
          新建自定义小目标
        </LinkButton>
        <LinkButton href="/goals?status=archived" variant="soft" icon="clock">
          已归档的目标
        </LinkButton>
      </div>
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
}: {
  activeCount: number
  checkedDays: number
  targetDays: number
  hasDeadline: boolean
  deadlineDate: string | null
  remindAt: string | null
  remindMode: RemindMode
}) {
  return (
    <Card variant="sticker" className="flex items-center gap-3.5 p-3.5">
      <ProgressRing
        value={checkedDays}
        max={Math.max(1, targetDays)}
        tone="success"
        size={56}
        thickness={6}
        label={`总坚持进度：${checkedDays} / ${targetDays} 天`}
      >
        <span className="flex flex-col items-center leading-none tabular-nums">
          <span className="font-display text-caption font-bold">{checkedDays}</span>
          <span className="text-tiny text-muted">/{targetDays}</span>
        </span>
      </ProgressRing>
      <div className="min-w-0 flex-1">
        <p className="text-caption font-bold">
          进行中 {activeCount} 个板块 ·{' '}
          {hasDeadline && deadlineDate
            ? `总周期 ${targetDays} 天（截止 ${deadlineDate}）`
            : `阶段里程碑 ${targetDays} 天（未设截止日）`}
        </p>
        <p className="text-tiny text-muted mt-0.5">
          {remindMode !== 'off' && remindAt
            ? `每日提醒：${remindAt}（${remindMode === 'native' ? '手机通知' : '应用内'}）`
            : '每日总提醒：未开启'}
        </p>
      </div>
    </Card>
  )
}

/** ① 选择板块：取消勾选 = 归档，重新勾选 = 恢复（没有归档过就按默认值新建） */
function ModuleSelection({ active, archived }: { active: Goal[]; archived: Goal[] }) {
  const qc = useQueryClient()
  const activeModules = [...new Set(active.map((g) => g.module))]
  const [selected, setSelected] = useState<Module[]>(activeModules)
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
    // 新开启的板块沿用当前统一的截止日期（如有）
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
    } catch (e) {
      toast.error(isApiError(e) ? errorMessage(e) : '有一项没保存成功，刷新后再试试')
    } finally {
      void qc.invalidateQueries({ queryKey: keys.goals.all })
      for (const k of afterCheckinChange) void qc.invalidateQueries({ queryKey: k })
      setSaving(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-subhead font-bold">要坚持的打卡板块</h2>
        <span className="text-tiny text-muted">与新人引导同步</span>
      </div>
      <ModulesStep value={selected} onChange={setSelected} error={error} />
      <p className="text-tiny text-muted">取消勾选的目标会归档，历史记录全部保留，随时能恢复。</p>
      {dirty && (
        <Button className="self-end" loading={saving} onClick={() => void save()}>
          保存打卡板块
        </Button>
      )}
    </Card>
  )
}

/** ② 总打卡周期与每日提醒：统一同步到所有进行中目标 + 个人偏好 */
function GlobalPeriodSection({
  active,
  startDate,
  today,
  initialDeadline,
  initialRemindAt,
  initialRemindMode,
}: {
  active: Goal[]
  startDate: string
  today: string
  initialDeadline: string
  initialRemindAt: string
  initialRemindMode: RemindMode
}) {
  const qc = useQueryClient()
  const updatePrefs = useUpdatePreferences()
  const [deadlineDate, setDeadlineDate] = useState(initialDeadline)
  const [remindAt, setRemindAt] = useState(initialRemindAt)
  const [remindMode, setRemindMode] = useState<RemindMode>(initialRemindMode)
  const [saving, setSaving] = useState(false)

  const deadlineChanged = active.some((g) => (g.deadlineDate ?? '') !== deadlineDate)
  const remindChanged = remindAt !== initialRemindAt || remindMode !== initialRemindMode
  const dirty = deadlineChanged || remindChanged

  async function save() {
    setSaving(true)
    try {
      const tasks: Promise<unknown>[] = []
      if (deadlineChanged) {
        const nextDeadline = deadlineDate || null
        for (const g of active) {
          if ((g.deadlineDate ?? '') !== deadlineDate) {
            tasks.push(
              apiFetch(`/goals/${encodeURIComponent(g.id)}`, {
                method: 'PATCH',
                json: { deadlineDate: nextDeadline },
              }),
            )
          }
        }
      }
      if (remindChanged) {
        tasks.push(
          updatePrefs.mutateAsync({
            remindAt: remindAt || null,
            remindMode: remindAt ? remindMode : 'off',
          }),
        )
      }
      await Promise.all(tasks)
      toast.success('总周期与提醒时间已保存')
    } catch (e) {
      toast.error(isApiError(e) ? errorMessage(e) : '没保存成功，稍后再试试')
    } finally {
      void qc.invalidateQueries({ queryKey: keys.goals.all })
      void qc.invalidateQueries({ queryKey: keys.me.detail() })
      for (const k of afterCheckinChange) void qc.invalidateQueries({ queryKey: k })
      setSaving(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <PeriodPlanPicker
        idPrefix="settings-period"
        startDate={startDate}
        today={today}
        deadlineDate={deadlineDate}
        onDeadlineChange={setDeadlineDate}
        remindAt={remindAt}
        onRemindAtChange={setRemindAt}
        remindMode={remindMode}
        onRemindModeChange={setRemindMode}
      />
      <div className="flex justify-end">
        <Button size="sm" disabled={!dirty} loading={saving} onClick={() => void save()}>
          保存周期与提醒
        </Button>
      </div>
    </Card>
  )
}

/** ③ 每日目标量与计划星期/时间（折叠列表，按目标展开） */
function ScheduleSection({ active }: { active: Goal[] }) {
  const [openId, setOpenId] = useState<string | null>(() => active[0]?.id ?? null)

  if (active.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-caption text-muted">请先在「板块与周期」中至少选择一个打卡板块。</p>
      </Card>
    )
  }

  return (
    <section className="flex flex-col gap-2.5" aria-label="每日目标与计划">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-subhead font-bold">每日目标量与计划时间</h2>
        <span className="text-tiny text-muted">点开对应目标单独调整</span>
      </div>
      {active.map((g) => (
        <GoalScheduleItem
          key={`${g.id}-${g.updatedAt}`}
          goal={g}
          open={openId === g.id}
          onToggle={() => setOpenId(openId === g.id ? null : g.id)}
        />
      ))}
    </section>
  )
}

function goalScheduleSummary(goal: Goal): string {
  const targetStr =
    goal.target.kind === 'duration'
      ? `每天 ${formatDuration(goal.target.value)}`
      : `每天 ${goal.target.value} ${goal.module === 'diet' ? '餐' : '次'}`
  const daysStr = goal.weekdays.length === 7 ? '每天' : `每周 ${goal.weekdays.length} 天`
  const timeStr = goal.plannedTime ? ` · ${goal.plannedTime}` : ''
  return `${targetStr} · ${daysStr}${timeStr}`
}

function GoalScheduleItem({
  goal,
  open,
  onToggle,
}: {
  goal: Goal
  open: boolean
  onToggle: () => void
}) {
  const update = useUpdateGoal(goal.id)
  const [target, setTarget] = useState<TargetDraft>({
    kind: goal.target.kind,
    value: goal.target.value,
  })
  const [weekdays, setWeekdays] = useState<number[]>([...goal.weekdays])
  const [plannedTime, setPlannedTime] = useState(goal.plannedTime ?? '')
  const [deadlineDate, setDeadlineDate] = useState(goal.deadlineDate ?? '')

  const dirty =
    target.kind !== goal.target.kind ||
    target.value !== goal.target.value ||
    JSON.stringify(weekdays) !== JSON.stringify(goal.weekdays) ||
    plannedTime !== (goal.plannedTime ?? '') ||
    deadlineDate !== (goal.deadlineDate ?? '')

  function save() {
    if (target.value === null || target.value < 1) {
      toast.error('请填写有效的每日目标量')
      return
    }
    if (weekdays.length === 0) {
      toast.error('至少选择一天打卡星期')
      return
    }
    update.mutate(
      {
        target: { kind: target.kind, value: target.value },
        weekdays,
        plannedTime: plannedTime || null,
        deadlineDate: deadlineDate || null,
      },
      {
        onSuccess: () => toast.success(`「${goal.title}」计划已保存`),
        onError: (e) => toast.error(isApiError(e) ? errorMessage(e) : '没保存成功，稍后再试试'),
      },
    )
  }

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left"
      >
        <IconTile icon={moduleMeta[goal.module].icon} tone={goal.module} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-caption truncate font-bold">{goal.title}</p>
          <p className="text-tiny text-muted truncate">{goalScheduleSummary(goal)}</p>
        </div>
        <Icon
          name="chevron-down"
          size={16}
          className={cn('text-subtle shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      <Collapse open={open}>
        <div className="border-border/60 flex flex-col gap-4 border-t px-3.5 pt-3 pb-3.5">
          <Field
            label="每日目标量"
            htmlFor={`sched-target-${goal.id}`}
            hint={goal.module === 'sleep' ? '睡够多久算完成' : '达到这个量就算完成今天'}
          >
            <TargetEditor
              id={`sched-target-${goal.id}`}
              module={goal.module}
              value={target}
              onValueChange={setTarget}
            />
          </Field>

          <Field
            label="哪几天打卡"
            htmlFor={`sched-week-${goal.id}`}
            hint="其他日子也能补记或额外打卡，只是不计入当天计划"
          >
            <WeekdayPicker
              id={`sched-week-${goal.id}`}
              value={weekdays}
              onValueChange={setWeekdays}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <TimeField
              id={`sched-time-${goal.id}`}
              label="计划时段（可选）"
              value={plannedTime}
              onValueChange={setPlannedTime}
            />
            <DateField
              id={`sched-deadline-${goal.id}`}
              label="单独截止日期（可选）"
              value={deadlineDate}
              onValueChange={setDeadlineDate}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <LinkButton href={`/goals/${goal.id}/checkin`} variant="soft" size="sm">
                去打卡
              </LinkButton>
              <LinkButton href={`/goals/${goal.id}`} variant="soft" size="sm">
                目标详情
              </LinkButton>
            </div>
            <Button size="sm" disabled={!dirty} loading={update.isPending} onClick={save}>
              保存计划
            </Button>
          </div>
        </div>
      </Collapse>
    </Card>
  )
}

/** ④ 个人体质：改了立刻保存（偏好接口自带乐观更新） */
function TierSection({ tier }: { tier: RefereeTier }) {
  const update = useUpdatePreferences()
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-subhead font-bold">你是哪一类人群</h2>
        <p className="text-tiny text-muted">饮食裁判按这个分档评分，体重变了可以随时换</p>
      </div>
      <TierPicker
        value={tier}
        onChange={(refereeTier) =>
          update.mutate(
            { refereeTier },
            {
              onError: (e) =>
                toast.error(isApiError(e) ? errorMessage(e) : '没保存成功，稍后再试试'),
            },
          )
        }
      />
    </Card>
  )
}

/** ⑤ 达标与裁判规则（手风琴折叠列表，按板块展开编辑） */
function RulesAccordionSection({ active }: { active: Goal[] }) {
  const [openId, setOpenId] = useState<string | null>(() => active[0]?.id ?? null)

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="rules-title">
      <div className="flex items-end justify-between gap-2 px-1">
        <h2 id="rules-title" className="text-subhead font-bold">
          达标规则
        </h2>
        <span className="text-tiny text-muted">只影响之后的打卡</span>
      </div>
      {active.length === 0 ? (
        <Card className="p-4">
          <p className="text-caption text-muted">先在「板块与周期」选一个打卡板块</p>
        </Card>
      ) : (
        active.map((g) => (
          <GoalRulesCard
            key={`${g.id}-${g.updatedAt}`}
            goal={g}
            open={openId === g.id}
            onToggle={() => setOpenId(openId === g.id ? null : g.id)}
          />
        ))
      )}
    </section>
  )
}

function GoalRulesCard({
  goal,
  open,
  onToggle,
}: {
  goal: Goal
  open: boolean
  onToggle: () => void
}) {
  const def = moduleDef(goal.module)
  const update = useUpdateGoal(goal.id)
  const [rules, setRules] = useState<RefereeRules>(() =>
    effectiveRules(goal.module, goal.refereeRules),
  )
  const stored = effectiveRules(goal.module, goal.refereeRules)
  const dirty = JSON.stringify(rules) !== JSON.stringify(stored)
  const Editor = def.RulesEditor

  function save() {
    update.mutate(
      { refereeRules: isDefaultRules(rules) ? null : rules },
      {
        onSuccess: () => toast.success(`「${goal.title}」的规则已保存`),
        onError: (e) => toast.error(isApiError(e) ? errorMessage(e) : '没保存成功，稍后再试试'),
      },
    )
  }

  return (
    <Card className="overflow-hidden p-0" data-goal-rules={goal.module}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left"
      >
        <IconTile icon={moduleMeta[goal.module].icon} tone={goal.module} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-caption truncate font-bold">{goal.title}</p>
          <p className="text-tiny text-muted truncate">
            {def.docs(rules as never, goal).glance.threshold}
          </p>
        </div>
        <Icon
          name="chevron-down"
          size={16}
          className={cn('text-subtle shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      <Collapse open={open}>
        <div className="border-border/60 flex flex-col gap-3 border-t px-3.5 pt-3 pb-3.5">
          <Editor
            rules={rules as never}
            onChange={(r) => setRules(r as RefereeRules)}
            goal={goal}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <LinkButton href={`/goals/${goal.id}/checkin`} variant="soft" size="sm">
              去打卡
            </LinkButton>
            <div className="flex gap-2">
              {!isDefaultRules(rules) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRules(effectiveRules(goal.module, null))}
                >
                  恢复默认
                </Button>
              )}
              <Button size="sm" disabled={!dirty} loading={update.isPending} onClick={save}>
                保存
              </Button>
            </div>
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
      <Skeleton className="h-10 w-full rounded-full" />
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-44 w-full rounded-2xl" />
    </div>
  )
}
