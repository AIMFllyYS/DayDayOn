import { boolean, pgTable, smallint, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { id, timestamps, timestamptz } from './columns'

/** 用户资料与偏好（PRD 4、7.1）。注册时由 P1 的 databaseHooks 建行，引导只做 UPDATE */
export const profiles = pgTable(
  'profiles',
  {
    ...id,
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // 可空：引导完成前为空（PRD 7.1）
    nickname: text(),
    // 可空：跳过头像时显示昵称首字。格式 mascot:<character>:<mood>:<tone>（ADR-0021）
    avatar: text(),
    // 可空：基础资料全部可选
    gender: text().$type<'female' | 'male' | 'other'>(),
    // 可空：基础资料可选
    birthYear: smallint(),
    // 可空：基础资料可选
    heightCm: smallint(),
    timeZone: text().notNull().default('Asia/Shanghai'),
    dayStartHour: smallint().notNull().default(4),
    leaderboardOptIn: boolean().notNull().default(false),
    // 可空：引导最后一步才同意（PRD 7.1）
    healthConsentAt: timestamptz(),
    // 可空：引导是否完成只看这一列（PRD 7.1）
    onboardedAt: timestamptz(),
    theme: text().notNull().default('caramel'),
    mascot: text().$type<'tuan' | 'dun'>().notNull().default('tuan'),
    // 可空：为空表示不提醒（PRD 7.1），值为 HH:mm
    remindAt: text(),
    // 可空：本地开发没有 x-real-ip 时记 127.0.0.1，老数据可能为空
    signupIp: text(),
    // 可空：注册后尚未产生会话时为空
    lastLoginIp: text(),
    ...timestamps,
  },
  (t) => [uniqueIndex('profiles_user_id_key').on(t.userId)],
)
