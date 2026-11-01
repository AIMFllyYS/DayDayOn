import * as z from 'zod'
import {
  InstantSchema,
  LocalTimeSchema,
  ModuleSchema,
  UserIdSchema,
} from '@/features/shared/schemas'
import { WeightGramsSchema } from '@/features/metric/schemas'

/*
 * 账号、引导、资料、偏好契约（PRD 2.2、2.11、7.1）。D1 实现。
 */

export const THEME_IDS = ['caramel', 'terracotta', 'matcha', 'haze', 'berry'] as const
export const ThemeSchema = z.enum(THEME_IDS, { error: '主题不存在' }).meta({ id: 'Theme' })
export type Theme = z.infer<typeof ThemeSchema>

export const MascotCharacterSchema = z
  .enum(['tuan', 'dun'], { error: '形象不存在' })
  .meta({ id: 'MascotCharacter' })
export type MascotCharacter = z.infer<typeof MascotCharacterSchema>

export const GenderSchema = z.enum(['female', 'male', 'other']).meta({ id: 'Gender' })
export type Gender = z.infer<typeof GenderSchema>

export const RoleSchema = z.enum(['user', 'admin']).meta({ id: 'Role' })
export type Role = z.infer<typeof RoleSchema>

export const NICKNAME_MAX = 12

// C0 / C1 控制字符和 Unicode 行、段分隔符（U+2028、U+2029）
const CONTROL_CHARS = new RegExp('[\u0000-\u001f\u007f-\u009f\u2028\u2029]')

/** 昵称 1–12 个字符：去首尾空白，禁止控制字符和换行，可重名（PRD 2.2） */
export const NicknameSchema = z
  .string()
  .trim()
  .min(1, { error: '起个昵称吧' })
  .refine((s) => [...s].length <= NICKNAME_MAX, { error: `昵称最多 ${NICKNAME_MAX} 个字` })
  .refine((s) => !CONTROL_CHARS.test(s), { error: '昵称不能包含换行或特殊控制字符' })

const MOODS = 'happy|cheer|sleepy|thinking|love|surprised|shy|sad|eating'
const TONES = 'primary|exercise|diet|sleep|study|custom'
/** 预设头像：mascot:<character>:<mood>:<tone>（ADR-0021） */
export const AvatarSchema = z
  .string()
  .regex(new RegExp(`^mascot:(tuan|dun):(${MOODS}):(${TONES})$`), { error: '头像不存在' })
  .meta({ id: 'Avatar' })

/** IANA 时区名；具体是否可用由服务端用 Intl 再验证 */
export const TimeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (tz) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz })
        return true
      } catch {
        return false
      }
    },
    { error: '时区不存在' },
  )

export const BirthYearSchema = z
  .number()
  .int()
  .min(1900, { error: '出生年份不对' })
  .max(2100, { error: '出生年份不对' })
export const HeightCmSchema = z
  .number()
  .int()
  .min(80, { error: '身高应在 80–250 厘米之间' })
  .max(250, { error: '身高应在 80–250 厘米之间' })
export const DayStartHourSchema = z.number().int().min(0).max(6, { error: '日切换时间是 0–6 点' })

// ---------------------------------------------------------------------------
// GET /me
// ---------------------------------------------------------------------------

export const ProfileSchema = z
  .object({
    nickname: z.string().nullable(),
    avatar: z.string().nullable(),
    gender: GenderSchema.nullable(),
    birthYear: z.number().int().nullable(),
    heightCm: z.number().int().nullable(),
    timeZone: z.string(),
  })
  .meta({ id: 'Profile' })
export type Profile = z.infer<typeof ProfileSchema>

export const PreferencesSchema = z
  .object({
    theme: ThemeSchema,
    mascot: MascotCharacterSchema,
    leaderboardOptIn: z.boolean(),
    dayStartHour: z.number().int(),
    /** null 表示不提醒 */
    remindAt: LocalTimeSchema.nullable(),
  })
  .meta({ id: 'Preferences' })
