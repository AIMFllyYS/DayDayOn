import type { Metadata } from 'next'
import { Suspense, type ReactNode } from 'react'
import { BrandMark } from '@/components/layout/brand'
import { PageSkeleton } from '@/components/layout/page-skeleton'
import { AdminNav, AdminNavLinks } from '@/features/admin/components/admin-nav'
import { TwoFactorSetup } from '@/features/admin/components/two-factor-setup'
import { ApiProvider } from '@/lib/api'
import { requireAdmin } from '@/server/auth'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/*
 * 后台（routing.md 第 3 节）：独立布局，桌面优先。管理员校验放在 <Suspense> 里：
 * 未登录跳 /login，不是管理员跳 /。两步验证未开启时整页显示绑定流程，不显示后台内容（PRD 7.1）。
 */
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <ApiProvider>
      <div className="flex min-h-dvh flex-col md:flex-row">
        <nav
          aria-label="后台导航"
          className="border-border bg-surface/70 flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-3 md:sticky md:top-0 md:h-dvh md:w-56 md:flex-col md:border-r md:border-b-0 md:py-5"
        >
          <div className="mr-2 flex items-center gap-2 px-1.5 md:mr-0 md:mb-4">
            <BrandMark size={28} />
            <span className="text-subhead font-bold">后台</span>
          </div>
          <Suspense fallback={<AdminNavLinks />}>
            <AdminNav />
          </Suspense>
        </nav>
        <main className="flex min-w-0 flex-1 flex-col gap-4 px-4 py-6 md:px-8">
          <Suspense fallback={<PageSkeleton />}>
            <AdminGate>{children}</AdminGate>
          </Suspense>
        </main>
      </div>
    </ApiProvider>
  )
}

async function AdminGate({ children }: { children: ReactNode }) {
  const admin = await requireAdmin()
  if (!admin.twoFactorEnabled) return <TwoFactorSetup />
  return children
}
