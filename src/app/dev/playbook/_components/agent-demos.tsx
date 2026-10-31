'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AgentTurn } from '@/features/agent/components/agent-turn'
import { AiDraftCard } from '@/features/agent/components/ai-draft-card'
import { UserMessage } from '@/features/agent/components/user-message'
import type { AgentTurnView } from '@/features/agent/types'
import { buildLunchFrames, errorTurn, PLAYBACK_TICK_MS } from './agent-script'

/** 回放一次完整的"拍照识别午餐"，用来检查活动条、正文、草稿卡的衔接和节奏 */
export function AgentPlayback() {
  const [frames] = useState(buildLunchFrames)
  const [index, setIndex] = useState(-1)
  const [traceOpen, setTraceOpen] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current)
    },
    [],
  )

  function play() {
    if (timer.current) window.clearInterval(timer.current)
    setIndex(0)
    timer.current = window.setInterval(() => {
      setIndex((i) => {
        if (i >= frames.length - 1) {
          if (timer.current) window.clearInterval(timer.current)
          return i
        }
        return i + 1
      })
    }, PLAYBACK_TICK_MS)
  }

  const turn = index >= 0 ? frames[index] : undefined
  const done = turn?.status === 'done'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button icon="camera" onClick={play}>
          {index < 0 ? '回放：拍照识别午餐' : '重新回放'}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setTraceOpen((v) => !v)}
          aria-pressed={traceOpen}
        >
          {traceOpen ? '回放时收起过程' : '回放时展开过程'}
        </Button>
        {turn && (
          <span className="text-tiny text-muted font-mono">
            帧 {index + 1}/{frames.length} · {turn.status}
          </span>
        )}
      </div>
      {turn && (
        <div className="bg-paper border-border flex max-w-2xl flex-col gap-3 rounded-3xl border p-4">
          <UserMessage attachments="1 张照片 · 识别后不保存">帮我记一下午餐</UserMessage>
          <AgentTurn key={traceOpen ? 'open' : 'closed'} turn={turn} traceOpen={traceOpen}>
            {done && (
              <AiDraftCard
                module="diet"
                title="午餐 · 12:30"
                confidence={0.78}
                estimate
                fields={[
                  { label: '番茄炒蛋', value: '240–280 kcal', hint: '按家常做法 200g' },
                  { label: '米饭', value: '165–180 kcal', hint: '按一碗 150g' },
                  { label: '紫菜蛋花汤', value: '60–110 kcal', hint: '参考了 2 个网页' },
                  { label: '合计', value: '520–610 kcal' },
                ]}
                className="animate-pop-in max-w-md"
              />
            )}
          </AgentTurn>
        </div>
      )}
    </div>
  )
}

export function ErrorTurnDemo() {
  const [turn, setTurn] = useState<AgentTurnView>(errorTurn)
  return (
    <AgentTurn
      turn={turn}
      onRetry={() => setTurn({ ...errorTurn, status: 'submitted', parts: [] })}
    />
  )
}
