import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AppPage } from '@/components/layout/app-page'
import { PageSkeleton } from '@/components/layout/page-skeleton'
import {
  SmartCheckinPage,
  SmartTopBarActions,
} from '@/features/checkin/components/smart-checkin-page'

export const metadata: Metadata = { title: '智能识别' }

/**
 * 全局智能识别与历史拍摄记录页：
 * - 开启 fitViewport + flush，保留顶栏「智能识别」返回键与右上角历史记录按钮；
 * - 扫描识别出所属板块与目标后，下方原地挂载唯一核心引擎 CheckinFlow（共享表单、报告折页、团团裁判与庆祝弹窗）。
 */
export default function Page({ searchParams }: PageProps<'/checkin/smart'>) {
  return (
    <AppPage title="智能识别" backHref="/" fitViewport flush actions={<SmartTopBarActions />}>
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
