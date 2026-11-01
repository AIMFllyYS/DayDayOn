'use client'

import { useState } from 'react'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { toast } from '@/components/ui/toast'
import { errorMessage, isApiError } from '@/lib/api'
import { usePutRating } from '@/lib/api/queries/metrics'

/*
 * 今日心情（PRD 2.5）：1–5 分，同一天再评就覆盖。点下去即保存（乐观更新），
 * 留一点时间让评分的情绪反馈播完再回到列表。
 */

const BACK_DELAY_MS = 900

export function MoodPanel({ value, onSaved }: { value: number | null; onSaved: () => void }) {
  const [picked, setPicked] = useState<RatingValue | null>((value as RatingValue | null) ?? null)
  const put = usePutRating()

  function pick(v: RatingValue) {
    setPicked(v)
    put.mutate(
      { scope: 'overall', value: v },
      {
        onSuccess: () => window.setTimeout(onSaved, BACK_DELAY_MS),
        onError: (e) => {
          setPicked((value as RatingValue | null) ?? null)
          toast.error(isApiError(e) ? errorMessage(e) : '出了点小状况，稍后再试试')
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      <Rating
        value={picked}
        onValueChange={pick}
        label="今日心情"
        tone="primary"
        className="justify-between"
      />
      <p className="text-tiny text-muted">只能评今天，再评一次会覆盖</p>
    </div>
  )
}
