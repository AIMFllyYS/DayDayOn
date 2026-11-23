'use client'

import { AppPage } from '@/components/layout/app-page'
import { BackButton } from '@/components/layout/back-button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { GoalDetailContent, GoalDetailSkeleton } from '@/features/goal/components/goal-detail-view'
import { GoalLinkButton } from '@/features/goal/components/goal-link-button'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { friendGoalDetailQuery } from '@/lib/api/queries/friends'
import { friendActions, useFriendStore } from '../friend-store'

/**
 * 好友只读目标详情页容器（/friends/[friendUserId]/goals/[goalId]）：
 * - 顶栏标题为「<朋友名称>的目标详情」并全端居中对齐；
 * - 返回前保持好友空间视角，支持从深链接刷新后顺滑回到该好友小窝。
 */
export function FriendGoalDetailPage({
  friendUserId,
  goalId,
}: {
  friendUserId: string
  goalId: string
}) {
  const { viewingFriendId, viewingFriendNickname } = useFriendStore()
  const query = useQuery(friendGoalDetailQuery(friendUserId, goalId))

  const nickname =
    query.data?.friend.nickname ??
    (viewingFriendId === friendUserId && viewingFriendNickname ? viewingFriendNickname : null)

  const pageTitle = nickname ? `${nickname}的目标详情` : '好友的目标详情'

  function restoreFriendRoom() {
    const friend = query.data?.friend
    if (friend) {
      friendActions.selectFriend(friend.userId, {
        nickname: friend.nickname,
        avatar: friend.avatar,
      })
    } else if (viewingFriendId !== friendUserId) {
      friendActions.selectFriend(friendUserId)
    }
    // 返回 false 让 BackButton 继续执行正常的 router.back() / fallbackHref 导航
    return false
  }

  let body
  if (query.isPending) {
    body = <GoalDetailSkeleton />
  } else if (query.isError) {
    if (
      isApiError(query.error) &&
      (query.error.code === 'GOAL_NOT_FOUND' || query.error.code === 'FRIEND_NOT_FOUND')
    ) {
      body = (
        <EmptyState
          title={query.error.code === 'FRIEND_NOT_FOUND' ? '暂无法查看这位好友' : '这个目标不见了'}
          description={
            query.error.code === 'FRIEND_NOT_FOUND'
              ? '你们目前还不是好友，或者好友关系已解除'
              : '好友可能已经删除了这个目标'
          }
          mood="surprised"
          action={
            <GoalLinkButton href="/" variant="soft">
              回到主页
            </GoalLinkButton>
          }
        />
      )
    } else {
      body = (
        <ErrorState
          title="目标详情没加载出来"
          message={isApiError(query.error) ? errorMessage(query.error) : undefined}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      )
    }
  } else {
    body = (
      <GoalDetailContent
        goal={query.data.goal}
        readOnly
        friendUserId={friendUserId}
        todayLocalDate={query.data.localDate}
      />
    )
  }

  return (
    <AppPage
      title={pageTitle}
      centerTitle
      leading={<BackButton fallbackHref="/" onBeforeBack={restoreFriendRoom} />}
    >
      {body}
    </AppPage>
  )
}
