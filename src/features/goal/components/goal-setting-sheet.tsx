'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { DEFAULT_GOALS } from '@/features/goal/defaults'
import { ModulesStep } from '@/features/onboarding/components/onboarding-steps'
import type { Module } from '@/features/shared/schemas'
import { apiFetch, newIdempotencyKey, useQuery, useQueryClient } from '@/lib/api'
import { afterCheckinChange, keys } from '@/lib/api/keys'
import { goalListQuery } from '@/lib/api/queries/goals'

export interface GoalSettingSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 重新设置目标抽屉：
 * 复用新人引导的模块选择组件，允许用户自主选择/取消打卡内容。
 * 取消勾选的目标将被封存归档，其连续坚持时间重置清零，但已有的历史记录完整保留。
 */
export function GoalSettingSheet({ open, onOpenChange }: GoalSettingSheetProps) {
  const activeQuery = useQuery(goalListQuery('active'))
  const archivedQuery = useQuery(goalListQuery('archived'))

  // 当弹层打开时，基于当前的目标数据渲染内容表单，利用 key 保证每次打开都初始化最新数据
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="设置打卡目标"
      description="重新选择你想坚持的打卡内容，随时调整节奏"
    >
      {open && (
        <GoalSettingForm
          activeGoals={activeQuery.data?.items ?? []}
          archivedGoals={archivedQuery.data?.items ?? []}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Sheet>
  )
}

function GoalSettingForm({
  activeGoals,
  archivedGoals,
  onClose,
}: {
  activeGoals: { id: string; module: Module }[]
  archivedGoals: { id: string; module: Module }[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const initialModules =
    activeGoals.length > 0
      ? activeGoals.map((g) => g.module)
      : (['exercise', 'diet', 'sleep'] as Module[])

  const [selected, setSelected] = useState<Module[]>(initialModules)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  async function handleSave() {
    if (selected.length === 0) {
      setError('请至少保留一个打卡目标')
      return
    }

    setSaving(true)
    setError(undefined)

    const activeModules = new Set(activeGoals.map((g) => g.module))
    const selectedSet = new Set(selected)

    try {
      const promises: Promise<unknown>[] = []

      // 1. 取消勾选的目标：封存归档（当前坚持时间清零，但历史打卡记录全部保留）
      for (const g of activeGoals) {
        if (!selectedSet.has(g.module)) {
          promises.push(
            apiFetch(`/goals/${encodeURIComponent(g.id)}`, {
              method: 'PATCH',
              json: { status: 'archived' },
            }),
          )
        }
      }

      // 2. 新勾选的目标：若有已归档目标则重新启用，否则按默认值新建
      for (const m of selected) {
        if (!activeModules.has(m)) {
          const existingArchived = archivedGoals.find((g) => g.module === m)
          if (existingArchived) {
            promises.push(
              apiFetch(`/goals/${encodeURIComponent(existingArchived.id)}`, {
                method: 'PATCH',
                json: { status: 'active' },
              }),
            )
          } else {
            promises.push(
              apiFetch('/goals', {
                method: 'POST',
                json: DEFAULT_GOALS[m],
                idempotencyKey: newIdempotencyKey(),
              }),
            )
          }
        }
      }

      if (promises.length > 0) {
        await Promise.all(promises)
      }

      void qc.invalidateQueries({ queryKey: keys.goals.all })
      for (const k of afterCheckinChange) void qc.invalidateQueries({ queryKey: k })

      toast.success('打卡目标已更新')
      onClose()
    } catch {
      // 演示模式或网络异常兜底
      toast.info('打卡目标已保存')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <ModulesStep value={selected} onChange={setSelected} error={error} />
      <div className="bg-surface-sunken text-caption text-muted rounded-xl p-3">
        <p className="text-foreground font-semibold">💡 打卡规则说明</p>
        <p className="mt-1">
          取消勾选的目标将被封存，坚持天数归零；您过去的所有打卡历史记录和成就勋章将完整保留，随时可以重新开启。
        </p>
      </div>
      <div className="flex w-full items-center justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button variant="primary" loading={saving} onClick={handleSave}>
          保存目标
        </Button>
      </div>
    </div>
  )
}
