'use client'

import { Button } from '@/components/ui/button'
import { ImagePicker } from '@/components/ui/image-picker'
import { AgentTurn } from '@/features/agent/components/agent-turn'
import {
  AiDraftCard,
  type DraftItem,
  type DraftItemErrors,
} from '@/features/agent/components/ai-draft-card'
import { UserMessage } from '@/features/agent/components/user-message'
import type { AgentTurnView } from '@/features/agent/types'
import type { MealType } from '@/features/checkin/schemas'
import { MEAL_LABEL } from '../draft'

/*
 * 拍照识别的纯展示部分（PRD 2.6）：ImagePicker → 活动条（"正在看照片"）→ 可编辑草稿卡。
 * 状态全部由 props 传入：正式组件 DietRecognizer 接请求，Playbook 用演示数据直接渲染。
 */

export type RecognizerPhase = 'idle' | 'recognizing' | 'draft' | 'failed'

export interface DietRecognizerViewProps {
  mealType: MealType
  phase: RecognizerPhase
  /** 压缩函数：正式代码用 src/lib/image 的 compressImage，Playbook 可以传一个假的 */
  compress: (file: File) => Promise<Blob>
  onImage: (image: Blob) => void
  onClear: () => void
  /** 识别耗时（毫秒），完成后显示在活动条上 */
  durationMs?: number
  /** phase = failed 时的原因（来自 errorMessage） */
  errorText?: string
  /** 失败后是否值得重试（超时、网络）；额度不足、AI 暂停时只给手动填写 */
  retryable?: boolean
  onRetry?: () => void
  confidence?: number
  summary?: string
  items?: readonly DraftItem[]
  itemErrors?: Readonly<Record<string, DraftItemErrors>>
  formError?: string
  onItemsChange?: (items: DraftItem[]) => void
  onConfirm?: () => void
  confirming?: boolean
  onManual?: () => void
}

/** 前端本地拼的一次回合：一个"看照片"的 tool part，没有推理段（PRD 7.3） */
export function recognitionTurn(
  phase: RecognizerPhase,
  opts: { durationMs?: number; errorText?: string } = {},
): AgentTurnView {
  const running = phase === 'recognizing'
  const failed = phase === 'failed'
  return {
    id: 'diet-recognition',
    status: running ? 'streaming' : failed ? 'error' : 'done',
    durationMs: opts.durationMs,
    errorText: opts.errorText,
    parts: [
      { type: 'step-start' },
      {
        type: 'tool',
        id: 'recognize-meal',
        toolName: 'recognizeMeal',
        state: running ? 'input-available' : failed ? 'output-error' : 'output-available',
        summary: '1 张照片 · 识别后不保存',
        errorText: failed ? opts.errorText : undefined,
        durationMs: opts.durationMs,
      },
    ],
  }
}

export function DietRecognizerView({
  mealType,
  phase,
  compress,
  onImage,
  onClear,
  durationMs,
  errorText,
  retryable = false,
  onRetry,
  confidence = 0,
  summary,
  items,
  itemErrors,
  formError,
  onItemsChange,
  onConfirm,
  confirming = false,
  onManual,
}: DietRecognizerViewProps) {
  const meal = MEAL_LABEL[mealType]
  const started = phase !== 'idle'
  return (
    <div className="flex flex-col gap-3">
      <ImagePicker
        compress={compress}
        onImage={onImage}
        onClear={onClear}
        recognizing={phase === 'recognizing'}
        disabled={confirming}
      />

      {started && (
        <div className="flex flex-col gap-3">
          <UserMessage attachments="1 张照片 · 识别后不保存">帮我记一下{meal}</UserMessage>
          <AgentTurn
            // 换阶段时重新挂载：识别中自动展开，完成后自动收起
            key={phase}
            turn={recognitionTurn(phase, { durationMs, errorText })}
            onRetry={retryable ? onRetry : undefined}
          >
            {phase === 'failed' && onManual && (
              <Button variant="soft" icon="edit" onClick={onManual} className="self-start">
                手动填写
              </Button>
            )}
            {phase === 'draft' && items && (
              <>
                {summary && <p className="text-body">{summary}</p>}
                <AiDraftCard
                  module="diet"
                  title={`${meal} · 拍照识别`}
                  items={items}
                  itemErrors={itemErrors}
                  onItemsChange={onItemsChange}
                  confidence={confidence}
                  onConfirm={onConfirm}
                  onManual={onManual}
                  confirming={confirming}
                  estimate
                  className="animate-pop-in"
                />
                {formError && (
                  <p role="alert" className="text-caption text-danger-ink">
                    {formError}
                  </p>
                )}
              </>
            )}
          </AgentTurn>
        </div>
      )}
    </div>
  )
}
