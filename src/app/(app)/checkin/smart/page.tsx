import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppPage } from '@/components/layout/app-page'
import { PageSkeleton } from '@/components/layout/page-skeleton'
import { SmartCheckinPage } from '@/features/checkin/components/smart-checkin-page'

export const metadata: Metadata = { title: '智能识别' }

/** 全局智能识别页（支持智能拍照与智能上传图片/TXT/HTML 附件） */
export default function Page({ searchParams }: PageProps<'/checkin/smart'>) {
  return (
    <AppPage title="智能识别" backHref="/">
      <Suspense fallback={<PageSkeleton />}>
        <SmartCheckinRoute searchParams={searchParams} />
      </Suspense>
    </AppPage>
  )
}

async function SmartCheckinRoute({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const { action } = await searchParams
  return <SmartCheckinPage initialAction={action === 'upload' ? 'upload' : 'capture'} />
}
