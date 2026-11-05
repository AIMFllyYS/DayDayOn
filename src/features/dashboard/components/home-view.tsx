'use client'

import { ErrorState } from '@/components/ui/error-state'
import { useCheckinLauncher } from '@/features/checkin/launcher-store'
import { FriendRoomBanner } from '@/features/friend/components/friend-room-banner'
import { friendActions, useFriendStore } from '@/features/friend/friend-store'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { dashboardTodayQuery } from '@/lib/api/queries/dashboard'
import { insightsQuery } from '@/lib/api/queries/insights'
import { useFriendDashboard } from '@/lib/api/queries/friends'
import { HomeDashboard } from './home-dashboard'
import { HomeSkeleton } from './home-skeleton'

/*
 * 主页（/）的数据容器：
 * - 默认（viewingFriendId === null）：GET /dashboard/today → 本人 HomeDashboard
 * - 选中好友时（viewingFriendId !== null）：GET /friends/:id/dashboard → 好友只读 HomeDashboard
 */
export function HomeView() {
  const { viewingFriendId } = useFriendStore()
  const myQuery = useQuery(dashboardTodayQuery())
  // 近况单独请求，不挡主页首屏；失败就不显示这一块
  const insights = useQuery({ ...insightsQuery(7), enabled: viewingFriendId === null })
  const friendQuery = useFriendDashboard(viewingFriendId)
  const launcher = useCheckinLauncher()

  if (viewingFriendId !== null) {
    if (friendQuery.isPending) return <HomeSkeleton />
    if (friendQuery.isError) {
      return (
        <ErrorState
          title="好友的打卡主页没加载出来"
          message={isApiError(friendQuery.error) ? errorMessage(friendQuery.error) : undefined}
          onRetry={() => friendActions.selectFriend(null)}
          retryLabel="返回我的主页"
          retrying={friendQuery.isRefetching}
        />
      )
    }
    const { friend, dashboard } = friendQuery.data
    return (
      <HomeDashboard
        data={dashboard}
        now={friendQuery.dataUpdatedAt}
        timeZone={dashboard.timeZone}
        onOpenWeight={() => {}}
        onOpenMood={() => {}}
        readOnly
        friendBanner={
          <FriendRoomBanner friend={friend} onBack={() => friendActions.selectFriend(null)} />
        }
      />
    )
  }

  if (myQuery.isPending) return <HomeSkeleton />
  if (myQuery.isError) {
    return (
      <ErrorState
        title="主页没加载出来"
        message={isApiError(myQuery.error) ? errorMessage(myQuery.error) : undefined}
        onRetry={() => void myQuery.refetch()}
        retrying={myQuery.isRefetching}
      />
    )
  }
  return (
    <HomeDashboard
      data={myQuery.data}
      now={myQuery.dataUpdatedAt}
      timeZone={myQuery.data.timeZone}
      onOpenWeight={() => launcher.open('weight')}
      onOpenMood={() => launcher.open('mood')}
      insights={insights.data}
    />
  )
}
