'use client'

import { useRef, useState } from 'react'
import { toast } from '@/components/ui/toast'
import type { DraftItem, DraftItemErrors } from '@/features/agent/draft'
import type { Checkin, MealType } from '@/features/checkin/schemas'
import { errorMessage, isApiError, newIdempotencyKey } from '@/lib/api'
import { useConfirmDietCheckin, useRecognizeDiet } from '@/lib/api/queries/ai'
import { compressImage } from '@/lib/image'
import { buildDietCheckin, draftToItems } from '../draft'
import type { DietRecognitionResult } from '../schemas'
import { DietRecognizerView, type RecognizerPhase } from './diet-recognizer-view'

export interface DietRecognizerProps {
  /** 要记到哪个饮食目标 */
  goalId: string
  /** 餐次：随识别请求带上，确认时写进打卡 */
  mealType: MealType
  /** 用户在草稿卡点"确认记录"、创建打卡成功后回调（D3 显示盖章） */
  onConfirmed: (checkin: Checkin) => void
  /** 降级为手动填写（识别失败、超时、AI 暂停时的"手动填写"按钮） */
  onManual?: () => void
}

/**
 * 值得用同一个幂等键重试的失败：网络错误、5xx、限流、上一次还在处理。
 * AI 暂停、额度不足只给手动填写；其余 4xx（图片不合法、识别失败已扣费）重放只会得到同样的结果，换图再试。
 */
function isRetryable(e: unknown): boolean {
  if (!isApiError(e)) return true
  if (e.code === 'AI_PAUSED') return false
  return e.status >= 500 || e.code === 'RATE_LIMITED' || e.code === 'REQUEST_IN_PROGRESS'
}

async function compress(file: File): Promise<Blob> {
  return (await compressImage(file)).blob
}

/**
 * 饮食拍照识别（PRD 2.6、7.3）：ImagePicker → 压缩 → POST /ai/diet-recognitions → AiDraftCard 逐项编辑 →
 * POST /goals/{goalId}/checkins（source: 'ai'、aiRunId）。不 import ai、@ai-sdk/react。
 * 图片只在内存里：压缩后的 Blob 只交给 ImagePicker 预览和这一次请求，不进任何缓存。
 */
export function DietRecognizer({ goalId, mealType, onConfirmed, onManual }: DietRecognizerProps) {
  const recognize = useRecognizeDiet()
  const confirm = useConfirmDietCheckin()
  const [phase, setPhase] = useState<RecognizerPhase>('idle')
  const [result, setResult] = useState<DietRecognitionResult | null>(null)
  const [items, setItems] = useState<DraftItem[]>([])
  const [itemErrors, setItemErrors] = useState<Record<string, DraftItemErrors>>()
  const [formError, setFormError] = useState<string>()
  const [failure, setFailure] = useState<{ text: string; retryable: boolean }>()
  const [durationMs, setDurationMs] = useState<number>()
  // 同一张图重试复用同一个键；换图换键
  const pending = useRef<{ image: Blob; key: string } | null>(null)
  // 只处理最后一次请求的结果
  const seq = useRef(0)
  const confirmKey = useRef<string | null>(null)

  function reset() {
    seq.current++
    pending.current = null
    confirmKey.current = null
    setPhase('idle')
    setResult(null)
    setItems([])
    setItemErrors(undefined)
    setFormError(undefined)
    setFailure(undefined)
    setDurationMs(undefined)
  }

  function run() {
    const job = pending.current
    if (!job) return
    const mine = ++seq.current
    const startedAt = performance.now()
    setPhase('recognizing')
    setFailure(undefined)
    recognize.mutate(
      { image: job.image, mealType, idempotencyKey: job.key },
      {
        onSuccess: (r) => {
          if (mine !== seq.current) return
          setDurationMs(performance.now() - startedAt)
          setResult(r)
          setItems(draftToItems(r.draft))
          setItemErrors(undefined)
          setFormError(undefined)
          confirmKey.current = null
          setPhase('draft')
        },
        onError: (e) => {
          if (mine !== seq.current) return
          setDurationMs(performance.now() - startedAt)
          setFailure({
            text: isApiError(e) ? errorMessage(e.body) : errorMessage({ code: 'INTERNAL' }),
            retryable: isRetryable(e),
          })
          setPhase('failed')
        },
      },
    )
  }

  function handleImage(image: Blob) {
    pending.current = { image, key: newIdempotencyKey() }
    run()
  }

  function handleItemsChange(next: DraftItem[]) {
    setItems(next)
    setItemErrors(undefined)
    setFormError(undefined)
  }

  function handleConfirm() {
    if (!result) return
    const built = buildDietCheckin({
      items,
      mealType,
      aiRunId: result.aiRunId,
      summary: result.draft.summary,
    })
    if (!built.ok) {
      setItemErrors(Object.keys(built.errors).length > 0 ? built.errors : undefined)
      setFormError(built.formError)
      return
    }
    confirmKey.current ??= newIdempotencyKey()
    confirm.mutate(
      { goalId, body: built.body, idempotencyKey: confirmKey.current },
      {
        onSuccess: (r) => {
          confirmKey.current = null
          onConfirmed(r.checkin)
        },
        onError: (e) => {
          if (isApiError(e) && e.code === 'VALIDATION_FAILED') {
            setFormError(errorMessage(e.body))
            return
          }
          toast.error(isApiError(e) ? errorMessage(e.body) : errorMessage({ code: 'INTERNAL' }))
        },
      },
    )
  }

  return (
    <DietRecognizerView
      mealType={mealType}
      phase={phase}
      compress={compress}
      onImage={handleImage}
      onClear={reset}
      durationMs={durationMs}
      errorText={failure?.text}
      retryable={failure?.retryable}
      onRetry={run}
      confidence={result?.draft.confidence}
      summary={result?.draft.summary}
      items={items}
      itemErrors={itemErrors}
      formError={formError}
      onItemsChange={handleItemsChange}
      onConfirm={handleConfirm}
      confirming={confirm.isPending}
      onManual={onManual}
    />
  )
}
