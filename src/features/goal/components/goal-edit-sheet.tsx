'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { errorMessage, isApiError } from '@/lib/api'
import { useUpdateGoal } from '@/lib/api/queries/goals'
import { serverFormErrors, type GoalFormErrors } from '../form-errors'
import { diffGoal } from '../diff'
import type { CreateGoal, GoalDetail } from '../schemas'
import { GoalForm } from './goal-form'

interface GoalEditSheetProps {
  goal: GoalDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 编辑抽屉：改标题、说明、目标量、计划星期、计划时间、自定义字段。
 * 只提交改了的部分；目标量变化由服务端写 goal_targets（只影响今天起的进度），字段变化生成新版本。
 * 懒加载：详情页用 next/dynamic 引入本文件（ui-primitives.md 第 3 节）。
 */
export function GoalEditSheet({ goal, open, onOpenChange }: GoalEditSheetProps) {
  const update = useUpdateGoal(goal.id)
  const [serverErrors, setServerErrors] = useState<GoalFormErrors>()
  const formId = `edit-goal-${goal.id}`

  function submit(values: CreateGoal) {
    const patch = diffGoal(goal, values)
    if (Object.keys(patch).length === 0) {
      onOpenChange(false)
      return
    }
    update.mutate(patch, {
      onSuccess: () => {
        toast.success('改好了')
        onOpenChange(false)
      },
      onError: (e) => {
        if (isApiError(e) && e.code === 'VALIDATION_FAILED' && e.fields) {
          setServerErrors(serverFormErrors(e.fields))
        }
        toast.error(isApiError(e) ? errorMessage(e) : errorMessage({ code: 'INTERNAL' }))
      },
    })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="编辑目标"
      description="改目标量只影响今天起的进度"
      footer={
        <Button type="submit" form={formId} loading={update.isPending} className="w-full">
          保存
        </Button>
      }
    >
      {/* key：每次打开都从当前目标重新填表 */}
      {open && (
        <GoalForm
          key={goal.updatedAt}
          id={formId}
          module={goal.module}
          initial={goal}
          serverErrors={serverErrors}
          fieldsHint={
            goal.fieldVersion !== null
              ? `当前第 ${goal.fieldVersion} 版；改了字段会生成新版本，以前的记录按当时的字段显示`
              : undefined
          }
          onSubmit={submit}
        />
      )}
    </Sheet>
  )
}
