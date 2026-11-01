import type { Metadata } from 'next'
import { UsersPanel } from '@/features/admin/components/users-panel'

export const metadata: Metadata = { title: '用户' }

export default function Page() {
  return <UsersPanel />
}
