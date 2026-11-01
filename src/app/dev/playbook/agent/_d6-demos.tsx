'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { AiDraftCard } from '@/features/agent/components/ai-draft-card'
import { draftItemId, type DraftItem } from '@/features/agent/draft'
import {
  DietRecognizerView,
  type RecognizerPhase,
} from '@/features/diet/components/diet-recognizer-view'
import { QuotaCardView, type LoadState } from '@/features/quota/components/quota-card-view'
import type { AiRunItem, QuotaView } from '@/features/quota/schemas'

/*
 * D6 的正式组件演示（Playbook 引用正式代码，反过来不行）：
 * 可编辑草稿卡、拍照识别的四个阶段、额度卡。全部是演示数据，不发请求。
 */

const demoItems = (): DraftItem[] => [
  {
    id: draftItemId(),
    name: '番茄炒蛋',
    portion: '约 200 克',
    kcal: 260,
    hint: 'AI 估 240–280 kcal',
  },
  {
    id: draftItemId(),
    name: '米饭',
    portion: '一碗约 150 克',
    kcal: 173,
    hint: 'AI 估 165–180 kcal',
  },
]

export function EditableDraftDemo() {
  const [items, setItems] = useState(demoItems)
  return (
    <AiDraftCard
      module="diet"
      title="午餐 · 拍照识别"
      items={items}
      onItemsChange={setItems}
      confidence={0.78}
      estimate
      onConfirm={() => setItems(demoItems())}
    />
  )
}

const phases = [
  { value: 'recognizing', label: '识别中' },
  { value: 'draft', label: '草稿' },
  { value: 'low', label: '把握不大' },
  { value: 'failed', label: '失败' },
] as const

/** 演示用：不真的解码图片，直接返回原文件 */
async function fakeCompress(file: File): Promise<Blob> {
  return file
}

export function RecognizerPhasesDemo() {
  const [value, setValue] = useState<(typeof phases)[number]['value']>('recognizing')
  const [items, setItems] = useState(demoItems)
  const phase: RecognizerPhase = value === 'low' ? 'draft' : value
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <SegmentedControl
        options={phases}
        value={value}
        onValueChange={setValue}
        label="阶段"
        size="sm"
      />
      <DietRecognizerView
        mealType="lunch"
        phase={phase}
        compress={fakeCompress}
        onImage={() => setValue('recognizing')}
        onClear={() => setValue('recognizing')}
        durationMs={value === 'recognizing' ? undefined : 6200}
        errorText="没看清这张照片，手动填一下吧"
        confidence={value === 'low' ? 0.42 : 0.82}
        summary="午餐：番茄炒蛋和一碗米饭，约 405–460 千卡"
        items={items}
        onItemsChange={setItems}
        onConfirm={() => setItems(demoItems())}
        onManual={() => {}}
      />
    </div>
  )
}

const quota: QuotaView = {
  periodKey: '2026-W44',
  weeklyLimitMicros: 10_000_000,
  weeklyUsedMicros: 3_420_000,
  weeklyRemainingMicros: 6_580_000,
  bonusMicros: 10_000_000,
  reservedMicros: 0,
  periodEndsAt: '2026-11-01T16:00:00.000Z',
}

const now = new Date('2026-11-01T05:00:00.000Z')
const runs: AiRunItem[] = [
  {
    id: 'r1',
    purpose: 'diet-recognition',
    status: 'succeeded',
    costMicros: 7120,
    createdAt: '2026-11-01T04:31:00.000Z',
  },
  {
    id: 'r2',
    purpose: 'diet-recognition',
    status: 'invalid-output',
    costMicros: 6800,
    createdAt: '2026-10-31T11:02:00.000Z',
  },
  {
    id: 'r3',
    purpose: 'diet-recognition',
    status: 'timeout',
    costMicros: 0,
    createdAt: '2026-10-30T23:40:00.000Z',
  },
]

export function QuotaCardDemo() {
  const [state, setState] = useState<'success' | 'pending' | 'error'>('success')
  const [errors, setErrors] = useState<Record<string, string>>()
  const [successText, setSuccessText] = useState<string>()
  const retry = () => setState('success')
  const quotaState: LoadState<QuotaView> =
    state === 'success'
      ? { status: 'success', data: quota }
      : state === 'pending'
        ? { status: 'pending' }
        : { status: 'error', message: '网络好像不太稳，稍后再试试', onRetry: retry }
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <SegmentedControl
        options={[
          { value: 'success', label: '正常' },
          { value: 'pending', label: '加载中' },
          { value: 'error', label: '出错' },
        ]}
        value={state}
        onValueChange={setState}
        label="状态"
        size="sm"
      />
      <QuotaCardView
        quota={quotaState}
        runs={{ status: 'success', data: runs }}
        now={now}
        redeem={{
          pending: false,
          errors,
          successText,
          onReset: () => {
            setErrors(undefined)
            setSuccessText(undefined)
          },
          onSubmit: (code) => {
            // 演示：以 DDON 开头的算成功
            if (code.trim().toUpperCase().startsWith('DDON')) {
              setErrors(undefined)
              setSuccessText('兑换好了，加购余额多了 ¥10.00')
            } else setErrors({ code: '兑换码好像不对，检查一下再试' })
          },
        }}
      />
    </div>
  )
}
