import type { Metadata } from 'next'
import { AppPage } from '@/components/layout/app-page'
import { MessageCenter } from '@/features/notification'

export const metadata: Metadata = {
  title: '消息与通知 · DayDayOn',
}

/**
 * 统一通知与消息中心页面（Issue #20 · ADR-0026 · Confirmed Decision #4）
 * 二级页面：手机端顶栏带返回并自动隐藏底部悬浮导航，桌面端左右双栏自适应展开。
 */
export default function NotificationsPage() {
  return (
    <AppPage title="消息与通知" backHref="/">
      <div className="py-4">
        <MessageCenter />
      </div>
    </AppPage>
  )
}
