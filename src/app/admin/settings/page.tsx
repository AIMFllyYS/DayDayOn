import type { Metadata } from 'next'
import { SettingsPanel } from '@/features/admin/components/settings-panel'

export const metadata: Metadata = { title: '全站设置' }

export default function Page() {
  return <SettingsPanel />
}
