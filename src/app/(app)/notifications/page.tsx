import type { Metadata } from 'next'
import { AppPage } from '@/components/layout/app-page'
import { MessageCenter } from '@/features/notification'

export const metadata: Metadata = {
  title: '消息与通知 · DayDayOn',
}

/**
 * 统一通知与消息中心页面（Issue #20 · Issue #80 · ADR-0026）
 * 全屏无容器设计：一级顶部独立展示「打卡房间与动态」「官方与系统通知」，下方排布好友会话；
 * 手机端二级全屏钻取，桌面端左右全屏分栏。
 */
export default function NotificationsPage() {
  return (
    <AppPage title="消息与通知" hideTopBar flush fitViewport>
      <MessageCenter />
    </AppPage>
  )
}
