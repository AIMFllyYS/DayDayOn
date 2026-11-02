import type { Metadata } from 'next'
import { AppPage } from '@/components/layout/app-page'
import { MeScreen } from '@/features/me/components/me-screen'

export const metadata: Metadata = { title: '我的' }

export default function Page() {
  return (
    <AppPage title="我的" hideTopBar>
      <MeScreen />
    </AppPage>
  )
}
