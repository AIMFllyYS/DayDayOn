/*
 * AI 草稿卡的可编辑条目（PRD 2.6）。纯数据与纯函数，不依赖具体领域：
 * 饮食识别把 DietDraftItem 映射成这里的条目（features/diet/draft.ts），确认时再映射回接口的 DietItem。
 */

export interface DraftItem {
  /** 前端临时 id（列表 key、错误索引），不提交 */
  id: string
  name: string
  portion: string
  /** 千卡；null = 不知道 */
  kcal: number | null
  /** AI 给的参考说明，例如"AI 估 240–280 kcal"；用户改过后仍保留 */
  hint?: string
}

export interface DraftItemErrors {
  name?: string
  portion?: string
  kcal?: string
}

let seq = 0

/** 新条目的临时 id：只需在本页唯一 */
export function draftItemId(): string {
  seq += 1
  return `draft-${Date.now().toString(36)}-${seq}`
}

export function emptyDraftItem(): DraftItem {
  return { id: draftItemId(), name: '', portion: '', kcal: null }
}

/** 合计热量：没填的按 0 */
export function draftItemsTotal(items: readonly Pick<DraftItem, 'kcal'>[]): number {
  return items.reduce((sum, i) => sum + (i.kcal ?? 0), 0)
}
