import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateCheckinInput, CreateCheckinResult, MealType } from '@/features/checkin/schemas'
import type { SmartRecognitionResult } from '@/features/checkin/smart-schemas'
import type { DietRecognitionResult } from '@/features/diet/schemas'
import type { Module } from '@/features/shared/schemas'
import { apiFetch } from '../fetcher'
import { afterCheckinChange, keys } from '../keys'

/*
 * AI 识别的写操作（PRD 2.6、7.3 + 全板块智能识别）。
 * 识别结果是草稿，不进查询缓存；确认时调普通创建打卡接口（source: 'ai'、aiRunId）。
 */

export interface RecognizeDietVariables {
  /** 浏览器压缩后的首张 JPEG */
  image: Blob
  /** 可选第 2 张浏览器压缩后的 JPEG（支持同时上传 2 张） */
  image2?: Blob
  mealType?: MealType
  note?: string
  /** 每次选图生成一个，重试时复用 */
  idempotencyKey: string
}

export function useRecognizeDiet() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ image, image2, mealType, note, idempotencyKey }: RecognizeDietVariables) => {
      const form = new FormData()
      form.append('image', image, 'meal.jpg')
      if (image2) form.append('image2', image2, 'meal-2.jpg')
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

export interface RecognizeSmartVariables {
  /** 浏览器压缩后的首张 JPEG（上传图片时传） */
  image?: Blob
  /** 可选第 2 张浏览器压缩后的 JPEG（支持同时上传 2 张） */
  image2?: Blob
  /** 纯文本或 HTML 提纯后的文本内容（上传文本附件时传） */
  textContent?: string
  /** 已知打卡板块（在单板块打卡页内使用智能拍照/上传时传） */
  hintModule?: Module
  /** 已知目标 ID */
  goalId?: string
  note?: string
  idempotencyKey: string
}

export function useRecognizeSmart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      image,
      image2,
      textContent,
      hintModule,
      goalId,
      note,
      idempotencyKey,
    }: RecognizeSmartVariables) => {
      const form = new FormData()
      if (image) form.append('image', image, 'smart.jpg')
      if (image2) form.append('image2', image2, 'smart-2.jpg')
      if (textContent) form.append('textContent', textContent)
      if (hintModule) form.append('hintModule', hintModule)
      if (goalId) form.append('goalId', goalId)
      if (note) form.append('note', note)
      return apiFetch<SmartRecognitionResult>('/ai/smart-recognitions', {
        method: 'POST',
        form,
        idempotencyKey,
      })
    },
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