export type Preferences = z.infer<typeof PreferencesSchema>

export const MeSchema = z
  .object({
    userId: UserIdSchema,
    email: z.email(),
    role: RoleSchema,
    /** 管理员是否已开启两步验证 */
    twoFactorEnabled: z.boolean(),
    onboarded: z.boolean(),
    profile: ProfileSchema,
    preferences: PreferencesSchema,
    /** 连续打卡天数（stats.computeStreak） */
    streak: z.number().int().min(0),
    createdAt: InstantSchema,
  })
  .meta({ id: 'Me' })
export type Me = z.infer<typeof MeSchema>

// ---------------------------------------------------------------------------
// POST /me/onboarding（六步一次提交，PRD 2.2、7.1）
// ---------------------------------------------------------------------------

export const OnboardingSchema = z
  .object({
    nickname: NicknameSchema,
    avatar: AvatarSchema.nullable().default(null),
    gender: GenderSchema.nullable().default(null),
    birthYear: BirthYearSchema.nullable().default(null),
    heightCm: HeightCmSchema.nullable().default(null),
    /** 填了就同时写一条体重记录 */
    weightGrams: WeightGramsSchema.nullable().default(null),
    timeZone: TimeZoneSchema.default('Asia/Shanghai'),
    /** 每选一个建一个默认目标（DEFAULT_GOALS） */
    modules: z
      .array(ModuleSchema)
      .min(1, { error: '至少选一个板块' })
      .max(5)
      .refine((m) => new Set(m).size === m.length, { error: '板块不能重复' }),
    leaderboardOptIn: z.boolean().default(false),
    /** 必须为 true：不同意健康数据处理就不能完成引导 */
    healthConsent: z.literal(true, { error: '需要同意健康数据处理才能继续' }),
  })
  .meta({ id: 'Onboarding' })
export type Onboarding = z.infer<typeof OnboardingSchema>
export type OnboardingInput = z.input<typeof OnboardingSchema>

// ---------------------------------------------------------------------------
// PATCH /me/profile、PATCH /me/preferences
// ---------------------------------------------------------------------------

export const UpdateProfileSchema = z
  .object({
    nickname: NicknameSchema,
    avatar: AvatarSchema.nullable(),
    gender: GenderSchema.nullable(),
    birthYear: BirthYearSchema.nullable(),
    heightCm: HeightCmSchema.nullable(),
    /** 改时区只影响之后的打卡（PRD 3） */
    timeZone: TimeZoneSchema,
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, { error: '没有要修改的内容' })
  .meta({ id: 'UpdateProfile' })
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>

export const UpdatePreferencesSchema = z
  .object({
    theme: ThemeSchema,
    mascot: MascotCharacterSchema,
    leaderboardOptIn: z.boolean(),
    dayStartHour: DayStartHourSchema,
    remindAt: LocalTimeSchema.nullable(),
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, { error: '没有要修改的内容' })
  .meta({ id: 'UpdatePreferences' })
export type UpdatePreferences = z.infer<typeof UpdatePreferencesSchema>

/** DELETE /me：输入"注销"二字确认 */
export const DeleteMeSchema = z
  .object({ confirm: z.literal('注销', { error: '请输入"注销"确认' }) })
  .meta({ id: 'DeleteMe' })
export type DeleteMe = z.infer<typeof DeleteMeSchema>

/** GET /me/export：JSON 附件，只含本人数据。各数组元素沿用对应领域的 DTO */
export const ExportSchema = z
  .object({
    exportedAt: InstantSchema,
    me: MeSchema,
    goals: z.array(z.unknown()),
    checkins: z.array(z.unknown()),
    weights: z.array(z.unknown()),
    ratings: z.array(z.unknown()),
    todos: z.array(z.unknown()),
  })
  .meta({ id: 'Export' })
export type Export = z.infer<typeof ExportSchema>
