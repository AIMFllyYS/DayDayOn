import type { Metadata } from 'next'
import { OverviewPanel } from '@/features/admin/components/overview-panel'

export const metadata: Metadata = { title: '额度监控' }

export default function Page() {
  return <OverviewPanel />
}
