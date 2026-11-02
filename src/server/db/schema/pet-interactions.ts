import { index, pgTable, text } from 'drizzle-orm/pg-core'
import { user } from './auth'
import { id, timestamptz } from './columns'

export type PetInteractionKind = 'poke' | 'feed' | 'remind'
export type PetInteractionTreatId =
  'onigiri' | 'strawberry' | 'cookie' | 'pudding' | 'dango' | 'milk'

/**
 * 好友小窝宠物互动记录表（Issue #22 · Decision #5 · M4）
 * 存储戳戳、投喂零食、提醒打卡等互动事件，用于 30 分钟冷却计算与按好友时区的每日限额重置。
 */
export const friendPetInteractions = pgTable(
  'friend_pet_interactions',
  {
    ...id,
    actorId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    targetFriendId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: text().$type<PetInteractionKind>().notNull(),
    treatId: text().$type<PetInteractionTreatId>(),
    targetLocalDate: text().notNull(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    index('friend_pet_interactions_actor_target_kind_created_idx').on(
      t.actorId,
      t.targetFriendId,
      t.kind,
      t.createdAt.desc(),
    ),
    index('friend_pet_interactions_actor_target_date_idx').on(
      t.actorId,
      t.targetFriendId,
      t.targetLocalDate,
    ),
  ],
)
