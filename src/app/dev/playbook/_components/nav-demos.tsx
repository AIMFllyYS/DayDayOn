'use client'

import { useState, type MouseEvent } from 'react'
import { BottomNav } from '@/components/layout/bottom-nav'
import { appNavItems } from '@/components/layout/nav-items'
import { SideNav, type SideNavMode } from '@/components/layout/side-nav'
import { TopBar } from '@/components/layout/top-bar'
import { IconTile } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ProgressBar } from '@/components/ui/progress'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { moduleMeta, moduleTones } from '@/components/ui/tone'
import { QuotaMeter } from '@/features/agent/components/quota-meter'
import { DesktopFrame, PhoneFrame } from './device-frame'

const titles: Record<string, string> = {
  '/': '主页',
  '/todo': '待办',
  '/rank': '排行',
  '/me': '我的',
}

/** 演示里点导航不真的跳转，只切换高亮 */
function useDemoNav() {
  const [path, setPath] = useState('/')
  const [sheetOpen, setSheetOpen] = useState(false)
  const onItemClick = (href: string, e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    setPath(href)
  }
  return { path, sheetOpen, setSheetOpen, onItemClick }
}

function DemoBody({ path }: { path: string }) {
  return (
    <div key={path} className="animate-fade-up grid gap-3">
      <Card variant="sticker" className="flex items-center gap-3">
        <IconTile icon="flame" tone="primary" size="lg" />
        <div className="flex-1">
          <p className="text-caption font-semibold">{titles[path]} · 示例内容</p>
          <ProgressBar value={60} label="示例进度" className="mt-2" />
        </div>
      </Card>
      {[0, 1, 2].map((i) => (
        <Card key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </Card>
      ))}
    </div>
  )
}

function CheckinSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="记录点什么？"
      description="选一个板块开始打卡"
    >
      <ul className="grid grid-cols-3 gap-2.5">
        {moduleTones.map((t) => (
          <li key={t}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="bg-surface-sunken flex w-full flex-col items-center gap-2 rounded-2xl py-4 font-semibold active:scale-95"
            >
              <IconTile icon={moduleMeta[t].icon} tone={t} size="lg" />
              {moduleMeta[t].label}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

export function MobileShellDemo() {
  const nav = useDemoNav()
  return (
    <PhoneFrame>
      <div className="flex h-full flex-col">
        <TopBar
          sticky={false}
          eyebrow="10 月 31 日 · 周六"
          title={titles[nav.path] ?? ''}
          actions={<IconButton icon="bell" label="提醒" />}
          className="pt-11"
        />
        <div className="flex-1 overflow-y-auto px-4 pb-28">
          <DemoBody path={nav.path} />
        </div>
        <BottomNav
          items={appNavItems}
          currentPath={nav.path}
          onItemClick={nav.onItemClick}
          onAddClick={() => nav.setSheetOpen(true)}
          addOpen={nav.sheetOpen}
          className="absolute inset-x-3 bottom-4"
        />
      </div>
      <CheckinSheet open={nav.sheetOpen} onOpenChange={nav.setSheetOpen} />
    </PhoneFrame>
  )
}

export function DesktopShellDemo({ mode, label }: { mode: SideNavMode; label: string }) {
  const nav = useDemoNav()
  return (
    <DesktopFrame label={label}>
      <SideNav
        items={appNavItems}
        currentPath={nav.path}
        onItemClick={nav.onItemClick}
        onAddClick={() => nav.setSheetOpen(true)}
        mode={mode}
        footer={<QuotaMeter weeklyLimitMicro={10_000_000} weeklyUsedMicro={3_420_000} compact />}
      />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <TopBar
          sticky={false}
          eyebrow="10 月 31 日 · 周六"
          title={titles[nav.path] ?? ''}
          actions={
            <>
              <IconButton icon="search" label="搜索" />
              <IconButton icon="bell" label="提醒" />
            </>
          }
        />
        <div className="px-8 pb-8">
          <DemoBody path={nav.path} />
        </div>
      </div>
      <CheckinSheet open={nav.sheetOpen} onOpenChange={nav.setSheetOpen} />
    </DesktopFrame>
  )
}
