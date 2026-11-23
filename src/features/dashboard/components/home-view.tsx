'use client'

import { useEffect, useRef } from 'react'
import { FocusExpandView } from '@/components/layout/page-transition'
import { ErrorState } from '@/components/ui/error-state'
import { useCheckinLauncher } from '@/features/checkin/launcher-store'
import { FriendRoomBanner } from '@/features/friend/components/friend-room-banner'
import { friendActions, useFriendStore } from '@/features/friend/friend-store'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { dashboardTodayQuery } from '@/lib/api/queries/dashboard'
import { useFriendDashboard, useFriendInsights } from '@/lib/api/queries/friends'
import { insightsQuery } from '@/lib/api/queries/insights'
import { usePutSteps } from '@/lib/api/queries/metrics'
import { getOriginFromEvent } from '@/lib/motion'
import { getNativeTodaySteps, isNativeApp } from '@/lib/native'
import { HomeDashboard } from './home-dashboard'
import { HomeSkeleton } from './home-skeleton'

/*
 * 主页（/）的数据容器：
 * - 默认（viewingFriendId === null）：GET /dashboard/today → 本人 HomeDashboard
 * - 选中好友时（viewingFriendId !== null）：GET /friends/:id/dashboard → 好友只读 HomeDashboard
 * - 切换自己/好友房间时，经 FocusExpandView 以点击聚焦点为圆心径向铺开全屏。
 */
export function HomeView() {
  const { viewingFriendId, roomTransitionOrigin } = useFriendStore()
  const myQuery = useQuery(dashboardTodayQuery())
  // 近况单独请求，不挡主页首屏；失败就不显示这一块（本人与好友视角均支持）
  const insights = useQuery({ ...insightsQuery(7), enabled: viewingFriendId === null })
  const friendQuery = useFriendDashboard(viewingFriendId)
  const friendInsights = useFriendInsights(viewingFriendId, 7)
  const launcher = useCheckinLauncher()
  const putSteps = usePutSteps()
  const syncedStepsRef = useRef(false)

  useEffect(() => {
    if (viewingFriendId !== null || syncedStepsRef.current || !myQuery.data) return
    if (!isNativeApp()) return
    syncedStepsRef.current = true
    const currentTodaySteps = myQuery.data.steps.todaySteps
    void getNativeTodaySteps().then((nativeSteps) => {
      if (nativeSteps > currentTodaySteps) {
        putSteps.mutate({ steps: nativeSteps })
      }
    })
  }, [myQuery.data, putSteps, viewingFriendId])

  const roomKey = viewingFriendId ?? '__self__'

  if (viewingFriendId !== null) {
    if (friendQuery.isPending) {
      return (
        <FocusExpandView transitionKey={roomKey} origin={roomTransitionOrigin}>
          <HomeSkeleton />
        </FocusExpandView>
      )
    }
    if (friendQuery.isError) {
      return (
        <FocusExpandView transitionKey={roomKey} origin={roomTransitionOrigin}>
          <ErrorState
            title="好友的打卡主页没加载出来"
            message={isApiError(friendQuery.error) ? errorMessage(friendQuery.error) : undefined}
            onRetry={() => friendActions.selectFriend(null)}
            retryLabel="返回我的主页"
            retrying={friendQuery.isRefetching}
          />
        </FocusExpandView>
      )
    }
    const { friend, dashboard } = friendQuery.data
    return (
      <FocusExpandView transitionKey={roomKey} origin={roomTransitionOrigin}>
        <HomeDashboard
          data={dashboard}
          now={friendQuery.dataUpdatedAt}
          timeZone={dashboard.timeZone}
          onOpenWeight={() => {}}
          onOpenMood={() => {}}
          readOnly
          friendUserId={viewingFriendId}
          insights={friendInsights.data}
          friendBanner={
            <FriendRoomBanner
              friend={friend}
              onBack={(e) => friendActions.selectFriend(null, undefined, getOriginFromEvent(e))}
            />
          }
        />
      </FocusExpandView>
    )
  }

  if (myQuery.isPending) {
    return (
      <FocusExpandView transitionKey={roomKey} origin={roomTransitionOrigin}>
        <HomeSkeleton />
      </FocusExpandView>
    )
  }
  if (myQuery.isError) {
    return (
      <FocusExpandView transitionKey={roomKey} origin={roomTransitionOrigin}>
        <ErrorState
          title="主页没加载出来"
          message={isApiError(myQuery.error) ? errorMessage(myQuery.error) : undefined}
          onRetry={() => void myQuery.refetch()}
          retrying={myQuery.isRefetching}
        />
      </FocusExpandView>
    )
  }
  return (
    <FocusExpandView transitionKey={roomKey} origin={roomTransitionOrigin}>
      <HomeDashboard
        data={myQuery.data}
        now={myQuery.dataUpdatedAt}
        timeZone={myQuery.data.timeZone}
        onOpenWeight={() => launcher.open('weight')}
        onOpenMood={() => launcher.open('mood')}
        onOpenSteps={() => launcher.open('steps')}
        insights={insights.data}
      />
    </FocusExpandView>
  )
}
