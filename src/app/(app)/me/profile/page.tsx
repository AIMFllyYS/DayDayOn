import type { Metadata } from 'next'
import { AppPage } from '@/components/layout/app-page'
import { ProfileScreen } from '@/features/me/components/profile-form'

export const metadata: Metadata = { title: '个人资料' }

/** 出生年份下拉以构建时的年份为准（静态外壳，精确到年足够） */
const THIS_YEAR = 2026

export default function Page() {
  return (
    <AppPage title="个人资料" backHref="/me">
      <ProfileScreen thisYear={THIS_YEAR} />
    </AppPage>
  )
}
