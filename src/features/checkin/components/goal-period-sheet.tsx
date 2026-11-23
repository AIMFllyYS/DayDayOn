'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { PeriodPlanPicker } from '@/features/goal/components/period-plan-picker'
import type { Goal } from '@/features/goal/schemas'
import type { RemindMode } from '@/features/me/schemas'
import { apiFetch, errorMessage, isApiError, useQueryClient } from '@/lib/api'
import { afterCheckinChange, keys } from '@/lib/api/keys'
import { useUpdatePreferences } from '@/lib/api/queries/me'

/*
 * 「目标设置 → 周期与提醒」底部 Sheet（Dock 栏）：
 * 从顶部总览卡的「设置」按钮弹出，统一调整总打卡周期、截止日期与每日提醒。
 */

interface GoalPeriodSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  active: Goal[]
  startDate: string
  today: string
  initialDeadline: string
  initialRemindAt: string
  initialRemindMode: RemindMode
}

export function GoalPeriodSheet({
  open,
  onOpenChange,
  active,
  startDate,
  today,
  initialDeadline,
  initialRemindAt,
  initialRemindMode,
}: GoalPeriodSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="周期与提醒设置"
      description="同步应用到所有进行中的打卡板块"
    >
      <GoalPeriodSheetBody
        key={`${open}-${initialDeadline}-${initialRemindAt}-${initialRemindMode}`}
        active={active}
        startDate={startDate}
        today={today}
        initialDeadline={initialDeadline}
        initialRemindAt={initialRemindAt}
        initialRemindMode={initialRemindMode}
        onSaved={() => onOpenChange(false)}
      />
    </Sheet>
  )
}

function GoalPeriodSheetBody({
  active,
  startDate,
  today,
  initialDeadline,
  initialRemindAt,
  initialRemindMode,
  onSaved,
}: Omit<GoalPeriodSheetProps, 'open' | 'onOpenChange'> & { onSaved: () => void }) {
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
      <Button className="w-full" disabled={!dirty} loading={saving} onClick={() => void save()}>
        保存周期与提醒
      </Button>
    </div>
  )
}
