import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { FriendGoalDetailPage } from '@/features/friend/components/friend-goal-detail-view'
import { GoalDetailSkeleton } from '@/features/goal/components/goal-detail-view'
import { IdSchema, UserIdSchema } from '@/features/shared/schemas'

export const metadata = { title: '好友的目标详情' }

interface Props {
  params: Promise<{ friendUserId: string; goalId: string }>
}

export default function Page({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="px-4 pt-[calc(var(--safe-top)+3.5rem)] md:px-8 md:pt-16">
          <GoalDetailSkeleton />
        </div>
      }
    >
      <FriendGoalDetailBody params={params} />
    </Suspense>
  )
}

async function FriendGoalDetailBody({ params }: Props) {
  const { friendUserId, goalId } = await params
  if (!UserIdSchema.safeParse(friendUserId).success || !IdSchema.safeParse(goalId).success) {
    notFound()
  }
  return <FriendGoalDetailPage friendUserId={friendUserId} goalId={goalId} />
}
