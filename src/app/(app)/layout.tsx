import { Suspense, type ReactNode } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { PageSkeleton } from '@/components/layout/page-skeleton'
import { ThemeSync } from '@/components/layout/theme-sync'
import { AgentHost } from '@/features/agent/agent-host'
import { SidebarQuota } from '@/features/quota/components/sidebar-quota'
import { ApiProvider } from '@/lib/api'
import { requireOnboardedUser } from '@/server/auth'

/*
 * 登录后的应用外壳（routing.md 第 3 节）。外壳和导航不读会话，进静态外壳；
 * 会话校验放在 <Suspense> 里（nextjs-16-patterns.md）：未登录跳 /login，未完成引导跳 /onboarding。
 */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <ApiProvider>
      <AppShell sidebarFooter={<SidebarQuota />}>
        <Suspense fallback={<PageSkeleton />}>
          <SessionGate>{children}</SessionGate>
        </Suspense>
      </AppShell>
    </ApiProvider>
  )
}

async function SessionGate({ children }: { children: ReactNode }) {
  await requireOnboardedUser()
  return (
    <>
      <ThemeSync />
      <AgentHost>{children}</AgentHost>
    </>
  )
}
