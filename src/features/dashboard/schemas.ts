import * as z from 'zod'
import { TodayGoalSchema } from '@/features/checkin/schemas'
import { StepTrendSchema, WeightTrendSchema } from '@/features/metric/schemas'
import { FeedItemSchema } from '@/features/rank/schemas'
import { LocalDateSchema, ModuleSchema, RatingValueSchema } from '@/features/shared/schemas'

/*
 * 主页仪表盘契约（PRD 2.8、7.1、7.2）。D4 实现；一次 GET /dashboard/today 取齐。
 */

/** 热力图一格：0..1（stats.heatmapCell） */
export const HeatmapCellSchema = z.number().min(0).max(1)

/** 本周热力图：周一到周日 × 当前活跃板块 */
export const WeekHeatmapSchema = z
  .object({
    /** 本周七天的打卡日，周一起 */
    days: z.array(LocalDateSchema).length(7),
    rows: z.array(
      z.object({
        module: ModuleSchema,
        /** 与 days 一一对应；今天之后的格子为 0 */
        cells: z.array(HeatmapCellSchema).length(7),
        /** 与 days 一一对应：那天打了卡但都没达标（只存档）。格子显示为「打了没达标」，和「没打」区分开 */
        archived: z.array(z.boolean()).length(7).optional(),
        /** 与 days 一一对应：该板块当天处于用户有效打卡范围内（含实际打卡/补卡）；false 表示周期未开始、已过截止或非计划日 */
        inRange: z.array(z.boolean()).length(7).optional(),
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

/** 总打卡周期进度（主页首卡总览环：已打卡天数 / 目标坚持天数） */
export const OverallProgressSchema = z
  .object({
    /** 当前进行中目标的去重有效打卡天数 */
    checkedDays: z.number().int().min(0),
    /** 目标坚持天数（已设截止日期按 起始→截止总天数；未设则按 7/14/21/30… 阶段里程碑） */
    targetDays: z.number().int().min(1),
    /** 周期起始打卡日（最早进行中目标建立日）；无目标时为 null */
    startDate: LocalDateSchema.nullable(),
    /** 最晚截止日期；null 表示暂未设固定周期 */
    deadlineDate: LocalDateSchema.nullable(),
    /** 是否显式设定了目标截止日期 */
    hasDeadline: z.boolean(),
  })
  .meta({ id: 'OverallProgress' })
export type OverallProgress = z.infer<typeof OverallProgressSchema>

export const DashboardTodaySchema = z
  .object({
    localDate: LocalDateSchema,
    /** 用户时区（IANA），动态里的时刻按它显示 */
    timeZone: z.string(),
    /** 1 今日总览：完成的目标数 / 今天计划的目标数 */
    completion: z.object({ done: z.number().int(), planned: z.number().int() }),
    streak: z.number().int().min(0),
    /** 1 总坚持进度：已打卡天数 / 目标坚持天数 */
    overall: OverallProgressSchema.optional(),
    /** 没有任何进行中目标时为 false，显示空状态 */
    hasGoals: z.boolean(),
    /** 2 今日进度：今天计划内的目标 */
    goals: z.array(TodayGoalSchema),
    /** 3 体重卡：最近 30 天 */
    weight: WeightTrendSchema,
    /** 3 今日心情，没记为 null */
    mood: RatingValueSchema.nullable(),
    /** 3 今日步数卡（无记录或纯网页端恒为 todaySteps: 0，绝不报错） */
    steps: StepTrendSchema.default({
      todaySteps: 0,
      entries: [],
      latest: null,
      deltaSteps7d: null,
    }),
    /** 4 本周热力图 */
    heatmap: WeekHeatmapSchema,
    /** 5 榜单动态：最近 24 小时最多 10 条 */
    feed: z.array(FeedItemSchema),
    /** 没设提醒、未到时间或都完成了为 null */
    reminder: ReminderSchema.nullable(),
  })
  .meta({ id: 'DashboardToday' })
export type DashboardToday = z.infer<typeof DashboardTodaySchema>
