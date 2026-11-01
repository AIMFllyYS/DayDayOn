import 'server-only'
import type { WeightEntry } from '@/features/metric/schemas'
import type { LocalDate } from '@/features/shared/schemas'
import type { Tx } from '@/server/db/client'

export interface UpsertWeightOptions {
  /** 测量时刻（通常为 now） */
  measuredAt: Date
  /** true 跳过 3 kg 变化确认（PUT 带 confirmLargeChange，或引导首次记录） */
  confirmLargeChange: boolean
}

/**
 * 写某个打卡日的体重，已有就覆盖（body_metrics 唯一 (userId, localDate)）。
 * 与上一条（早于 localDate 的最近一条）相差超过 3 kg 且未确认时
 * 抛 ApiError('WEIGHT_CHANGE_UNCONFIRMED', …, { previousWeightGrams })。
 * 签名 F1，实现 D3（PRD 2.5、7.2）；D1 引导在同一事务里调用。
 */
export async function upsertWeight(
  tx: Tx,
  userId: string,
  localDate: LocalDate,
  grams: number,
  opts: UpsertWeightOptions,
): Promise<WeightEntry> {
  void tx
  void userId
  void localDate
  void grams
  void opts
  throw new Error('not implemented: D3')
}
