import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { FriendGoalDetailPage } from '@/features/friend/components/friend-goal-detail-view'
import { IdSchema, UserIdSchema } from '@/features/shared/schemas'

export const metadata = { title: '好友的目标详情' }

interface Props {
  params: Promise<{ friendUserId: string; goalId: string }>
}

export default function Page({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-label="加载中"
          className="grid gap-3 px-4 pt-16 md:px-8 @3xl:grid-cols-2"
        >
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
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
