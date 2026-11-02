'use client'

import { usePathname } from 'next/navigation'
import { Suspense, type ReactNode } from 'react'
import { CheckinLauncher } from '@/features/checkin/components/checkin-launcher'
import { useCheckinLauncher, useCheckinLauncherState } from '@/features/checkin/launcher-store'
import { cn } from '@/lib/cn'
import { BottomNav } from './bottom-nav'
import { appNavItems } from './nav-items'
import { SideNav } from './side-nav'

/*
 * 应用外壳（ui-design-system.md 第 7 节、PRD 第 6 节）。(app)/layout.tsx 挂 <AppShell>，Playbook 的页面预览用 <AppShellFrame>。
 * - < 768px：内容 + 底部悬浮导航（"＋"在栏内），只在一级页面显示；页面自己的 TopBar 吸顶并处理 --safe-top。
 * - 768–1023px：左侧窄栏（只有图标）；≥ 1024px：宽栏（品牌、导航文字、"打卡"按钮、底部额度插槽）。
 * - usePathname() 在带动态参数的路由（/goals/[goalId]）预渲染时会挂起（cacheComponents），
 *   所以读路径的导航各自包在 <Suspense> 里，外壳其余部分照常进静态外壳。
 */

export type ShellForm = 'auto' | 'phone' | 'desktop'

interface AppShellFrameProps {
  /**
   * auto：正式页面，按视口断点切换，导航 fixed / sticky 并处理安全区。
   * phone / desktop：Playbook 演示框里用（框内断点不生效），内容区自己滚动、用容器查询适配。
   */
  form?: ShellForm
  sideNav: ReactNode
  bottomNav?: ReactNode
  /** 只在演示形态里使用：固定在滚动区上方的顶栏。正式页面的顶栏由页面自己渲染（AppPage） */
  header?: ReactNode
  children: ReactNode
}

/** 外壳的布局与定位：导航组件本身不定位，由这里决定 fixed / sticky / absolute */
export function AppShellFrame({
  form = 'auto',
  sideNav,
  bottomNav,
  header,
  children,
}: AppShellFrameProps) {
  if (form === 'phone') {
    return (
      <div className="relative flex h-full w-full min-w-0 flex-col">
        {header}
        <div
          className={cn(
            '@container min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-28',
            !header && 'pt-4',
          )}
        >
          {children}
        </div>
        {bottomNav && <div className="absolute inset-x-3 bottom-4 z-30">{bottomNav}</div>}
      </div>
    )
  }

  if (form === 'desktop') {
    return (
      <div className="flex h-full">
        {sideNav}
        <div className="flex min-w-0 flex-1 flex-col">
          {header}
          <div
            className={cn('@container min-h-0 flex-1 overflow-y-auto px-8 pb-8', !header && 'pt-6')}
          >
            {children}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh w-full max-w-full overflow-x-clip">
      <div className="sticky top-0 hidden h-dvh shrink-0 md:block">{sideNav}</div>
      {/* 手机底部留出悬浮导航的高度（64px 导航 + 间距 + 底部安全区） */}
      <main className="flex min-w-0 flex-1 flex-col pb-[calc(var(--safe-bottom)+6.5rem)] md:pb-8">
        {header}
        {children}
      </main>
      <div className="fixed inset-x-3 bottom-[calc(var(--safe-bottom)+0.75rem)] z-30 mx-auto max-w-md empty:hidden md:hidden">
        {bottomNav}
      </div>
    </div>
  )
}

/** 一级页面（导航项本身）显示底栏；二级页面隐藏底栏，顶栏带返回 */
function isPrimaryPath(pathname: string): boolean {
  return appNavItems.some((item) => item.href === pathname)
}

function useToggleCheckin() {
  const { open } = useCheckinLauncherState()
  const launcher = useCheckinLauncher()
  return { open, toggle: () => (open ? launcher.close() : launcher.open('list')) }
}

function ShellSideNav({ pathname, footer }: { pathname: string; footer?: ReactNode }) {
  const launcher = useCheckinLauncher()
  return (
    <SideNav
      items={appNavItems}
      currentPath={pathname}
      onAddClick={() => launcher.open('list')}
      footer={footer}
    />
  )
}

function PathSideNav({ footer }: { footer?: ReactNode }) {
  return <ShellSideNav pathname={usePathname()} footer={footer} />
}

function PathBottomNav() {
  const pathname = usePathname()
  const { open, toggle } = useToggleCheckin()
  if (!isPrimaryPath(pathname)) return null
  return <BottomNav items={appNavItems} currentPath={pathname} onAddClick={toggle} addOpen={open} />
}

interface AppShellProps {
  children: ReactNode
  /** 宽侧栏底部插槽（≥ 1024px 显示）：AI 额度 QuotaMeter */
  sidebarFooter?: ReactNode
}

/** 正式应用外壳：导航 + 打卡弹层挂载点。挂在 (app)/layout.tsx，外层需要 <ApiProvider> */
export function AppShell({ children, sidebarFooter }: AppShellProps) {
  return (
    <>
      <AppShellFrame
        sideNav={
          <Suspense fallback={<ShellSideNav pathname="" footer={sidebarFooter} />}>
            <PathSideNav footer={sidebarFooter} />
          </Suspense>
        }
        bottomNav={
          // 带动态参数的路由都是二级页面，不显示底栏，挂起时什么都不画
          <Suspense fallback={null}>
            <PathBottomNav />
          </Suspense>
        }
      >
        {children}
      </AppShellFrame>
      <CheckinLauncher />
    </>
  )
}
