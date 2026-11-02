'use client'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { useCheckinLauncher } from '@/features/checkin/launcher-store'
import { friendActions, useFriendStore } from '@/features/friend/friend-store'
import type { FriendSummary } from '@/features/friend/schemas'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { dashboardTodayQuery } from '@/lib/api/queries/dashboard'
import { useFriendDashboard } from '@/lib/api/queries/friends'
import { HomeDashboard } from './home-dashboard'
import { HomeSkeleton } from './home-skeleton'

function FriendPerspectiveBanner({
  friend,
  onBack,
}: {
  friend: FriendSummary
  onBack: () => void
}) {
  return (
    <div className="bg-primary-soft/75 border-primary/20 flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={friend.nickname} avatar={friend.avatar} size="sm" ring={friend.streak > 0} />
        <div className="min-w-0">
          <div className="text-caption text-foreground truncate font-bold">
            正在查看 {friend.nickname} 的打卡主页
          </div>
          <div className="text-tiny text-muted truncate">好友双方完整公开打卡仪表盘 · 只读模式</div>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onBack} className="shrink-0">
        返回我的主页
      </Button>
    </div>
  )
}

/*
 * 主页（/）的数据容器：
 * - 默认（viewingFriendId === null）：GET /dashboard/today → 本人 HomeDashboard
 * - 选中好友时（viewingFriendId !== null）：GET /friends/:id/dashboard → 好友只读 HomeDashboard
 */
export function HomeView() {
  const { viewingFriendId } = useFriendStore()
  const myQuery = useQuery(dashboardTodayQuery())
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
          <FriendPerspectiveBanner
            friend={friend}
            onBack={() => friendActions.selectFriend(null)}
          />
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
    />
  )
}
