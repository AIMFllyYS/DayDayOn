import { boolean, pgTable, smallint, text, uniqueIndex } from 'drizzle-orm/pg-core'
import type { RefereeTier } from '../../../features/referee/schemas'
import { user } from './auth'
import { id, timestamps, timestamptz } from './columns'

export type RemindMode = 'off' | 'in-app' | 'native'

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
    mascot: text().$type<'tuan' | 'dun' | 'mian' | 'you'>().notNull().default('tuan'),
    /** 个人体质档位：饮食裁判按它调整扣分权重（checkin-modules.md 第 3.1 节） */
    refereeTier: text().$type<RefereeTier>().notNull().default('balanced-glycemic'),
    // 可空：为空表示不提醒（PRD 7.1），值为 HH:mm
    remindAt: text(),
    /** 打卡提醒方式：off 关闭 | in-app 应用内提醒 | native 手机端原生提醒 */
    remindMode: text().$type<RemindMode>().notNull().default('off'),
    // 可空：本地开发没有 x-real-ip 时记 127.0.0.1，老数据可能为空
    signupIp: text(),
    // 可空：注册后尚未产生会话时为空
    lastLoginIp: text(),
    ...timestamps,
  },
  (t) => [uniqueIndex('profiles_user_id_key').on(t.userId)],
)
