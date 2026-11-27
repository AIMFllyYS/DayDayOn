'use client'

import { AppPage } from '@/components/layout/app-page'
import { BackButton } from '@/components/layout/back-button'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { GoalLinkButton } from '@/features/goal/components/goal-link-button'
import {
  MetricDetailContent,
  MetricDetailSkeleton,
} from '@/features/metric/components/metric-detail-view'
import type { MetricKind } from '@/features/metric/schemas'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { friendMetricDetailQuery } from '@/lib/api/queries/friends'
import { friendActions, useFriendStore } from '../friend-store'

const METRIC_PAGE_TITLE: Record<MetricKind, string> = {
  weight: '体重详情',
  mood: '心情详情',
  steps: '步数详情',
}

/**
 * 好友只读每日指标详情页容器（/friends/[friendUserId]/metrics/[metric]）：
 * - 顶栏全端居中显示「<好友昵称>的体重/心情/步数详情」；
 * - 返回前保持好友空间视角，刷新深链接后点返回也能顺滑回到该好友小窝；
 * - 100% 复用 MetricDetailContent（统计图默认 Tab + 详细记录 Tab），不暴露任何写操作。
 */
export function FriendMetricDetailPage({
  friendUserId,
  kind,
}: {
  friendUserId: string
  kind: MetricKind
}) {
  const { viewingFriendId, viewingFriendNickname } = useFriendStore()
  const query = useQuery(friendMetricDetailQuery(friendUserId, kind))

  const nickname =
    query.data?.friend.nickname ??
    (viewingFriendId === friendUserId && viewingFriendNickname ? viewingFriendNickname : null)

  const suffix = METRIC_PAGE_TITLE[kind]
  const pageTitle = nickname ? `${nickname}的${suffix}` : `好友的${suffix}`

  const isNotFriendError =
    query.isError &&
    isApiError(query.error) &&
    (query.error.code === 'FRIEND_NOT_FOUND' || query.error.code === 'USER_NOT_FOUND')

  function restoreFriendRoom() {
    if (isNotFriendError) {
      if (viewingFriendId === friendUserId) {
        friendActions.selectFriend(null)
      }
      return false
    }
    const friend = query.data?.friend
    if (friend) {
      friendActions.selectFriend(friend.userId, {
        nickname: friend.nickname,
        avatar: friend.avatar,
      })
    } else if (viewingFriendId !== friendUserId) {
      friendActions.selectFriend(friendUserId)
    }
    return false
  }

  let body
  if (query.isPending) {
    body = <MetricDetailSkeleton />
  } else if (query.isError) {
    if (isNotFriendError) {
      body = (
        <EmptyState
          title="暂无法查看这位好友"
          description="你们目前还不是好友，或者好友关系已解除"
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
          title="指标详情没加载出来"
          message={isApiError(query.error) ? errorMessage(query.error) : undefined}
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      )
    }
  } else {
    body = (
      <MetricDetailContent
        kind={kind}
        todayDate={query.data.localDate}
        weight={query.data.weight}
        mood={query.data.mood}
        steps={query.data.steps}
        heightCm={query.data.heightCm}
        dailyStepTarget={query.data.dailyStepTarget}
        readOnly
        friendUserId={friendUserId}
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
