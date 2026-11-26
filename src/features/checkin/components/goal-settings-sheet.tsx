'use client'

import { useState } from 'react'
import { IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { MenuItem, MenuList } from '@/components/ui/menu-list'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { moduleMeta, softToneClass } from '@/components/ui/tone'
import { DEFAULT_GOALS } from '@/features/goal/defaults'
import { PeriodPlanPicker } from '@/features/goal/components/period-plan-picker'
import type { Goal } from '@/features/goal/schemas'
import type { RemindMode } from '@/features/me/schemas'
import { MODULES, type Module } from '@/features/shared/schemas'
import { apiFetch, errorMessage, isApiError, newIdempotencyKey, useQueryClient } from '@/lib/api'
import { afterCheckinChange, keys } from '@/lib/api/keys'
import { useUpdatePreferences } from '@/lib/api/queries/me'
import { cn } from '@/lib/cn'
import {
  computeModuleSelectionDiff,
  modulesDockSummary,
  periodDockSummary,
} from './goal-settings-logic'

/*
 * 「目标设置 → 统一设置 Dock」（Issue #103）：
 * 遵守「弹层内不开第二层弹层」，在同一个 <Sheet> 内支持三级钻取（menu | period | modules）：
 * - menu：首选展示「时间周期设置」与「打卡设置」；在紧凑视口（页面下方放不下时）自动收纳「新建自定义小目标」与「已归档的目标」；
 * - period：复用 PeriodPlanPicker 统一调整总打卡周期、截止日期与每日提醒；
 * - modules：宽松 5 板块卡片勾选（增减板块 / 恢复归档 / 新建默认目标），用 openSession 重置草稿杜绝关抽屉动画闪烁。
 */

export type GoalSettingsSheetView = 'menu' | 'period' | 'modules'
export type GoalSettingsFooterMode = 'auto' | 'inline' | 'dock'

export interface GoalSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialView?: GoalSettingsSheetView
  footerMode?: GoalSettingsFooterMode
  active: Goal[]
  archived: Goal[]
  startDate: string
  today: string
  hasDeadline: boolean
  targetDays: number
  initialDeadline: string
  initialRemindAt: string
  initialRemindMode: RemindMode
}

const SHEET_COPY: Record<GoalSettingsSheetView, { title: string; description: string }> = {
  menu: {
    title: '目标设置',
    description: '统一调整总打卡周期、要坚持的板块与目标管理',
  },
  period: {
    title: '时间周期设置',
    description: '同步应用到所有进行中的打卡板块',
  },
  modules: {
    title: '打卡设置',
    description: '勾选想坚持的打卡板块，取消勾选会归档保留历史记录',
  },
}

export function GoalSettingsSheet({
  open,
  onOpenChange,
  initialView = 'menu',
  footerMode = 'auto',
  active,
  archived,
  startDate,
  today,
  hasDeadline,
  targetDays,
  initialDeadline,
  initialRemindAt,
  initialRemindMode,
}: GoalSettingsSheetProps) {
  const [prevOpen, setPrevOpen] = useState(open)
  const [openSession, setOpenSession] = useState(0)
  const [view, setView] = useState<GoalSettingsSheetView>(initialView)

  // 只在「关闭 → 打开」瞬间递增 openSession 与同步初始视图，关闭退场动画期间保持内容稳定不闪烁
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setOpenSession((s) => s + 1)
      setView(initialView)
    }
  }

  const copy = SHEET_COPY[view]
  const dockFooterClass =
    footerMode === 'dock' ? 'block' : footerMode === 'inline' ? 'hidden' : 'goals-footer-dock'

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
    >
      {view === 'menu' && (
        <div className="flex flex-col gap-4 pb-1" data-settings-dock-menu="true">
          <MenuList>
            <MenuItem
              icon="calendar"
              tone="primary"
              label="时间周期设置"
              description={
                hasDeadline && initialDeadline ? `截止 ${initialDeadline}` : '自由坚持，未设截止日'
              }
              value={periodDockSummary({
                hasDeadline,
                targetDays,
                remindMode: initialRemindMode,
                remindAt: initialRemindAt || null,
              })}
              onClick={() => setView('period')}
            />
            <MenuItem
              icon="sliders"
              tone="exercise"
              label="打卡设置"
              description="选择要坚持的打卡板块与默认目标"
              value={modulesDockSummary(active)}
              onClick={() => setView('modules')}
            />
          </MenuList>

          <div className={dockFooterClass} data-goals-dock-links="true">
            <MenuList title="更多目标管理">
              <MenuItem
                icon="plus"
                tone="custom"
                label="新建自定义小目标"
                description="自由拼字段与达标条件"
                href="/goals/new?module=custom"
                onClick={() => onOpenChange(false)}
              />
              <MenuItem
                icon="clock"
                tone="neutral"
                label="已归档的目标"
                description="查看历史或随时恢复打卡"
                value={archived.length > 0 ? `${archived.length} 个` : undefined}
                href="/goals?status=archived"
                onClick={() => onOpenChange(false)}
              />
            </MenuList>
          </div>
        </div>
      )}

      {view === 'period' && (
        <PeriodSettingsPanel
          key={`period-${openSession}`}
          active={active}
          startDate={startDate}
          today={today}
          initialDeadline={initialDeadline}
          initialRemindAt={initialRemindAt}
          initialRemindMode={initialRemindMode}
          onBack={() => setView('menu')}
          onSaved={() => onOpenChange(false)}
        />
      )}

      {view === 'modules' && (
        <ModuleSettingsPanel
          key={`modules-${openSession}`}
          active={active}
          archived={archived}
          onBack={() => setView('menu')}
          onSaved={() => onOpenChange(false)}
        />
      )}
    </Sheet>
  )
}

