'use client'

import { useState } from 'react'
import { Button, IconButton } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { CheckinSheetList } from '@/features/checkin/components/checkin-sheet-list'
import type { CheckinToday } from '@/features/checkin/schemas'
import { SmartActionBar } from './smart-action-bar'

// 演示数据：今天计划内的 5 大板块目标与状态（形状同 GET /checkins/today）
const id = (n: number) => `00000000-0000-7000-8000-00000000000${n}`
const demo: CheckinToday = {
  localDate: '2026-11-03',
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
    {
      goalId: id(5),
      module: 'custom',
      title: '我的小目标',
      target: { kind: 'count', value: 1 },
      planned: true,
      progress: { value: 0, target: 1, done: false },
      sortOrder: 4,
    },
  ],
  completion: { done: 1, planned: 5 },
  weightGrams: null,
  mood: 4,
  dietPhotoGoalId: id(2),
}

/**
 * 打卡入口弹层（演示）：渲染正式的 CheckinSheetList（D3），数据是演示用的。
 * 底部栏已升级为左右并列的双按钮原子组件 <SmartActionBar />（左「智能拍照」、右「智能上传」）。
 */
export function CheckinSheet({
  open,
  onOpenChange,
  onSmartAction,
  onGoalNavigate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSmartAction?: (mode: 'capture' | 'upload') => void
  onGoalNavigate?: () => void
}) {
  const [view, setView] = useState<'list' | 'weight' | 'mood'>('list')

  function handleSmart(mode: 'capture' | 'upload') {
    onOpenChange(false)
    setView('list')
    if (onSmartAction) {
      onSmartAction(mode)
    } else {
      toast.info(
        mode === 'capture'
          ? '已触发「智能拍照」→ 跳转至智能识别页面（/checkin/smart）'
          : '已触发「智能上传」（支持图片 / HTML / TXT）→ 跳转至智能识别页面（/checkin/smart）',
      )
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setView('list')
      }}
      title="记录点什么？"
      description={`今天完成了 ${demo.completion.done} / ${demo.completion.planned} 个目标`}
      headerActions={
        <IconButton
          icon="clock"
          label="历史拍摄记录"
          onClick={() => {
            onOpenChange(false)
            toast.info('已打开「历史拍摄记录」全屏列表（/checkin/smart?view=history）')
          }}
        />
      }
      footer={
        view === 'list' ? (
          <SmartActionBar
            enableFileInputs
            onCapture={() => handleSmart('capture')}
            onUpload={() => handleSmart('upload')}
          />
        ) : (
          <Button
            variant="ghost"
            icon="chevron-left"
            className="w-full"
            onClick={() => setView('list')}
          >
            返回打卡列表
          </Button>
        )
      }
    >
      {view === 'list' ? (
        <CheckinSheetList
          data={demo}
          onNavigate={() => {
            onOpenChange(false)
            onGoalNavigate?.()
          }}
          onOpenView={setView}
        />
      ) : (
        <div className="flex flex-col gap-3 py-2">
          <p className="text-caption text-muted">
            正式弹层在这里切换成{view === 'weight' ? '记体重' : '今日心情'}
            面板（同一个弹层，不开第二层）。
          </p>
        </div>
      )}
    </Sheet>
  )
}
