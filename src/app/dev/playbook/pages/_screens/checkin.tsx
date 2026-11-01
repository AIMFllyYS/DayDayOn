'use client'

import { useState } from 'react'
import type { RatingValue } from '@/components/ui/rating'
import { CheckinScreen as CheckinScreenView } from '@/features/checkin/components/checkin-screen'
import type { CheckinGoal } from '@/features/checkin/components/form-types'
import type { GoalProgress } from '@/features/checkin/schemas'

/*
 * 打卡表单（/goals/[goalId]/checkin）：渲染正式组件 CheckinScreen（D3），数据是演示用的。
 * 提交不发请求：直接返回一个"完成了 2 / 3 餐"的进度，用来看盖章 + 团团欢呼。
 */

const demoGoal: CheckinGoal = {
  id: '00000000-0000-7000-8000-000000000001',
  module: 'diet',
  title: '好好吃饭',
  target: { kind: 'count', value: 3 },
  fields: null,
  fieldVersion: null,
}

export function CheckinScreen() {
  const [rating, setRating] = useState<RatingValue | null>(null)
  const [progress, setProgress] = useState<GoalProgress>({ value: 1, target: 3, done: false })
  const next = () => {
    const p = { value: Math.min(3, progress.value + 1), target: 3, done: progress.value + 1 >= 3 }
    setProgress(p)
    return Promise.resolve({ localDate: '2026-11-01', progress: p })
  }
  return (
    <CheckinScreenView
      goal={demoGoal}
      today="2026-11-01"
      progress={progress}
      clock={{ timeZone: 'Asia/Shanghai', dayStartHour: 4 }}
      rating={rating}
      onRate={setRating}
      onSubmit={next}
      onAiConfirmed={next}
      toFormErrors={() => undefined}
    />
  )
}
