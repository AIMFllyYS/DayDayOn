import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateCheckinInput, CreateCheckinResult, MealType } from '@/features/checkin/schemas'
import type { DietRecognitionResult } from '@/features/diet/schemas'
import { apiFetch } from '../fetcher'
import { afterCheckinChange, keys } from '../keys'

/*
 * AI 识别的写操作（PRD 2.6、7.3）。D6。
 * 识别结果是草稿，不进查询缓存；确认时调普通创建打卡接口（source: 'ai'、aiRunId）。
 * D3 的 queries/checkins.ts 在 2659b27 还不存在，确认打卡先在这里经 apiFetch 调用；集成后可改用 D3 的 mutation。
 */

export interface RecognizeDietVariables {
  /** 浏览器压缩后的 JPEG */
  image: Blob
  mealType?: MealType
  note?: string
  /** 每次选图生成一个，重试时复用 */
  idempotencyKey: string
}

export function useRecognizeDiet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ image, mealType, note, idempotencyKey }: RecognizeDietVariables) => {
      const form = new FormData()
      form.append('image', image, 'meal.jpg')
      if (mealType) form.append('mealType', mealType)
      if (note) form.append('note', note)
      return apiFetch<DietRecognitionResult>('/ai/diet-recognitions', {
        method: 'POST',
        form,
        idempotencyKey,
      })
    },
    // 成功、失败（422 已扣费）都可能改变额度
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.me.all }),
  })
}

export interface ConfirmDietCheckinVariables {
  goalId: string
  body: Extract<CreateCheckinInput, { module: 'diet' }>
  idempotencyKey: string
}

export function useConfirmDietCheckin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ goalId, body, idempotencyKey }: ConfirmDietCheckinVariables) =>
      apiFetch<CreateCheckinResult>(`/goals/${encodeURIComponent(goalId)}/checkins`, {
        method: 'POST',
        json: body,
        idempotencyKey,
      }),
    onSettled: async () => {
      await Promise.all(
        afterCheckinChange.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
    },
  })
}
