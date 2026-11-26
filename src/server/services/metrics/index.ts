import 'server-only'

// 每日指标 service 的对外入口（PRD 2.5、7.2）
export { deleteWeight, latestWeightGrams, putWeight, upsertWeight, weightTrend } from './weight'
export type { UpsertWeightOptions } from './weight'
export { deleteRating, putRating, ratingTrend } from './ratings'
export { deleteSteps, putSteps, stepTrend, upsertSteps } from './steps'
export { listMetricHistory, metricCalendar } from './history'
