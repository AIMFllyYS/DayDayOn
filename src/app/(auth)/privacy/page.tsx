import type { Metadata } from 'next'
import { PrivacyContent } from '@/features/me/components/privacy-content'

export const metadata: Metadata = { title: '隐私说明' }

export default function Page() {
  return <PrivacyContent />
}
