'use client'

import type { Checkin, MealType } from '@/features/checkin/schemas'
import { PendingCard } from '@/features/shared/components/pending-card'

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
 * 饮食拍照识别（PRD 2.6、7.3）：ImagePicker → 压缩 → POST /ai/diet-recognitions → AiDraftCard 逐项编辑 →
 * POST /goals/{goalId}/checkins（source: 'ai'、aiRunId）。不 import ai、@ai-sdk/react。
 * props F1 定；实现 D6；D3 的饮食打卡表单嵌入。
 */
export function DietRecognizer({ goalId, mealType, onConfirmed, onManual }: DietRecognizerProps) {
  void goalId
  void mealType
  void onConfirmed
  void onManual
  return <PendingCard title="拍照识别" owner="D6" />
}
