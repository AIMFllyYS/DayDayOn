import * as z from 'zod'

/*
 * 跨领域的基础 schema（前后端共用）。单位与格式见 api-conventions.md 第 5 节：
 * 时间点是带 Z 的 ISO 字符串、打卡日是 YYYY-MM-DD、时长秒、体重克、热量千卡、金额微元。
 * 所有 DTO 里的时间都是字符串，不是 Date（client-data-and-forms.md 第 1 节）。
 */

export const MODULES = ['exercise', 'diet', 'sleep', 'study', 'custom'] as const
export const ModuleSchema = z.enum(MODULES, { error: '板块不存在' }).meta({ id: 'Module' })
export type Module = z.infer<typeof ModuleSchema>

/** 业务 id：uuidv7 字符串 */
export const IdSchema = z.uuid({ error: 'id 格式不对' })

/** Better Auth 的用户 id 是任意字符串 */
export const UserIdSchema = z.string().min(1)

/** 时间点：ISO 8601 UTC，带 Z */
export const InstantSchema = z.iso.datetime({ error: '时间格式不对' })
export type Instant = z.infer<typeof InstantSchema>

/** 打卡日 / 本地日期：YYYY-MM-DD */
export const LocalDateSchema = z.iso.date({ error: '日期格式不对' })
export type LocalDate = z.infer<typeof LocalDateSchema>

/** 本地时分：HH:mm（计划时间、提醒时间、睡眠表单） */
export const LocalTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: '时间格式应为 HH:mm' })
export type LocalTime = z.infer<typeof LocalTimeSchema>

/** 月键：YYYY-MM */
export const MonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: '月份格式应为 YYYY-MM' })

/** ISO 星期：1 = 周一 … 7 = 周日 */
export const WeekdaySchema = z.number().int().min(1).max(7)
export const WeekdaysSchema = z
  .array(WeekdaySchema)
  .min(1, { error: '至少选一天' })
  .max(7)
  .refine((d) => new Set(d).size === d.length, { error: '星期不能重复' })
export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

/** 满意度 1–5（Rating 组件） */
export const RatingValueSchema = z
  .number()
  .int()
  .min(1, { error: '评分 1–5' })
  .max(5, { error: '评分 1–5' })

/** 满意度的范围：今日心情 overall 或某个板块（PRD 2.5） */
export const RatingScopeSchema = z
  .enum(['overall', ...MODULES], { error: '评分范围不存在' })
  .meta({ id: 'RatingScope' })
export type RatingScope = z.infer<typeof RatingScopeSchema>

/** 金额：整数微元 */
export const MicrosSchema = z.number().int()

/** 游标分页查询参数（api-conventions.md 第 10 节） */
export const CursorQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type CursorQuery = z.infer<typeof CursorQuerySchema>

/** 偏移分页查询参数（后台表格） */
export const OffsetQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type OffsetQuery = z.infer<typeof OffsetQuerySchema>

/** 游标分页响应：{ items, nextCursor } */
export function cursorPage<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() })
}
export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
}

/** 偏移分页响应：{ items, total } */
export function offsetPage<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), total: z.number().int().min(0) })
}
export interface OffsetPage<T> {
  items: T[]
  total: number
}

/** 公开的用户卡片：只含昵称和头像（排行、动态） */
export const PublicUserSchema = z
  .object({
    userId: UserIdSchema,
    nickname: z.string(),
    /** 预设头像标识 mascot:<character>:<mood>:<tone>；null 显示昵称首字 */
    avatar: z.string().nullable(),
  })
  .meta({ id: 'PublicUser' })
export type PublicUser = z.infer<typeof PublicUserSchema>
