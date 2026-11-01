import * as z from 'zod'
import { TodayGoalSchema } from '@/features/checkin/schemas'
import { WeightTrendSchema } from '@/features/metric/schemas'
import { FeedItemSchema } from '@/features/rank/schemas'
import { LocalDateSchema, ModuleSchema, RatingValueSchema } from '@/features/shared/schemas'

/*
 * 主页仪表盘契约（PRD 2.8、7.1、7.2）。D4 实现；一次 GET /dashboard/today 取齐。
 */

/** 热力图一格：0..1（stats.heatmapCell） */
export const HeatmapCellSchema = z.number().min(0).max(1)

/** 本周热力图：周一到周日 × 五个板块 */
export const WeekHeatmapSchema = z
  .object({
    /** 本周七天的打卡日，周一起 */
    days: z.array(LocalDateSchema).length(7),
    rows: z.array(
      z.object({
        module: ModuleSchema,
        /** 与 days 一一对应；今天之后的格子为 0 */
        cells: z.array(HeatmapCellSchema).length(7),
      }),
    ),
  })
  .meta({ id: 'WeekHeatmap' })
export type WeekHeatmap = z.infer<typeof WeekHeatmapSchema>

/** 打卡提醒（PRD 7.1）：过了提醒时间、今天还有计划目标没完成时才有 */
export const ReminderSchema = z
  .object({ remaining: z.number().int().min(1) })
  .meta({ id: 'Reminder' })
export type Reminder = z.infer<typeof ReminderSchema>

export const DashboardTodaySchema = z
  .object({
    localDate: LocalDateSchema,
    /** 1 今日总览：完成的目标数 / 今天计划的目标数 */
    completion: z.object({ done: z.number().int(), planned: z.number().int() }),
    streak: z.number().int().min(0),
    /** 没有任何进行中目标时为 false，显示空状态 */
    hasGoals: z.boolean(),
    /** 2 今日进度：今天计划内的目标 */
    goals: z.array(TodayGoalSchema),
    /** 3 体重卡：最近 30 天 */
    weight: WeightTrendSchema,
    /** 3 今日心情，没记为 null */
    mood: RatingValueSchema.nullable(),
    /** 4 本周热力图 */
    heatmap: WeekHeatmapSchema,
    /** 5 榜单动态：最近 24 小时最多 10 条 */
    feed: z.array(FeedItemSchema),
    /** 没设提醒、未到时间或都完成了为 null */
    reminder: ReminderSchema.nullable(),
  })
  .meta({ id: 'DashboardToday' })
export type DashboardToday = z.infer<typeof DashboardTodaySchema>
