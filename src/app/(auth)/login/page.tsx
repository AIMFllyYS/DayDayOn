import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { LoginCard } from '@/features/auth/components/login-card'

export const metadata: Metadata = { title: '登录' }

export default function Page() {
  return (
    <>
      <h1 className="sr-only">登录</h1>
      <Suspense fallback={<Skeleton className="mx-auto h-80 w-full max-w-sm rounded-3xl" />}>
        <LoginCard />
      </Suspense>
      <p className="text-tiny text-muted mt-6 text-center">
        登录即表示你已了解
        <Link href="/privacy" className="text-primary-ink mx-1 font-semibold underline">
          隐私说明
        </Link>
      </p>
    </>
  )
}
