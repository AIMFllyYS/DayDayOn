'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { CheckinSheetList } from '@/features/checkin/components/checkin-sheet-list'
import type { CheckinToday } from '@/features/checkin/schemas'

// 演示数据：今天计划内的目标与状态（形状同 GET /checkins/today）
const id = (n: number) => `00000000-0000-7000-8000-00000000000${n}`
const demo: CheckinToday = {
  localDate: '2026-11-01',
  goals: [
    {
      goalId: id(1),
      module: 'exercise',
      title: '动一动',
      target: { kind: 'duration', value: 1800 },
      planned: true,
      progress: { value: 1920, target: 1800, done: true },
      sortOrder: 0,
    },
    {
      goalId: id(2),
      module: 'diet',
      title: '好好吃饭',
      target: { kind: 'count', value: 3 },
      planned: true,
      progress: { value: 2, target: 3, done: false },
      sortOrder: 1,
    },
    {
      goalId: id(3),
      module: 'sleep',
      title: '早点睡',
      target: { kind: 'duration', value: 28_800 },
      planned: true,
      progress: { value: 25_920, target: 28_800, done: false },
      sortOrder: 2,
    },
    {
      goalId: id(4),
      module: 'study',
      title: '学一点',
      target: { kind: 'count', value: 2 },
      planned: true,
      progress: { value: 0, target: 2, done: false },
      sortOrder: 3,
    },
  ],
  completion: { done: 1, planned: 4 },
  weightGrams: null,
  mood: 4,
  dietPhotoGoalId: id(2),
}

/**
 * 打卡入口弹层（演示）：渲染正式的 CheckinSheetList（D3），数据是演示用的（点目标行会跳到演示 id 的打卡页）。
 * 正式弹层 src/features/checkin/components/checkin-sheet.tsx 用同一个列表组件，数据来自 /checkins/today。
 */
export function CheckinSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [view, setView] = useState<'list' | 'weight' | 'mood'>('list')
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setView('list')
      }}
      title="记录点什么？"
      description={`今天完成了 ${demo.completion.done} / ${demo.completion.planned} 个目标`}
      footer={
        <Button variant="soft" icon="camera" className="w-full" onClick={() => onOpenChange(false)}>
          拍照记一餐
        </Button>
      }
    >
      {view === 'list' ? (
        <CheckinSheetList data={demo} onNavigate={() => onOpenChange(false)} onOpenView={setView} />
      ) : (
        <div className="flex flex-col gap-3 py-2">
          <p className="text-caption text-muted">
            正式弹层在这里切换成{view === 'weight' ? '记体重' : '今日心情'}
            面板（同一个弹层，不开第二层）。
          </p>
          <Button variant="ghost" icon="chevron-left" onClick={() => setView('list')}>
            返回打卡列表
          </Button>
        </div>
      )}
    </Sheet>
  )
}
