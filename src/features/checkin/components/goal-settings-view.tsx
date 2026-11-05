'use client'

import { useState } from 'react'
import { IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { moduleMeta } from '@/components/ui/tone'
import { LinkButton } from '@/features/dashboard/components/link-button'
import { DEFAULT_GOALS } from '@/features/goal/defaults'
import type { Goal } from '@/features/goal/schemas'
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
import { goalListQuery, useUpdateGoal } from '@/lib/api/queries/goals'
import { useMe, useUpdatePreferences } from '@/lib/api/queries/me'
import { moduleDef } from '../modules/registry'
import { TierPicker } from '../modules/tier-picker'

/*
 * 「我的 → 目标设置」（/goals）：全局唯一的目标设置入口（checkin-modules.md 第 5 节）。
 *   ① 选择要坚持的打卡板块（取消 = 归档，历史保留）
 *   ② 个人体质档位（饮食裁判按它分档）
 *   ③ 每个进行中目标的达标规则与截止日期（面板来自板块注册表）
 * 顶栏「＋ → 设置目标」、底栏「＋」的空状态、主页空状态都跳到这里。
 */

export function GoalSettingsView() {
  const active = useQuery(goalListQuery('active'))
  const archived = useQuery(goalListQuery('archived'))
  const me = useMe()

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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-10">
      <ModuleSelection active={active.data.items} archived={archived.data.items} />
      <TierSection tier={me.data.preferences.refereeTier} />
      <section className="flex flex-col gap-3" aria-labelledby="rules-title">
        <div className="flex items-end justify-between gap-2">
          <h2 id="rules-title" className="text-subhead font-bold">
            达标规则
          </h2>
          <span className="text-tiny text-muted">只影响之后的打卡</span>
        </div>
        {active.data.items.length === 0 ? (
          <p className="text-caption text-muted">先在上面选一个板块</p>
        ) : (
          active.data.items.map((g) => <GoalRulesCard key={`${g.id}-${g.updatedAt}`} goal={g} />)
        )}
      </section>
      <div className="flex flex-wrap justify-center gap-2">
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
              json: DEFAULT_GOALS[m],
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
    <section className="flex flex-col gap-3" aria-labelledby="modules-title">
      <h2 id="modules-title" className="text-subhead font-bold">
        要坚持的打卡
      </h2>
      <ModulesStep value={selected} onChange={setSelected} error={error} />
      <p className="text-tiny text-muted">
        取消勾选的目标会归档，坚持天数重新计算；历史记录全部保留，随时能恢复。
      </p>
      {dirty && (
        <Button className="self-end" loading={saving} onClick={() => void save()}>
          保存打卡板块
        </Button>
      )}
    </section>
  )
}

/** ② 个人体质：改了立刻保存（偏好接口自带乐观更新） */
function TierSection({ tier }: { tier: RefereeTier }) {
  const update = useUpdatePreferences()
  return (
    <section className="flex flex-col gap-3" aria-labelledby="tier-title">
      <div className="flex flex-col gap-0.5">
        <h2 id="tier-title" className="text-subhead font-bold">
          你是哪一类人群
        </h2>
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
    </section>
  )
}

/** ③ 一个目标的达标规则 + 截止日期 */
function GoalRulesCard({ goal }: { goal: Goal }) {
  const def = moduleDef(goal.module)
  const update = useUpdateGoal(goal.id)
  const [rules, setRules] = useState<RefereeRules>(() =>
    effectiveRules(goal.module, goal.refereeRules),
  )
  const [deadline, setDeadline] = useState(goal.deadlineDate ?? '')
  const stored = effectiveRules(goal.module, goal.refereeRules)
  const dirty =
    JSON.stringify(rules) !== JSON.stringify(stored) || deadline !== (goal.deadlineDate ?? '')
  const Editor = def.RulesEditor

  function save() {
    update.mutate(
      {
        refereeRules: isDefaultRules(rules) ? null : rules,
        deadlineDate: deadline || null,
      },
      {
        onSuccess: () => toast.success(`「${goal.title}」的规则已保存`),
        onError: (e) => toast.error(isApiError(e) ? errorMessage(e) : '没保存成功，稍后再试试'),
      },
    )
  }

  return (
    <Card className="flex flex-col gap-3 p-3.5" data-goal-rules={goal.module}>
      <div className="flex items-center gap-2.5">
        <IconTile icon={moduleMeta[goal.module].icon} tone={goal.module} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-caption truncate font-bold">{goal.title}</p>
          <p className="text-tiny text-muted truncate">
            {def.docs(rules as never, goal).glance.threshold}
          </p>
        </div>
        <LinkButton href={`/goals/${goal.id}/checkin`} variant="soft" size="sm">
          去打卡
        </LinkButton>
      </div>
      <Editor rules={rules as never} onChange={(r) => setRules(r as RefereeRules)} goal={goal} />
      <DateField
        id={`deadline-${goal.id}`}
        label="截止日期（可选）"
        value={deadline}
        onValueChange={setDeadline}
        hint="设了期限，打卡页的周期环按这段时间算"
      />
      <div className="flex justify-end gap-2">
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
    </Card>
  )
}

function SettingsSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="mx-auto grid w-full max-w-2xl gap-3">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  )
}
