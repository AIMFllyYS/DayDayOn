import type { Metadata } from 'next'
import { AppPage } from '@/components/layout/app-page'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: '个人资料' }

/** 占位页（F3），由领域 Agent 替换 */
export default function Page() {
  return (
    <AppPage title="个人资料" backHref="/me">
      <ComingSoon />
    </AppPage>
  )
}
