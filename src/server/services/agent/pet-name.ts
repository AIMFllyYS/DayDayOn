import 'server-only'
import { eq } from 'drizzle-orm'
import type { DbOrTx } from '@/server/db/client'
import { profiles } from '@/server/db/schema'

/*
 * Agent 的名字跟随用户选的形象（与前端 usePetIdentity 同一口径：墩墩，否则团团）。
 * 全局只有一个 Agent：对话、打卡分析里它都用这个名字称呼自己。
 */
export async function loadPetName(db: DbOrTx, userId: string): Promise<string> {
  const [row] = await db
    .select({ mascot: profiles.mascot })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1)
  return row?.mascot === 'dun' ? '墩墩' : '团团'
}
