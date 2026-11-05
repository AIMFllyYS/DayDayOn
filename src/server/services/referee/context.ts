import 'server-only'
import { eq } from 'drizzle-orm'
import {
  DEFAULT_REFEREE_TIER,
  RefereeTierSchema,
  type RefereeTier,
} from '@/features/referee/schemas'
import type { DbOrTx } from '@/server/db/client'
import { profiles } from '@/server/db/schema'

/** 用户的个人体质档位；资料行缺失或取值异常时用默认档 */
export async function loadRefereeTier(db: DbOrTx, userId: string): Promise<RefereeTier> {
  const [row] = await db
    .select({ tier: profiles.refereeTier })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1)
  const parsed = RefereeTierSchema.safeParse(row?.tier)
  return parsed.success ? parsed.data : DEFAULT_REFEREE_TIER
}