function PeriodSettingsPanel({
  active,
  startDate,
  today,
  initialDeadline,
  initialRemindAt,
  initialRemindMode,
  onBack,
  onSaved,
}: {
  active: Goal[]
  startDate: string
  today: string
  initialDeadline: string
  initialRemindAt: string
  initialRemindMode: RemindMode
  onBack: () => void
  onSaved: () => void
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
      toast.success('周期与提醒已保存')
      onSaved()
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
    <div className="flex flex-col gap-4">
      <PeriodPlanPicker
        idPrefix="settings-period-sheet"
        startDate={startDate}
        today={today}
        deadlineDate={deadlineDate}
        onDeadlineChange={setDeadlineDate}
        remindAt={remindAt}
        onRemindAtChange={setRemindAt}
        remindMode={remindMode}
        onRemindModeChange={setRemindMode}
      />
      <div className="flex flex-col gap-2">
        <Button className="w-full" disabled={!dirty} loading={saving} onClick={() => void save()}>
          保存周期与提醒
        </Button>
        <Button variant="ghost" icon="chevron-left" className="w-full" onClick={onBack}>
          返回设置菜单
        </Button>
      </div>
    </div>
  )
}

function ModuleSettingsPanel({
  active,
  archived,
  onBack,
  onSaved,
}: {
  active: Goal[]
  archived: Goal[]
  onBack: () => void
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Module[]>(() => [
    ...new Set(active.map((g) => g.module)),
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const diff = computeModuleSelectionDiff(active, archived, selected)

  function toggleModule(mod: Module) {
    setError(undefined)
    setSelected((prev) => (prev.includes(mod) ? prev.filter((x) => x !== mod) : [...prev, mod]))
  }

  async function save() {
    if (selected.length === 0) {
      setError('至少保留一个打卡板块')
      return
    }
    setSaving(true)
    setError(undefined)
    const tasks: Promise<unknown>[] = [
      ...diff.toArchive.map((g) =>
        apiFetch(`/goals/${encodeURIComponent(g.id)}`, {
          method: 'PATCH',
          json: { status: 'archived' },
        }),
      ),
      ...diff.toRestore.map((g) =>
        apiFetch(`/goals/${encodeURIComponent(g.id)}`, {
          method: 'PATCH',
          json: { status: 'active' },
        }),
      ),
      ...diff.toCreate.map((mod) =>
        apiFetch('/goals', {
          method: 'POST',
          json: {
            ...DEFAULT_GOALS[mod],
            ...(diff.sharedDeadline ? { deadlineDate: diff.sharedDeadline } : {}),
          },
          idempotencyKey: newIdempotencyKey(),
        }),
      ),
    ]

    try {
      await Promise.all(tasks)
      toast.success('打卡板块已更新')
      onSaved()
    } catch (e) {
      toast.error(isApiError(e) ? errorMessage(e) : '有一项没保存成功，刷新后再试试')
    } finally {
      void qc.invalidateQueries({ queryKey: keys.goals.all })
      for (const k of afterCheckinChange) void qc.invalidateQueries({ queryKey: k })
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5" data-settings-dock-modules="true">
      <div className="flex flex-col gap-2" role="group" aria-label="选择要坚持的打卡板块">
        {MODULES.map((mod) => {
          const checked = selected.includes(mod)
          const activeCount = active.filter((g) => g.module === mod).length
          const archivedCount = archived.filter((g) => g.module === mod).length
          const hint =
            activeCount > 1
              ? `进行中 · 共 ${activeCount} 个目标`
              : activeCount === 1
                ? '进行中'
                : archivedCount > 0
                  ? '已归档，勾选后将恢复'
                  : '未开启，勾选后自动创建默认目标'

          return (
            <button
              key={mod}
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => toggleModule(mod)}
              className={cn(
                'ease-spring flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-[transform,background-color,border-color] duration-(--dur-fast) active:scale-[0.99]',
                checked
                  ? cn('border-primary/45', softToneClass[mod])
                  : 'border-border bg-surface hover:bg-surface-sunken/50',
              )}
            >
              <IconTile icon={moduleMeta[mod].icon} tone={mod} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-caption text-foreground truncate font-bold">
                  {moduleMeta[mod].label}
                </p>
                <p className="text-tiny text-muted truncate">{hint}</p>
              </div>
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                  checked
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border-strong bg-surface',
                )}
              >
                {checked && <Icon name="check" size={12} strokeWidth={3} />}
              </span>
            </button>
          )
        })}
      </div>

      {error && <p className="text-tiny text-danger-ink px-1 font-semibold">{error}</p>}

      <div className="flex flex-col gap-2 pt-0.5">
        <Button
          className="w-full"
          disabled={!diff.hasChanges}
          loading={saving}
          onClick={() => void save()}
        >
          保存打卡板块
        </Button>
        <Button variant="ghost" icon="chevron-left" className="w-full" onClick={onBack}>
          返回设置菜单
        </Button>
      </div>
    </div>
  )
}
