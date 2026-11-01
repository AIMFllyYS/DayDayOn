'use client'

import { EmptyState } from '@/components/ui/empty-state'
import { Sheet } from '@/components/ui/sheet'
import type { CheckinLauncherView } from '../launcher-store'

/*
 * 打卡弹层（占位，F3）。D3 按 Playbook 原型 checkin-sheet.tsx 实现，props 不变。
 * 切换视图（列表 / 体重 / 心情）在同一个弹层里换内容：调 useCheckinLauncher().open(view)。
 */

export interface CheckinSheetProps {
  open: boolean
  view: CheckinLauncherView
  onOpenChange: (open: boolean) => void
}

const titles: Record<CheckinLauncherView, string> = {
  list: '今天打卡',
  weight: '记体重',
  mood: '今日心情',
}

export function CheckinSheet({ open, view, onOpenChange }: CheckinSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={titles[view]}>
      <EmptyState title="待实现" description="打卡弹层很快就好" size="compact" />
    </Sheet>
  )
}
