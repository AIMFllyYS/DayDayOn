import * as z from 'zod'
import { LocalDateSchema, ModuleSchema } from '@/features/shared/schemas'

/*
 * 板块近况（主页「各板块近况」、目标详情、Agent 的 showStats 工具共用一份数据）。
 * 每个进行中的目标一条，统计最近 days 天（含今天）。只回原始数（秒、分、分钟数），
 * 单位换算和文案在界面层做（api-conventions.md 第 5 节）。
 */

export const InsightDaysSchema = z.union([z.literal(7), z.literal(30)])
export type InsightDays = z.infer<typeof InsightDaysSchema>

export const InsightPointSchema = z.object({
  date: LocalDateSchema,
  /** 按板块：饮食 = 当天平均分；运动 / 学习 / 睡眠 = 秒；自定义 = 当天达标次数。没有记录为 null */
  value: z.number().nullable(),
})

export const GoalInsightSchema = z
  .object({
    goalId: z.string(),
    module: ModuleSchema,
    title: z.string(),
    /** 统计范围内的打卡条数 / 达标条数（未达标的只存档，不计进度） */
    total: z.number().int().min(0),
    valid: z.number().int().min(0),
    /** 有达标打卡的天数 */
    validDays: z.number().int().min(0),
    /** 饮食：有分数的餐的平均分与有效线 */
    avgScore: z.number().nullable(),
    passScore: z.number().nullable(),
    /** 运动、学习：达标记录的累计时长（秒）；学习另给每天的专注下限 */
    totalSeconds: z.number().int().min(0),
    dailyTargetSeconds: z.number().int().nullable(),
    /** 运动消耗合计（千卡）；饮食每餐平均摄入（千卡） */
    kcal: z.number().nullable(),
    /** 睡眠：平均时长（秒）、平均入睡时刻（从 0 点起的分钟，0–1439）、晚于红线的晚数、红线、最少时长（秒） */
    avgSleepSeconds: z.number().int().nullable(),
    avgBedMinutes: z.number().int().min(0).max(1439).nullable(),
    lateNights: z.number().int().nullable(),
    bedtimeBy: z.string().nullable(),
    minSleepSeconds: z.number().int().nullable(),
    series: z.array(InsightPointSchema),
    /** 最常没通过的一条规则（逐项核验里 ok = false 出现最多的） */
    topFailure: z
      .object({ text: z.string(), count: z.number().int(), of: z.number().int() })
      .nullable(),
    /** 设了期限的目标：期限日与剩余天数（过期为 0） */
    deadline: z.object({ date: LocalDateSchema, daysLeft: z.number().int().min(0) }).nullable(),
  })
  .meta({ id: 'GoalInsight' })
export type GoalInsight = z.infer<typeof GoalInsightSchema>

export const InsightsSchema = z
  .object({
    localDate: LocalDateSchema,
    days: InsightDaysSchema,
    items: z.array(GoalInsightSchema),
  })
  .meta({ id: 'Insights' })
export type Insights = z.infer<typeof InsightsSchema>
