'use client'

import { useEffect, useRef } from 'react'
import { ErrorState } from '@/components/ui/error-state'
import { toast } from '@/components/ui/toast'
import { useCheckinLauncher } from '@/features/checkin/launcher-store'
import { FriendRoomBanner } from '@/features/friend/components/friend-room-banner'
import { friendActions, useFriendStore } from '@/features/friend/friend-store'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { dashboardTodayQuery } from '@/lib/api/queries/dashboard'
import { useFriendDashboard } from '@/lib/api/queries/friends'
import { insightsQuery } from '@/lib/api/queries/insights'
import { usePutSteps } from '@/lib/api/queries/metrics'
import { getNativeTodaySteps, isNativeApp, requestNativePermission } from '@/lib/native'
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
  const putSteps = usePutSteps()
  const syncedStepsRef = useRef(false)

  useEffect(() => {
    if (viewingFriendId !== null || syncedStepsRef.current || !myQuery.data) return
    if (!isNativeApp()) return
    syncedStepsRef.current = true
    const currentTodaySteps = myQuery.data.steps.todaySteps
    void getNativeTodaySteps().then((nativeSteps) => {
      if (nativeSteps > 0 && nativeSteps !== currentTodaySteps) {
        putSteps.mutate({ steps: nativeSteps })
      }
    })
  }, [myQuery.data, putSteps, viewingFriendId])

  async function handleSyncSteps() {
    if (!isNativeApp()) {
      toast.info('当前为网页端，今日步数默认为 0 步', {
        description: '安装安卓客户端并开启「身体活动 / 计步器」权限后，会自动同步手机计步～',
      })
      return
    }
    const status = await requestNativePermission('steps')
    if (status !== 'granted') {
      toast.error('需要开启「身体活动 / 计步器」权限才能读取步数', {
        description: '也可以前往「我的 → 权限管理」手动开启',
      })
      return
    }
    const nativeSteps = await getNativeTodaySteps()
    putSteps.mutate(
      { steps: nativeSteps },
      {
        onSuccess: () => {
          toast.success(`已同步今日步数：${nativeSteps.toLocaleString('en-US')} 步`)
        },
      },
    )
  }

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
      onOpenSteps={() => void handleSyncSteps()}
      insights={insights.data}
    />
  )
}
