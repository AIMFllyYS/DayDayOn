'use client'

import { useRef, useState } from 'react'
import type { FormErrors } from '@/components/ui/form'
import { formatYuan } from '@/features/agent/format'
import { errorMessage, isApiError, newIdempotencyKey, useQuery } from '@/lib/api'
import { aiRunsQuery, quotaQuery, useRedeemCode } from '@/lib/api/queries/quota'
import { RedeemSchema } from '../schemas'
import { QuotaCardView, type LoadState } from './quota-card-view'

/*
 * 「我的」页额度卡（PRD 2.7）：GET /me/quota、GET /me/ai-runs、POST /redeem-codes/redeem。D1 的我的页嵌入。
 */

function loadState<T>(q: {
  status: 'pending' | 'error' | 'success'
  data: T | undefined
  error: unknown
  refetch: () => unknown
  isRefetching: boolean
}): LoadState<T> {
  if (q.status === 'success' && q.data !== undefined) return { status: 'success', data: q.data }
  if (q.status === 'error') {
    return {
      status: 'error',
      message: isApiError(q.error)
        ? errorMessage(q.error.body)
        : errorMessage({ code: 'INTERNAL' }),
      onRetry: () => void q.refetch(),
      retrying: q.isRefetching,
    }
  }
  return { status: 'pending' }
}

export function QuotaCard() {
  const quota = useQuery(quotaQuery())
  const [runsWanted, setRunsWanted] = useState(false)
  const runs = useQuery({ ...aiRunsQuery(), enabled: runsWanted })
  const redeem = useRedeemCode()
  const [errors, setErrors] = useState<FormErrors>()
  const [successText, setSuccessText] = useState<string>()
  // 同一个码重复提交（网络重试）复用同一个键；换了码换键
  const attempt = useRef<{ code: string; key: string } | null>(null)

  function submit(raw: string) {
    setSuccessText(undefined)
    const parsed = RedeemSchema.safeParse({ code: raw })
    if (!parsed.success) {
      setErrors({ code: parsed.error.issues.map((i) => i.message) })
      return
    }
    const code = parsed.data.code
    if (attempt.current?.code !== code) attempt.current = { code, key: newIdempotencyKey() }
    setErrors(undefined)
    redeem.mutate(
      { body: { code }, idempotencyKey: attempt.current.key },
      {
        onSuccess: (r) => {
          attempt.current = null
          setSuccessText(`兑换好了，加购余额多了 ${formatYuan(r.addedMicros)}`)
        },
        onError: (e) => {
          // 失败也换键：同一个键重放只会拿到同样的错误
          attempt.current = null
          if (isApiError(e) && e.fields) setErrors(e.fields)
          else
            setErrors({
              code: isApiError(e) ? errorMessage(e.body) : errorMessage({ code: 'INTERNAL' }),
            })
        },
      },
    )
  }

  return (
    <QuotaCardView
      quota={loadState(quota)}
      runs={loadState({ ...runs, data: runs.data?.items })}
      onRunsOpen={() => {
        if (runsWanted) void runs.refetch()
        else setRunsWanted(true)
      }}
      redeem={{
        pending: redeem.isPending,
        errors,
        onSubmit: submit,
        onReset: () => {
          setErrors(undefined)
          setSuccessText(undefined)
        },
        successText,
      }}
    />
  )
}
