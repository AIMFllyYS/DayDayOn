'use client'

import { useState } from 'react'
import { IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { Collapse } from '@/components/ui/collapse'
import { Field } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { TimePicker } from '@/components/ui/time-picker'
import { toast } from '@/components/ui/toast'
import { moduleMeta } from '@/components/ui/tone'
import { LinkButton } from '@/features/dashboard/components/link-button'
import { TargetEditor, type TargetDraft } from '@/features/goal/components/target-editor'
import { WeekdayPicker } from '@/features/goal/components/weekday-picker'
import type { Goal } from '@/features/goal/schemas'
import { effectiveRules, isDefaultRules } from '@/features/referee/defaults'
import type { RefereeRules, RefereeTier } from '@/features/referee/schemas'
import { errorMessage, isApiError } from '@/lib/api'
import { useUpdateGoal } from '@/lib/api/queries/goals'
import { useUpdatePreferences } from '@/lib/api/queries/me'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/time'
import { moduleDef } from '../modules/registry'
import { TierPicker } from '../modules/tier-picker'

/*
 * 单板块目标设置卡片（放入可左右滑动翻页的卡片菜单中）：
 * - 一张卡片完整涵盖该板块的「目标与计划」与「达标规则」，内部用折叠面板分层收放，避免超长堆砌；
 * - 计划时段复用共享 <TimePicker />，单独截止日期复用共享 <Calendar />；
 * - 饮食板块卡片内置「人群档位」选择，免去单独占页。
 */

interface GoalModuleCardProps {
  goal: Goal
  today: string
  tier: RefereeTier
  defaultRulesOpen?: boolean
}

function goalScheduleSummary(goal: Goal): string {
  const targetStr =
    goal.target.kind === 'duration'
      ? `每天 ${formatDuration(goal.target.value)}`
      : `每天 ${goal.target.value} ${goal.module === 'diet' ? '餐' : '次'}`
  const daysStr = goal.weekdays.length === 7 ? '' : ` · 每周 ${goal.weekdays.length} 天`
  const timeStr = goal.plannedTime ? ` · ${goal.plannedTime}` : ''
  return `${targetStr}${daysStr}${timeStr}`
}

export function GoalModuleCard({
  goal,
  today,
  tier,
  defaultRulesOpen = false,
}: GoalModuleCardProps) {
  const def = moduleDef(goal.module)
  const Editor = def.RulesEditor
  const updateGoal = useUpdateGoal(goal.id)
  const updatePrefs = useUpdatePreferences()

  // 折叠态：默认展开「目标与计划」，「达标规则」按需展开（或由初始参数展开）
  const [planOpen, setPlanOpen] = useState(!defaultRulesOpen)
  const [rulesOpen, setRulesOpen] = useState(defaultRulesOpen)
  const [timePickerOpen, setTimePickerOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  // 目标与计划草稿
  const [target, setTarget] = useState<TargetDraft>({
    kind: goal.target.kind,
    value: goal.target.value,
  })
  const [weekdays, setWeekdays] = useState<number[]>([...goal.weekdays])
  const [plannedTime, setPlannedTime] = useState(goal.plannedTime ?? '')
  const [deadlineDate, setDeadlineDate] = useState(goal.deadlineDate ?? '')

  // 达标规则草稿
  const [rules, setRules] = useState<RefereeRules>(() =>
    effectiveRules(goal.module, goal.refereeRules),
  )
  const storedRules = effectiveRules(goal.module, goal.refereeRules)

  const planDirty =
    target.kind !== goal.target.kind ||
    target.value !== goal.target.value ||
    JSON.stringify(weekdays) !== JSON.stringify(goal.weekdays) ||
    plannedTime !== (goal.plannedTime ?? '') ||
    deadlineDate !== (goal.deadlineDate ?? '')

  const rulesDirty = JSON.stringify(rules) !== JSON.stringify(storedRules)
  const thresholdSummary = def.docs(rules as never, goal).glance.threshold

  function savePlan() {
    if (target.value === null || target.value < 1) {
      toast.error('请填写有效的每日目标量')
      return
    }
    if (weekdays.length === 0) {
      toast.error('至少选择一天打卡星期')
      return
    }
    updateGoal.mutate(
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

  function saveRules() {
    updateGoal.mutate(
      { refereeRules: isDefaultRules(rules) ? null : rules },
      {
        onSuccess: () => toast.success(`「${goal.title}」规则已保存`),
        onError: (e) => toast.error(isApiError(e) ? errorMessage(e) : '没保存成功，稍后再试试'),
      },
    )
  }

  return (
    <Card data-goal-module-card={goal.module} className="flex h-full flex-col overflow-hidden p-0">
      {/* 卡片顶栏：板块图标 + 标题摘要 + 去打卡 */}
      <div className="border-border/70 flex items-center gap-3 border-b px-4 py-3">
        <IconTile icon={moduleMeta[goal.module].icon} tone={goal.module} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-subhead truncate font-bold">{goal.title}</p>
          <p className="text-tiny text-muted truncate">{goalScheduleSummary(goal)}</p>
        </div>
        <LinkButton
          href={`/goals/${goal.id}/checkin`}
          variant="soft"
          size="sm"
          className="shrink-0"
        >
          去打卡
        </LinkButton>
      </div>

      <div className="divide-border/70 flex flex-col divide-y">
        {/* 折叠块 1：目标与计划 */}
        <div>
          <button
            type="button"
            aria-expanded={planOpen}
            onClick={() => setPlanOpen((o) => !o)}
            className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left"
          >
            <span className="text-caption text-foreground flex items-center gap-1.5 font-bold">
              <Icon name="calendar" size={15} className="text-primary-ink shrink-0" lineOnly />
              <span>目标与计划</span>
            </span>
            <Icon
              name="chevron-down"
              size={15}
              className={cn(
                'text-subtle shrink-0 transition-transform duration-(--dur-base)',
                planOpen && 'rotate-180',
              )}
            />
          </button>

          <Collapse open={planOpen}>
            <div className="flex flex-col gap-3.5 px-4 pt-1 pb-4">
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

              <Field label="哪几天打卡" htmlFor={`sched-week-${goal.id}`}>
                <WeekdayPicker
                  id={`sched-week-${goal.id}`}
                  value={weekdays}
                  onValueChange={setWeekdays}
                />
              </Field>

              {/* 计划时段 & 单独截止日期：复用打卡 TimePicker 与共享 Calendar */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-expanded={timePickerOpen}
                  onClick={() => {
                    if (!plannedTime) setPlannedTime('20:00')
                    setTimePickerOpen((o) => !o)
                    setCalendarOpen(false)
                  }}
                  className={cn(
                    'border-border bg-surface-sunken/60 flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors',
                    timePickerOpen && 'border-primary bg-primary-soft/35',
                  )}
                >
                  <Icon name="clock" size={14} className="text-primary-ink shrink-0" lineOnly />
                  <span className="min-w-0 flex-1">
                    <span className="text-tiny text-muted block leading-none">计划时段</span>
                    <span className="text-caption text-foreground mt-0.5 block truncate font-semibold tabular-nums">
                      {plannedTime || '未设'}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  aria-expanded={calendarOpen}
                  onClick={() => {
                    setCalendarOpen((o) => !o)
                    setTimePickerOpen(false)
                  }}
                  className={cn(
                    'border-border bg-surface-sunken/60 flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors',
                    calendarOpen && 'border-primary bg-primary-soft/35',
                  )}
                >
                  <Icon name="calendar" size={14} className="text-primary-ink shrink-0" lineOnly />
                  <span className="min-w-0 flex-1">
                    <span className="text-tiny text-muted block leading-none">单独截止</span>
                    <span className="text-caption text-foreground mt-0.5 block truncate font-semibold tabular-nums">
                      {deadlineDate || '随总周期'}
                    </span>
                  </span>
                </button>
              </div>

              <Collapse open={timePickerOpen} unmountOnCollapse>
                <div className="border-border bg-surface-sunken/50 flex flex-col gap-2 rounded-xl border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-tiny text-muted font-semibold">选择计划时段</span>
                    <div className="flex items-center gap-2">
                      {plannedTime && (
                        <button
                          type="button"
                          onClick={() => {
                            setPlannedTime('')
                            setTimePickerOpen(false)
                          }}
                          className="text-tiny text-muted hover:text-foreground font-semibold"
                        >
                          清除
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setTimePickerOpen(false)}
                        className="text-tiny text-primary-ink font-semibold"
                      >
                        完成
                      </button>
                    </div>
                  </div>
                  <TimePicker
                    label="计划时段"
                    value={plannedTime || '20:00'}
                    onChange={setPlannedTime}
                    className="bg-surface border-border border"
                  />
                </div>
              </Collapse>

              <Collapse open={calendarOpen} unmountOnCollapse>
                <div className="border-border bg-surface-sunken/50 flex flex-col gap-2 rounded-xl border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-tiny text-muted font-semibold">单独截止日期</span>
                    {deadlineDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeadlineDate('')
                          setCalendarOpen(false)
                        }}
                        className="text-tiny text-muted hover:text-foreground font-semibold"
                      >
                        清除
                      </button>
                    )}
                  </div>
                  <div className="bg-surface border-border rounded-xl border p-2">
                    <Calendar
                      label="选择单独截止日期"
                      today={today}
                      defaultMonth={(deadlineDate || today).slice(0, 7)}
                      minDate={today}
                      maxMonth="2099-12"
                      selected={deadlineDate || null}
                      marks={
                        deadlineDate
                          ? [{ date: deadlineDate, tone: goal.module, variant: 'done' }]
                          : []
                      }
                      onDayClick={(d) => {
                        setDeadlineDate(d)
                        setCalendarOpen(false)
                      }}
                    />
                  </div>
                </div>
              </Collapse>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <LinkButton href={`/goals/${goal.id}`} variant="soft" size="sm">
                  目标详情
                </LinkButton>
                <Button
                  size="sm"
                  disabled={!planDirty}
                  loading={updateGoal.isPending}
                  onClick={savePlan}
                >
                  保存计划
                </Button>
              </div>
            </div>
          </Collapse>
        </div>

        {/* 折叠块 2：达标与裁判规则 */}
        <div data-goal-rules={goal.module}>
          <button
            type="button"
            aria-expanded={rulesOpen}
            onClick={() => setRulesOpen((o) => !o)}
            className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left"
          >
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <Icon name="shield" size={15} className="text-primary-ink shrink-0" lineOnly />
              <span className="text-caption text-foreground shrink-0 font-bold">达标规则</span>
              <span className="text-tiny text-muted truncate">· {thresholdSummary}</span>
            </div>
            <Icon
              name="chevron-down"
              size={15}
              className={cn(
                'text-subtle shrink-0 transition-transform duration-(--dur-base)',
                rulesOpen && 'rotate-180',
              )}
            />
          </button>

          <Collapse open={rulesOpen}>
            <div className="flex flex-col gap-3 px-4 pt-1 pb-4">
              {goal.module === 'diet' && (
                <div className="border-border bg-surface-sunken/50 flex flex-col gap-2 rounded-xl border p-2.5">
                  <span className="text-tiny text-muted font-semibold">
                    人群档位（饮食裁判评分基准）
                  </span>
                  <TierPicker
                    value={tier}
                    onChange={(refereeTier) =>
                      updatePrefs.mutate(
                        { refereeTier },
                        {
                          onError: (e) =>
                            toast.error(isApiError(e) ? errorMessage(e) : '没保存成功，稍后再试试'),
                        },
                      )
                    }
                  />
                </div>
              )}

              <Editor
                rules={rules as never}
                onChange={(r) => setRules(r as RefereeRules)}
                goal={goal}
              />

              <div className="flex items-center justify-end gap-2">
                {!isDefaultRules(rules) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRules(effectiveRules(goal.module, null))}
                  >
                    恢复默认
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={!rulesDirty}
                  loading={updateGoal.isPending}
                  onClick={saveRules}
                >
                  保存规则
                </Button>
              </div>
            </div>
          </Collapse>
        </div>
      </div>
    </Card>
  )
}
