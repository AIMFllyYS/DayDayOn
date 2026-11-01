import type { Metadata } from 'next'
import { CodesPanel } from '@/features/admin/components/codes-panel'

export const metadata: Metadata = { title: '兑换码' }

export default function Page() {
  return <CodesPanel />
}
