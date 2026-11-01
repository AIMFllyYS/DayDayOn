'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'
import { moduleMeta } from '@/components/ui/tone'
import type { Module } from '@/features/shared/schemas'
import { errorMessage, isApiError, newIdempotencyKey } from '@/lib/api'
import { useCreateGoal } from '@/lib/api/queries/goals'
import { DEFAULT_GOALS } from '../defaults'
import { serverFormErrors, type GoalFormErrors } from '../form-errors'
import type { CreateGoal } from '../schemas'
import { GoalForm } from './goal-form'
import { ModulePicker } from './module-picker'

/**
 * /goals/new：先选板块（?module=），再填表单。表单预填 DEFAULT_GOALS。
 * 板块放在 URL 里：返回键回到选板块这一步。
 */
export function NewGoalView({ module }: { module: Module | null }) {
  if (module === null) {
    return (
      <div className="flex flex-col gap-3 pb-8">
        <p className="text-body text-muted">想在哪方面坚持？选一个板块开始</p>
        <ModulePicker hrefFor={(m) => `/goals/new?module=${m}`} />
      </div>
    )
  }
  // key：换板块时整份表单重置为该板块的默认值
  return <NewGoalForm key={module} module={module} />
}

function NewGoalForm({ module }: { module: Module }) {
  const router = useRouter()
  const create = useCreateGoal()
  const [serverErrors, setServerErrors] = useState<GoalFormErrors>()
  // 同一份表单内容重试时复用幂等键；内容改了就换一个新键
  const [attempt, setAttempt] = useState<{ body: string; key: string }>()
  const defaults = DEFAULT_GOALS[module]
  const meta = moduleMeta[module]

  function submit(input: CreateGoal) {
    const body = JSON.stringify(input)
    const key = attempt?.body === body ? attempt.key : newIdempotencyKey()
    setAttempt({ body, key })
    create.mutate(
      { input, idempotencyKey: key },
      {
        onSuccess: (goal) => {
          toast.success('目标定好了，今天就开始吧')
          router.replace(`/goals/${goal.id}`)
        },
        onError: (e) => {
          if (isApiError(e) && e.code === 'VALIDATION_FAILED' && e.fields) {
            setServerErrors(serverFormErrors(e.fields))
          }
          toast.error(isApiError(e) ? errorMessage(e) : errorMessage({ code: 'INTERNAL' }))
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-8 @xl:max-w-2xl">
      <Card variant="outline" className="flex items-center gap-3">
        <IconTile icon={meta.icon} tone={module} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="text-tiny text-muted block font-semibold">板块</span>
          <span className="text-subhead block font-bold">{meta.label}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => router.replace('/goals/new')}>
          换一个
        </Button>
      </Card>
      <GoalForm
        id="new-goal"
        module={module}
        initial={{
          title: defaults.title,
          description: null,
          target: defaults.target,
          weekdays: defaults.weekdays,
          plannedTime: null,
          fields: defaults.fields,
        }}
        serverErrors={serverErrors}
        onSubmit={submit}
      >
        <Button
          type="submit"
          size="lg"
          loading={create.isPending}
          className="mt-2 w-full @md:w-auto @md:self-start"
        >
          创建目标
        </Button>
      </GoalForm>
    </div>
  )
}
