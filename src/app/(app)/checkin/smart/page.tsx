import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppPage } from '@/components/layout/app-page'
import { PageSkeleton } from '@/components/layout/page-skeleton'
import {
  SmartCheckinPage,
  SmartTopBarActions,
} from '@/features/checkin/components/smart-checkin-page'

export const metadata: Metadata = { title: '智能识别' }

/** 全局智能识别与历史拍摄记录页（支持智能拍照、智能上传图片/TXT/HTML 附件与历史记录回看） */
export default function Page({ searchParams }: PageProps<'/checkin/smart'>) {
  return (
    <AppPage title="智能识别" backHref="/" actions={<SmartTopBarActions />}>
      <Suspense fallback={<PageSkeleton />}>
        <SmartCheckinRoute searchParams={searchParams} />
      </Suspense>
    </AppPage>
  )
}

async function SmartCheckinRoute({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; view?: string; sid?: string; recordId?: string }>
}) {
  const { action, view, sid, recordId } = await searchParams
  const sessionKey = sid ?? `${action ?? 'capture'}-${view ?? 'scanner'}-${recordId ?? ''}`
  return (
    <SmartCheckinPage
      key={sessionKey}
      initialAction={action === 'upload' ? 'upload' : 'capture'}
      initialView={view === 'history' ? 'history' : 'scanner'}
      initialRecordId={recordId}
    />
  )
}
