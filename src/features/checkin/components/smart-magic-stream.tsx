'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { MascotSvg } from '@/components/mascot/mascot-svg'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { moduleMeta, moduleTones, softToneClass, type ModuleTone } from '@/components/ui/tone'
import { AnswerText } from '@/features/agent/components/answer-text'
import { ThinkingDots } from '@/features/agent/components/thinking-dots'
import { cn } from '@/lib/cn'
import type { SmartFillContext } from './form-types'

/*
 * 智能打卡专属「分区搜索懒加载」与「流式魔法输出填充」引擎：
 *
 * 1. SmartPartitionSearchLoader：
 *    在扫描镜尚未得出结果前，不提前暴露下方的分区条与打卡表单，而是展示带旋转加载圈与
 *    5 大分区探照灯轮询的自定义搜索动画。
 * 2. useMagicStreamFill & SmartMagicTurnBanner：
 *    由于打卡识别接口一次性返回结构化 JSON，返回后在客户端复用 Agent 页面的流式视觉语言
 *    （MascotSvg + 旋转加载圈 + AnswerText 闪烁光标 animate-caret + 字段逐行逐字流式填入与数字滚动），
 *    仅针对「打卡」板块呈现完整的“流式魔法出现”效果。
 */

const TOTAL_MAGIC_TICKS = 12
const MAGIC_TICK_MS = 75

function sliceByProgress(text: string | null | undefined, progress: number): string {
  if (!text) return ''
  if (progress <= 0) return ''
  if (progress >= 1) return text
  const len = Math.max(1, Math.ceil(text.length * progress))
  return text.slice(0, len)
}

function countByProgress(value: number | null | undefined, progress: number): number | null {
  if (value === null || value === undefined) return null
  if (progress <= 0) return 0
  if (progress >= 1) return value
  return Math.max(1, Math.round(value * progress))
}

function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val))
}

export interface MagicStreamState {
  /** 是否正处于流式魔法填充动画中 */
  isMagicStreaming: boolean
  /** 当前流式填充阶段（0: 锁定板块/摘要, 1: 主字段, 2: 数值/子项, 3: 备注, 4: 完成） */
  magicStage: 0 | 1 | 2 | 3 | 4
  /** 流式打字机输出的识别摘要文本 */
  streamedSummary: string
  /** 随流式进度实时切片/递增的表单上下文 */
  streamedContext: SmartFillContext | null
  /** 用户主动点击表单任意处时立即完成流式动画，不阻塞交互 */
  finishImmediately: () => void
}

export function useMagicStreamFill(smartContext: SmartFillContext | null): MagicStreamState {
  const targetRunId = smartContext?.aiRunId ?? null
  const [state, setState] = useState<{ runId: string; tick: number } | null>(null)

  const activeTick =
    !smartContext || !targetRunId
      ? TOTAL_MAGIC_TICKS
      : state?.runId === targetRunId
        ? state.tick
        : 1

  useEffect(() => {
    if (!targetRunId) return
    const timer = window.setInterval(() => {
      setState((prev) => {
        const current = prev?.runId === targetRunId ? prev.tick : 1
        if (current >= TOTAL_MAGIC_TICKS) {
          window.clearInterval(timer)
          return { runId: targetRunId, tick: TOTAL_MAGIC_TICKS }
        }
        return { runId: targetRunId, tick: current + 1 }
      })
    }, MAGIC_TICK_MS)
    return () => window.clearInterval(timer)
  }, [targetRunId])

  if (!smartContext) {
    return {
      isMagicStreaming: false,
      magicStage: 4,
      streamedSummary: '',
      streamedContext: null,
      finishImmediately: () => {},
    }
  }

  const isMagicStreaming = activeTick < TOTAL_MAGIC_TICKS
  const magicStage: 0 | 1 | 2 | 3 | 4 = !isMagicStreaming
    ? 4
    : activeTick <= 3
      ? 0
      : activeTick <= 6
        ? 1
        : activeTick <= 9
          ? 2
          : 3

  const summaryProgress = clamp01(activeTick / 6)
  const field1Progress = clamp01((activeTick - 1) / 4)
  const field2Progress = clamp01((activeTick - 3) / 5)
  const noteProgress = clamp01((activeTick - 6) / 5)

  const draft = smartContext.draft
  const streamedSummary = sliceByProgress(draft.summary, summaryProgress)

  const streamedContext: SmartFillContext = !isMagicStreaming
    ? smartContext
    : {
        aiRunId: smartContext.aiRunId,
        draft: {
          ...draft,
          summary: streamedSummary,
          exercise: draft.exercise
            ? {
                ...draft.exercise,
                category: sliceByProgress(draft.exercise.category, field1Progress),
                durationMinutes:
                  countByProgress(draft.exercise.durationMinutes, field2Progress) ??
                  draft.exercise.durationMinutes,
                note: sliceByProgress(draft.exercise.note, noteProgress),
              }
            : null,
          diet: draft.diet
            ? {
                ...draft.diet,
                items: draft.diet.items
                  .slice(0, Math.max(1, Math.ceil(draft.diet.items.length * field1Progress)))
                  .map((it, idx) => {
                    const itemProg = clamp01((activeTick - idx * 2) / 5)
                    return {
                      ...it,
                      name: sliceByProgress(it.name, itemProg),
                      portion: sliceByProgress(it.portion, itemProg),
                      kcal: countByProgress(it.kcal, itemProg),
                    }
                  }),
                note: sliceByProgress(draft.diet.note, noteProgress),
              }
            : null,
          sleep: draft.sleep
            ? {
                ...draft.sleep,
                bedTime: field1Progress >= 0.3 ? draft.sleep.bedTime : '00:00',
                wakeTime: field2Progress >= 0.3 ? draft.sleep.wakeTime : '00:00',
                quality: Math.max(1, Math.round(draft.sleep.quality * clamp01(field2Progress))),
                note: sliceByProgress(draft.sleep.note, noteProgress),
              }
            : null,
          study: draft.study
            ? {
                ...draft.study,
                what: sliceByProgress(draft.study.what, field1Progress),
                durationMinutes: countByProgress(draft.study.durationMinutes, field2Progress),
                note: sliceByProgress(draft.study.note, noteProgress),
              }
            : null,
          custom: draft.custom
            ? {
                ...draft.custom,
                values: Object.fromEntries(
                  Object.entries(draft.custom.values).map(([k, v]) => [
                    k,
                    typeof v === 'number'
                      ? (countByProgress(v, field2Progress) ?? 0)
                      : typeof v === 'string'
                        ? sliceByProgress(v, field1Progress)
                        : v,
                  ]),
                ),
                note: sliceByProgress(draft.custom.note, noteProgress),
              }
            : null,
        },
      }

  return {
    isMagicStreaming,
    magicStage,
    streamedSummary,
    streamedContext,
    finishImmediately: () => {
      if (targetRunId && isMagicStreaming) {
        setState({ runId: targetRunId, tick: TOTAL_MAGIC_TICKS })
      }
    },
  }
}

