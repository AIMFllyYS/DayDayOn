import 'server-only'

// 每日指标 service 的对外入口（PRD 2.5、7.2）
export { latestWeightGrams, putWeight, upsertWeight, weightTrend } from './weight'
export type { UpsertWeightOptions } from './weight'
export { putRating } from './ratings'
