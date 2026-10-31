'use client'

import { useState, type MouseEvent, type ReactNode } from 'react'
import { BottomNav } from '@/components/layout/bottom-nav'
import { appNavItems } from '@/components/layout/nav-items'
import { SideNav } from '@/components/layout/side-nav'
import { TopBar } from '@/components/layout/top-bar'
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
  /** 点导航项时切换预览的页面（不真的跳转） */
  onNavigate?: (href: string) => void
  onBack?: () => void
  children: ReactNode
}

/**
 * 预览用的应用外壳：和正式的 (app)/layout.tsx 同一套结构。
 * 手机：顶栏 + 内容 + 底部悬浮导航；桌面：侧栏 + 顶栏 + 内容。
 * 演示框里断点不生效，所以形态由 form 决定，内容区用容器查询（@container）自适应宽度。
 */
export function AppShell({
  form,
  navPath,
  title,
  eyebrow,
  actions,
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
  const leading = !primary && (
    <IconButton icon="chevron-left" label="返回" onClick={onBack} className="-ml-2" />
  )

  if (form === 'phone') {
    return (
      <div className="relative flex h-full flex-col">
        <TopBar
          sticky={false}
          eyebrow={eyebrow}
          title={title}
          leading={leading}
          actions={actions}
          className="shrink-0 pt-11"
        />
        <div className="@container min-h-0 flex-1 overflow-y-auto px-4 pb-28">{children}</div>
        {primary && (
          <BottomNav
            items={appNavItems}
            currentPath={navPath}
            onItemClick={onItemClick}
            onAddClick={() => setSheetOpen(true)}
            addOpen={sheetOpen}
            className="absolute inset-x-3 bottom-4"
          />
        )}
        <CheckinSheet open={sheetOpen} onOpenChange={setSheetOpen} />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <SideNav
        items={appNavItems}
        currentPath={navPath ?? ''}
        onItemClick={onItemClick}
        onAddClick={() => setSheetOpen(true)}
        mode="expanded"
        footer={<QuotaMeter weeklyLimitMicro={10_000_000} weeklyUsedMicro={3_420_000} compact />}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          sticky={false}
          eyebrow={eyebrow}
          title={title}
          leading={leading}
          actions={actions}
          className="shrink-0"
        />
        <div className="@container min-h-0 flex-1 overflow-y-auto px-8 pb-8">{children}</div>
      </div>
      <CheckinSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}
