'use client'

import { useState, type MouseEvent, type ReactNode } from 'react'
import { AppShellFrame } from '@/components/layout/app-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { appNavItems } from '@/components/layout/nav-items'
import { SideNav } from '@/components/layout/side-nav'
import { TopBar } from '@/components/layout/top-bar'
import { TopBarActions, TopBarUserAvatar } from '@/components/layout/top-bar-nav'
import { IconButton } from '@/components/ui/button'
import { QuotaMeter } from '@/features/agent/components/quota-meter'
import { CheckinSheet } from '../../_components/checkin-sheet'

export type ShellForm = 'phone' | 'desktop'

interface AppShellProps {
  form: ShellForm
  /** 一级页面传导航路径（高亮对应项）；二级页面不传，隐藏主导航并显示返回 */
  navPath?: string
  title: string
  eyebrow?: string
  actions?: ReactNode
  hideTopBar?: boolean
  primaryNav?: boolean
  /** 点导航项时切换预览的页面（不真的跳转） */
  onNavigate?: (href: string) => void
  onBack?: () => void
  children: ReactNode
}

/**
 * 预览用的应用外壳：布局直接复用正式外壳的 AppShellFrame（src/components/layout/app-shell.tsx）。
 * 手机：顶栏 + 内容 + 底部悬浮导航；桌面：侧栏 + 顶栏 + 内容。
 * 演示框里断点不生效，所以形态由 form 决定，内容区用容器查询（@container）自适应宽度。
 * 和正式外壳的差别：点导航不真的跳转；打卡弹层用演示数据版（D3 实现正式弹层后换掉）。
 */
export function AppShell({
  form,
  navPath,
  title,
  eyebrow,
  actions,
  hideTopBar = false,
  primaryNav = false,
  onNavigate,
  onBack,
  children,
}: AppShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const primary = navPath !== undefined
  const onItemClick = (href: string, e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    onNavigate?.(href)
  }
  const leading = primaryNav ? (
    <TopBarUserAvatar />
  ) : (
    !primary && <IconButton icon="chevron-left" label="返回" onClick={onBack} className="-ml-2" />
  )
  const resolvedActions = actions ?? (primaryNav ? <TopBarActions /> : undefined)

  const openSheet = () => setSheetOpen(true)
  return (
    <>
      <AppShellFrame
        form={form}
        header={
          hideTopBar ? null : (
            <TopBar
              sticky={false}
              eyebrow={eyebrow}
              title={title}
              leading={leading}
              actions={resolvedActions}
              className={form === 'phone' ? 'shrink-0 pt-11' : 'shrink-0'}
            />
          )
        }
        sideNav={
          <SideNav
            items={appNavItems}
            currentPath={navPath ?? ''}
            onItemClick={onItemClick}
            onAddClick={openSheet}
            mode="expanded"
            footer={
              <QuotaMeter weeklyLimitMicro={10_000_000} weeklyUsedMicro={3_420_000} compact />
            }
          />
        }
        bottomNav={
          primary && (
            <BottomNav
              items={appNavItems}
              currentPath={navPath}
              onItemClick={onItemClick}
              onAddClick={openSheet}
              addOpen={sheetOpen}
            />
          )
        }
      >
        {children}
      </AppShellFrame>
      <CheckinSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  )
}