/**
 * 扫描进行中的「正在搜索哪个打卡分区」自定义懒加载动画卡片
 * 在扫描未得出结果前挂载于扫描镜下方，不提前暴露具体表单。
 */
export function SmartPartitionSearchLoader({
  knownModule,
  className,
}: {
  /** 单板块打卡页已知当前板块时传入；全局智能识别页不传（展示 5 分区轮询搜索） */
  knownModule?: ModuleTone
  className?: string
}) {
  const [probeIndex, setProbeIndex] = useState(0)

  useEffect(() => {
    if (knownModule) return
    const timer = window.setInterval(() => {
      setProbeIndex((i) => (i + 1) % moduleTones.length)
    }, 320)
    return () => window.clearInterval(timer)
  }, [knownModule])

  const activeModule = knownModule ?? moduleTones[probeIndex]

  return (
    <Card
      role="status"
      aria-live="polite"
      className={cn(
        'animate-fade-in flex w-full min-w-0 flex-col gap-2.5 overflow-hidden p-3.5',
        className,
      )}
    >
      {/* 顶部搜索旋转动画行 */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="relative flex size-6 shrink-0 items-center justify-center">
            <span className="bg-primary-soft absolute inset-0 animate-ping rounded-full [animation-duration:1.5s]" />
            <Icon
              name="loader"
              size={15}
              strokeWidth={2.5}
              className="animate-spin-slow text-primary relative"
            />
          </span>
          <span className="text-caption text-foreground truncate font-bold">
            {knownModule
              ? `正在提取「${moduleMeta[knownModule].label}」打卡指标`
              : '正在搜索匹配的打卡分区'}
            <ThinkingDots className="text-primary ml-1" />
          </span>
        </div>
        <Badge tone={activeModule} className="shrink-0">
          <Icon name="search" size={12} className="mr-0.5 inline-block" />
          {knownModule ? moduleMeta[knownModule].label : `探测 · ${moduleMeta[activeModule].label}`}
        </Badge>
      </div>

      {/* 全局页专属：5 大打卡分区探照灯轮询条 */}
      {!knownModule && (
        <div
          aria-hidden
          className="bg-surface-sunken flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-full p-1"
        >
          {moduleTones.map((m, idx) => {
            const probing = idx === probeIndex
            return (
              <div
                key={m}
                className={cn(
                  'text-tiny relative flex h-8 min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden rounded-full px-1 font-semibold whitespace-nowrap transition-all duration-(--dur-base)',
                  probing ? cn(softToneClass[m], 'shadow-soft font-bold') : 'text-muted opacity-60',
                )}
              >
                {probing && (
                  <span className="bg-sheen animate-shimmer pointer-events-none absolute inset-0" />
                )}
                {probing ? (
                  <Icon
                    name="loader"
                    size={12}
                    strokeWidth={2.4}
                    className="animate-spin-slow relative shrink-0"
                  />
                ) : (
                  <Icon name={moduleMeta[m].icon} size={12} className="relative shrink-0" />
                )}
                <span className="relative truncate">{moduleMeta[m].label}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* 下方懒加载搜索进度骨架行 */}
      <div className="bg-surface-sunken/70 flex min-w-0 flex-col gap-2 rounded-xl p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon
            name="loader"
            size={13}
            strokeWidth={2.4}
            className="animate-spin-slow text-primary shrink-0"
          />
          <span className="text-tiny text-foreground truncate font-semibold">
            正在比对进行中的目标与计量单位…
          </span>
        </div>
        <div className="bg-shimmer animate-shimmer h-2.5 w-3/4 rounded-full" />
        <div className="flex min-w-0 items-center gap-2 pt-0.5">
          <Icon name="sparkles" size={13} className="text-subtle shrink-0" />
          <span className="text-tiny text-muted truncate">识别完成后将开启流式魔法填表</span>
        </div>
      </div>
    </Card>
  )
}

/**
 * 复用 Agent 页面的流式回复视觉头部（MascotSvg + 旋转加载圈 + AnswerText 闪烁光标 animate-caret）
 */
export function SmartMagicTurnBanner({
  tone,
  summary,
  streaming,
  magicStage,
  className,
}: {
  tone: ModuleTone
  summary: string
  streaming: boolean
  magicStage: 0 | 1 | 2 | 3 | 4
  className?: string
}) {
  const stageText =
    magicStage === 0
      ? `已锁定「${moduleMeta[tone].label}」分区，正在生成摘要…`
      : magicStage === 1
        ? `正在流式填入「${moduleMeta[tone].label}」核心项目…`
        : magicStage === 2
          ? '正在计算并填入时长与热量数值…'
          : magicStage === 3
            ? '正在补充打卡备注细节…'
            : `已魔法填入「${moduleMeta[tone].label}」表单，确认即可记录`

  return (
    <div
      aria-live="polite"
      className={cn(
        'border-border bg-surface/90 shadow-soft animate-fade-up flex w-full min-w-0 flex-col gap-2 overflow-hidden rounded-2xl border p-3',
        streaming && 'border-primary/35 ring-primary/15 ring-2',
        className,
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="bg-surface-sunken shrink-0 rounded-full p-0.5">
            <MascotSvg mood={streaming ? 'thinking' : 'happy'} size={20} />
          </span>
          {streaming ? (
            <Icon
              name="loader"
              size={14}
              strokeWidth={2.5}
              className="animate-spin-slow text-primary shrink-0"
            />
          ) : (
            <span className="bg-success-soft text-success-ink flex size-4 shrink-0 items-center justify-center rounded-full">
              <Icon name="check" size={10} strokeWidth={2.6} />
            </span>
          )}
          <span className="text-tiny text-foreground truncate font-semibold">
            {stageText}
            {streaming && <ThinkingDots className="text-primary ml-1" />}
          </span>
        </div>
        <Badge tone={streaming ? 'primary' : tone} icon="sparkles" className="shrink-0">
          {streaming ? '魔法填充中' : '流式已完成'}
        </Badge>
      </div>

      {summary && (
        <AnswerText
          text={summary}
          streaming={streaming}
          className="bg-surface-sunken/70 text-tiny md:text-caption w-full max-w-full min-w-0 rounded-xl px-3 py-2 break-words shadow-none"
        />
      )}
    </div>
  )
}

/**
 * 表单内部字段级的流式魔法容器：
 * 轮到当前字段阶段（stage === activeStage）时展示旋转加载提示与柔和光晕，按序渐入。
 */
export function MagicFieldBlock({
  stage,
  activeStage,
  streaming,
  children,
  className,
}: {
  stage: 1 | 2 | 3
  activeStage?: 0 | 1 | 2 | 3 | 4
  streaming?: boolean
  children: ReactNode
  className?: string
}) {
  if (!streaming || activeStage === undefined) {
    return <div className={cn('min-w-0', className)}>{children}</div>
  }

  const isWaiting = activeStage < stage
  const isCurrent = activeStage === stage

  return (
    <div
      className={cn(
        'relative min-w-0 rounded-xl transition-all duration-(--dur-base)',
        isWaiting && 'translate-y-1 opacity-45',
        isCurrent && 'ring-primary/30 bg-primary-soft/20 px-2 py-1.5 ring-2',
        className,
      )}
    >
      {isCurrent && (
        <span
          aria-hidden
          className="bg-surface text-primary-ink shadow-soft pointer-events-none absolute -top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
        >
          <Icon name="loader" size={11} strokeWidth={2.5} className="animate-spin-slow" />
          <span>魔法填入中…</span>
        </span>
      )}
      {children}
    </div>
  )
}
