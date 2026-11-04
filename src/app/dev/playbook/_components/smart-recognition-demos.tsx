'use client'

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { TopBar } from '@/components/layout/top-bar'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Icon, type IconName } from '@/components/ui/icon'
import { NumberField } from '@/components/ui/number-field'
import { ProgressBar } from '@/components/ui/progress'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Stamp } from '@/components/ui/stamp'
import { TimeRangeField } from '@/components/ui/time-range-field'
import { toast } from '@/components/ui/toast'
import { moduleMeta, moduleTones, softToneClass, type ModuleTone } from '@/components/ui/tone'
import {
  MagicFieldBlock,
  SmartMagicTurnBanner,
  SmartPartitionSearchLoader,
} from '@/features/checkin/components/smart-magic-stream'
import type { Intensity, MealType } from '@/features/checkin/schemas'
import { cn } from '@/lib/cn'
import { PhoneFrame } from './device-frame'
import { SMART_UPLOAD_ACCEPT } from './smart-action-bar'

/*
 * 智能识别页面与全板块模块化组件演示（Playbook 先行设计 · 第三轮交互升级版）：
 *
 * 核心升级点：
 * 1. 【扫描镜 SmartScannerLens】：
 *    - 扫描条使用 animate-scan-sweep 真正从上到下往返扫描；
 *    - 下方始终保留 1、2、3 步骤图标，进行到哪一步，哪一步前面就转圈圈（loader 动画）；
 *    - 智能上传或不识别情景下，按钮文案改为「重新上传」。
 * 2. 【未扫描前不提前暴露下方组件 + 搜索分区懒加载动画】：
 *    - 阶段 idle：只显示扫描镜，下方留白；
 *    - 阶段 scanning：下方显示 <SmartPartitionSearchLoader />（旋转搜索图标 + 5 大分区探照灯轮询）。
 * 3. 【流式魔法输出填充（复用 Agent 流式视觉效果）】：
 *    - 阶段 done：AI 识别完成后，先锁定分区胶囊，再用 Agent 风格的 <SmartMagicTurnBanner />（带闪烁光标 animate-caret）
 *      流式输出摘要，同时下方表单各字段按序逐字流式填入、数字滚动递增。
 */

export type CheckinInputMode = 'manual' | 'smart-capture' | 'smart-upload'
export type ScanPhase = 'idle' | 'scanning' | 'done'

export interface SmartSamplePreset {
  id: string
  module: ModuleTone
  goalTitle: string
  sourceKind: 'image' | 'text'
  visualTitle: string
  visualLines: string[]
  summaryText?: string
  scanSteps: [string, string, string]
  exercise?: { category: string; minutes: number; intensity: Intensity; kcal: number; note: string }
  diet?: {
    meal: MealType
    items: { name: string; portion: string; kcal: number }[]
    note: string
  }
  sleep?: { bed: string; wake: string; quality: RatingValue; deepHours: string; note: string }
  study?: { what: string; minutes: number; note: string }
  custom?: { habitName: string; cups: number; moodNote: string }
}

export const SMART_PRESETS: Record<ModuleTone, SmartSamplePreset> = {
  exercise: {
    id: 'preset-exercise',
    module: 'exercise',
    goalTitle: '动一动',
    sourceKind: 'image',
    visualTitle: '户外慢跑 · 5.12 km',
    visualLines: [
      '运动时长：00:32:15',
      '平均配速：6\'17" / km',
      '估算消耗：196 kcal（心率 142 bpm）',
    ],
    summaryText: '识别出户外跑步 **32 分钟**（中等强度），估算消耗约 **196 kcal**。',
    scanSteps: [
      '正在扫描运动截图中的轨迹与表盘数字…',
      '提取关键指标：跑步 · 32 分钟 · 中等强度',
      '流式魔法填入「动一动」运动打卡表单',
    ],
    exercise: {
      category: '跑步',
      minutes: 32,
      intensity: 'moderate',
      kcal: 196,
      note: '沿东湖绿道慢跑 5 公里，微汗舒服',
    },
  },
  diet: {
    id: 'preset-diet',
    module: 'diet',
    goalTitle: '好好吃饭',
    sourceKind: 'image',
    visualTitle: '午餐餐盘实拍 · 3 样食物',
    visualLines: [
      '番茄炒蛋（约 200g）· 255 kcal',
      '杂粮米饭（一碗 150g）· 170 kcal',
      '蒜蓉西蓝花（约 120g）· 65 kcal',
    ],
    summaryText: '识别到午餐 **3 样食物**：番茄炒蛋、杂粮米饭、蒜蓉西蓝花，合计约 **490 kcal**。',
    scanSteps: [
      '正在扫描餐盘区域与食材份量比例…',
      '识别出 3 项食物并完成热量估算（共约 490 kcal）',
      '流式魔法填入「好好吃饭」可编辑饮食清单',
    ],
    diet: {
      meal: 'lunch',
      items: [
        { name: '番茄炒蛋', portion: '约 200 克', kcal: 255 },
        { name: '杂粮米饭', portion: '一碗约 150 克', kcal: 170 },
        { name: '蒜蓉西蓝花', portion: '约 120 克', kcal: 65 },
      ],
      note: '食堂少油窗口，营养均衡',
    },
  },
  sleep: {
    id: 'preset-sleep',
    module: 'sleep',
    goalTitle: '早点睡',
    sourceKind: 'image',
    visualTitle: '昨晚睡眠监测 · 7 小时 55 分',
    visualLines: [
      '入睡时刻：23:15 · 起床时刻：07:10',
      '深睡比例：24%（1 小时 54 分）',
      '睡眠质量：良好',
    ],
    summaryText: '解析出昨晚睡眠时段 **23:15 → 次日 07:10**（共 7 小时 55 分），睡眠质量良好。',
    scanSteps: [
      '正在扫描睡眠阶段波形图与起止时间戳…',
      '解析出跨午夜时段 23:15 → 次日 07:10',
      '流式魔法填入「早点睡」睡眠时间段与质量评分',
    ],
    sleep: {
      bed: '23:15',
      wake: '07:10',
      quality: 4,
      deepHours: '1 小时 54 分',
      note: '11 点前放下手机，深睡比昨天多了半小时',
    },
  },
  study: {
    id: 'preset-study',
    module: 'study',
    goalTitle: '学一点',
    sourceKind: 'text',
    visualTitle: 'Day 12：二叉树层序遍历笔记',
    visualLines: [
      '专注时长：45 分钟（LeetCode 3 题）',
      '核心收获：队列层长快照，复杂度 O(n)',
      '已过滤 HTML 标签，提纯有效正文',
    ],
    summaryText: '从上传的 HTML 笔记中提炼学习主题 **二叉树层序遍历**，专注时长 **45 分钟**。',
    scanSteps: [
      '正在读取纯文本 / HTML 附件并提纯正文…',
      '提炼学习主题「二叉树层序遍历」及专注 45 分钟',
      '流式魔法填入「学一点」学习打卡表单',
    ],
    study: {
      what: '二叉树层序遍历与 BFS 笔记',
      minutes: 45,
      note: '掌握队列层长快照写法，时间复杂度 O(n)',
    },
  },
  custom: {
    id: 'preset-custom',
    module: 'custom',
    goalTitle: '我的小目标',
    sourceKind: 'text',
    visualTitle: '每日饮水与习惯记录',
    visualLines: [
      '08:30 温水 300ml · 10:30 柠檬水 250ml · 14:00 绿茶 300ml',
      '16:30 温水 250ml · 19:00 温水 300ml（累计 7 杯）',
      '状态备注：下午没有点奶茶，状态很好',
    ],
    summaryText: '从上传的 TXT 文本中提取今日饮水记录 **共 7 杯**，已匹配自定义目标字段。',
    scanSteps: [
      '正在解析文本记录与自定义目标字段定义…',
      '匹配字段：今日饮水杯数 = 7 杯 · 心得备注已提取',
      '流式魔法填入「我的小目标」动态表单',
    ],
    custom: {
      habitName: '每天喝够 8 杯温水',
      cups: 7,
      moodNote: '用柠檬水和绿茶代替了下午茶奶茶',
    },
  },
}

function sliceStr(s: string, prog: number): string {
  if (prog <= 0) return ''
  if (prog >= 1) return s
  return s.slice(0, Math.max(1, Math.ceil(s.length * prog)))
}

function countNum(n: number, prog: number): number {
  if (prog <= 0) return 0
  if (prog >= 1) return n
  return Math.max(1, Math.round(n * prog))
}

function usePlaybookMagicStream(triggerKey: string, enabled: boolean) {
  const [state, setState] = useState<{ key: string; tick: number }>({ key: triggerKey, tick: 12 })

  const activeTick = !enabled ? 12 : state.key === triggerKey ? state.tick : 1

  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => {
      setState((prev) => {
        const cur = prev.key === triggerKey ? prev.tick : 1
        if (cur >= 12) {
          window.clearInterval(timer)
          return { key: triggerKey, tick: 12 }
        }
        return { key: triggerKey, tick: cur + 1 }
      })
    }, 75)
    return () => window.clearInterval(timer)
  }, [triggerKey, enabled])

  const streaming = enabled && activeTick < 12
  const stage: 0 | 1 | 2 | 3 | 4 = !streaming
    ? 4
    : activeTick <= 3
      ? 0
      : activeTick <= 6
        ? 1
        : activeTick <= 9
          ? 2
          : 3

  return {
    streaming,
    stage,
    summaryProg: Math.min(1, activeTick / 6),
    field1Prog: Math.max(0, Math.min(1, (activeTick - 1) / 4)),
    field2Prog: Math.max(0, Math.min(1, (activeTick - 3) / 5)),
    noteProg: Math.max(0, Math.min(1, (activeTick - 6) / 5)),
  }
}

// ============================================================================
// 原子组件 0：扫描镜取景与实时分析流（SmartScannerLens）
// ============================================================================

export interface SmartScannerLensProps {
  preset: SmartSamplePreset
  phase: ScanPhase
  mode?: 'smart-capture' | 'smart-upload'
  customFileInfo?: {
    name: string
    kind: 'image' | 'text'
    previewText?: string
    previewUrl?: string
  } | null
  onRescan: () => void
  onPickLocalFile?: (file: File) => void
  tone?: ModuleTone
}

export function SmartScannerLens({
  preset,
  phase,
  mode,
  customFileInfo,
  onRescan,
  tone,
}: SmartScannerLensProps) {
  const activeTone = tone ?? preset.module
  const isScanning = phase === 'scanning'
  const isIdle = phase === 'idle'
  const effectiveMode = mode ?? (preset.sourceKind === 'text' ? 'smart-upload' : 'smart-capture')

  const [stepState, setStepState] = useState<{ scanning: boolean; idx: 0 | 1 | 2 }>({
    scanning: false,
    idx: 0,
  })
  const activeStepIdx: 0 | 1 | 2 = isScanning && stepState.scanning ? stepState.idx : 0

  useEffect(() => {
    if (!isScanning) return
    const t0 = window.setTimeout(() => setStepState({ scanning: true, idx: 0 }), 0)
    const t1 = window.setTimeout(() => setStepState({ scanning: true, idx: 1 }), 350)
    const t2 = window.setTimeout(() => setStepState({ scanning: true, idx: 2 }), 700)
    return () => {
      window.clearTimeout(t0)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [isScanning])

  const actionLabel = isIdle
    ? effectiveMode === 'smart-upload'
      ? '上传文件'
      : '立即拍照'
    : effectiveMode === 'smart-upload'
      ? '重新上传'
      : '重新扫描'

  return (
    <div className="border-border bg-surface shadow-soft flex min-w-0 flex-col gap-2.5 overflow-hidden rounded-2xl border p-3.5">
      {/* 极简顶部栏：左侧状态指示 + 右侧操作按钮 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {isScanning ? (
            <Icon
              name="loader"
              size={14}
              strokeWidth={2.5}
              className="animate-spin-slow text-primary shrink-0"
            />
          ) : (
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                isIdle ? 'bg-primary/60' : 'bg-success',
              )}
            />
          )}
          <span className="text-caption font-bold">
            {isScanning ? '团团扫描镜识别中…' : isIdle ? '等待放入图片或文本' : '扫描识别完成'}
          </span>
        </div>
        <button
          type="button"
          onClick={onRescan}
          className="text-primary-ink hover:bg-primary-soft/60 text-tiny inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 font-semibold transition-colors active:scale-95"
        >
          <Icon name={effectiveMode === 'smart-capture' ? 'camera' : 'sparkles'} size={13} />
          <span>{actionLabel}</span>
        </button>
      </div>

      {/* 扫描镜主视窗（四角手账对焦角标 + 上下往返扫描光束 animate-scan-sweep） */}
      <div className="bg-surface-sunken border-border-strong relative min-h-36 min-w-0 overflow-hidden rounded-2xl border p-3.5">
        <span className="border-primary pointer-events-none absolute top-2 left-2 size-3.5 rounded-tl-md border-t-2 border-l-2" />
        <span className="border-primary pointer-events-none absolute top-2 right-2 size-3.5 rounded-tr-md border-t-2 border-r-2" />
        <span className="border-primary pointer-events-none absolute bottom-2 left-2 size-3.5 rounded-bl-md border-b-2 border-l-2" />
        <span className="border-primary pointer-events-none absolute right-2 bottom-2 size-3.5 rounded-br-md border-r-2 border-b-2" />

        {/* 真实上下往返移动的扫描光束 */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-2 z-10 transition-opacity duration-(--dur-base)',
            isScanning ? 'animate-scan-sweep opacity-100' : 'top-1/2 opacity-0',
          )}
        >
          <div className="via-primary/25 h-8 w-full bg-gradient-to-b from-transparent to-transparent" />
          <div className="bg-primary -mt-4 h-0.5 w-full rounded-full shadow-sm" />
        </div>

        {/* 视窗内容 */}
        {isIdle ? (
          <div className="flex flex-col items-center justify-center gap-2 py-3 text-center">
            <IconTile
              icon={effectiveMode === 'smart-capture' ? 'camera' : 'sparkles'}
              tone={activeTone}
              size="md"
            />
            <p className="text-caption font-bold">
              {effectiveMode === 'smart-capture'
                ? '点击拍照或从右侧选择模拟样本开始扫描'
                : '上传图片或 HTML / TXT 附件开始智能识别'}
            </p>
            <p className="text-tiny text-muted">未扫描出结果前，下方分区与表单不会提前暴露</p>
            <Button size="sm" variant="soft" icon="sparkles" onClick={onRescan}>
              开始模拟扫描
            </Button>
          </div>
        ) : customFileInfo?.kind === 'image' && customFileInfo.previewUrl ? (
          <div className="flex flex-col items-center gap-1.5 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- 内存 blob 预览，不落盘 */}
            <img
              src={customFileInfo.previewUrl}
              alt="上传图片扫描预览"
              className="max-h-40 rounded-xl object-contain"
            />
          </div>
        ) : customFileInfo?.kind === 'text' ? (
          <div className="bg-surface/90 border-border min-w-0 rounded-xl border p-3">
            <p className="text-tiny text-muted line-clamp-3 font-mono break-words whitespace-pre-wrap">
              {customFileInfo.previewText || '（空文本内容）'}
            </p>
          </div>
        ) : (
          <div className="flex min-w-0 items-start gap-3 py-1">
            <IconTile icon={moduleMeta[activeTone].icon} tone={activeTone} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-caption truncate font-bold">{preset.visualTitle}</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {preset.visualLines.map((line) => (
                  <li key={line} className="text-tiny text-muted truncate">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 下方实时 1、2、3 步骤轨迹：始终展示 1、2、3 图标，进行到哪一步哪一步前面就转圈圈 */}
      <ol className="bg-surface-sunken/60 flex min-w-0 flex-col gap-1.5 rounded-xl px-3 py-2">
        {preset.scanSteps.map((step, idx) => {
          const doneStep = phase === 'done' || (isScanning && idx < activeStepIdx)
          const activeStep = isScanning && idx === activeStepIdx
          return (
            <li key={step} className="flex min-w-0 items-center gap-2">
              {activeStep ? (
                <Icon
                  name="loader"
                  size={14}
                  strokeWidth={2.5}
                  className="animate-spin-slow text-primary shrink-0"
                />
              ) : doneStep ? (
                <Icon name="check" size={14} strokeWidth={2.5} className="text-success shrink-0" />
              ) : (
                <span className="size-3.5 shrink-0" aria-hidden />
              )}

              <span
                className={cn(
                  'font-display text-tiny flex size-5 shrink-0 items-center justify-center rounded-full font-bold',
                  doneStep
                    ? 'bg-success-soft text-success-ink'
                    : activeStep
                      ? 'bg-primary-soft text-primary-ink ring-primary/30 ring-2'
                      : 'bg-surface text-subtle',
                )}
              >
                {idx + 1}
              </span>
              <span
                className={cn(
                  'text-tiny min-w-0 flex-1 truncate',
                  activeStep
                    ? 'text-primary-ink font-semibold'
                    : doneStep
                      ? 'text-foreground font-semibold'
                      : 'text-muted',
                )}
              >
                {step}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ============================================================================
// 原子组件 1：板块智能判别器（SmartModuleDetector）
// ============================================================================

export interface SmartModuleDetectorProps {
  detectedModule: ModuleTone
  selectedModule: ModuleTone
  goalTitle?: string
  scanning?: boolean
  magicHighlight?: boolean
  onSelectModule: (m: ModuleTone) => void
}

export function SmartModuleDetector({
  selectedModule,
  magicHighlight = false,
  onSelectModule,
}: SmartModuleDetectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="识别出的打卡方向"
      className="bg-surface-sunken animate-pop-in flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-full p-1"
    >
      {moduleTones.map((m) => {
        const active = m === selectedModule
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelectModule(m)}
            className={cn(
              'text-tiny relative flex h-8.5 min-w-0 flex-1 items-center justify-center gap-1 overflow-hidden rounded-full px-1 font-semibold whitespace-nowrap transition-all duration-(--dur-fast) select-none active:scale-95',
              active
                ? cn(softToneClass[m], 'shadow-soft font-bold')
                : 'text-muted hover:text-foreground',
            )}
          >
            {active && magicHighlight && (
              <span className="bg-sheen animate-shimmer pointer-events-none absolute inset-0" />
            )}
            <Icon name={moduleMeta[m].icon} size={13} className="relative shrink-0" />
            <span className="relative truncate">{moduleMeta[m].label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// 原子组件 2：5 大打卡板块独立 AI 填充子组件（支持流式魔法填充动画）
// ============================================================================

export interface ModuleSmartFillProps {
  preset: SmartSamplePreset
  magicStreaming?: boolean
  magicStage?: 0 | 1 | 2 | 3 | 4
  field1Prog?: number
  field2Prog?: number
  noteProg?: number
  onConfirm: (summary: string) => void
}

/** 子组件 2.1：运动板块智能填充（ExerciseSmartFill） */
export function ExerciseSmartFill({
  preset,
  magicStreaming = false,
  magicStage = 4,
  field1Prog = 1,
  field2Prog = 1,
  noteProg = 1,
  onConfirm,
}: ModuleSmartFillProps) {
  const init = preset.exercise ?? SMART_PRESETS.exercise.exercise!
  const [category, setCategory] = useState(init.category)
  const [minutes, setMinutes] = useState<number | null>(init.minutes)
  const [intensity, setIntensity] = useState<Intensity>(init.intensity)
  const [note, setNote] = useState(init.note)

  const shownCategory = magicStreaming ? sliceStr(init.category, field1Prog) : category
  const shownMinutes = magicStreaming ? countNum(init.minutes, field2Prog) : minutes
  const shownNote = magicStreaming ? sliceStr(init.note, noteProg) : note

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <MagicFieldBlock stage={1} activeStage={magicStage} streaming={magicStreaming}>
        <Field label="运动品类" htmlFor="smart-ex-cat" aside="AI 已识别" className="min-w-0 gap-1">
          <Input
            id="smart-ex-cat"
            value={shownCategory}
            onChange={(e) => setCategory(e.target.value)}
            className="text-caption h-10 px-3"
          />
        </Field>
      </MagicFieldBlock>
      <MagicFieldBlock
        stage={2}
        activeStage={magicStage}
        streaming={magicStreaming}
        className="flex flex-col gap-2.5"
      >
        <Field
          label="运动时长"
          htmlFor="smart-ex-min"
          aside={`约消耗 ${init.kcal} kcal`}
          className="min-w-0 gap-1"
        >
          <NumberField
            id="smart-ex-min"
            size="sm"
            value={shownMinutes}
            onValueChange={setMinutes}
            min={1}
            max={600}
            step={5}
            unit="分钟"
          />
        </Field>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-caption font-semibold">运动强度</span>
          <SegmentedControl
            size="sm"
            label="运动强度"
            value={intensity}
            onValueChange={setIntensity}
            options={[
              { value: 'easy', label: '轻松' },
              { value: 'moderate', label: '中等' },
              { value: 'hard', label: '高强度' },
            ]}
          />
        </div>
      </MagicFieldBlock>
      <MagicFieldBlock stage={3} activeStage={magicStage} streaming={magicStreaming}>
        <Field label="备注" htmlFor="smart-ex-note" aside="可微调" className="min-w-0 gap-1">
          <Input
            id="smart-ex-note"
            value={shownNote}
            onChange={(e) => setNote(e.target.value)}
            className="text-caption h-10 px-3"
          />
        </Field>
      </MagicFieldBlock>
      <Button
        size="sm"
        icon="check"
        className="h-10 w-full"
        onClick={() => onConfirm(`运动打卡：${category} ${minutes ?? 0} 分钟`)}
      >
        确认记录到「动一动」
      </Button>
    </div>
  )
}

/** 子组件 2.2：饮食板块智能填充（DietSmartFill） */
export function DietSmartFill({
  preset,
  magicStreaming = false,
  magicStage = 4,
  field1Prog = 1,
  field2Prog = 1,
  onConfirm,
}: ModuleSmartFillProps) {
  const init = preset.diet ?? SMART_PRESETS.diet.diet!
  const [meal, setMeal] = useState<MealType>(init.meal)
  const [items, setItems] = useState(init.items)

  const visibleCount = magicStreaming
    ? Math.max(1, Math.ceil(items.length * Math.max(field1Prog, field2Prog)))
    : items.length
  const shownItems = items.slice(0, visibleCount).map((it) => ({
    name: magicStreaming ? sliceStr(it.name, Math.max(0.3, field1Prog)) : it.name,
    portion: magicStreaming ? sliceStr(it.portion, field2Prog) : it.portion,
    kcal: magicStreaming ? countNum(it.kcal, field2Prog) : it.kcal,
  }))

  const totalKcal = shownItems.reduce((acc, i) => acc + i.kcal, 0)

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <SegmentedControl
        size="sm"
        label="餐次"
        value={meal}
        onValueChange={setMeal}
        options={[
          { value: 'breakfast', label: '早餐' },
          { value: 'lunch', label: '午餐' },
          { value: 'dinner', label: '晚餐' },
          { value: 'snack', label: '加餐' },
        ]}
      />
      <MagicFieldBlock stage={1} activeStage={magicStage} streaming={magicStreaming}>
        <div className="bg-surface-sunken divide-border divide-y rounded-2xl px-3 py-0.5">
          {shownItems.map((item, idx) => (
            <div
              key={idx}
              className="animate-fade-up flex min-w-0 items-center justify-between gap-2 py-2"
            >
              <div className="min-w-0 flex-1">
                <input
                  value={item.name}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it)),
                    )
                  }
                  aria-label={`第 ${idx + 1} 项食物名称`}
                  className="text-caption w-full min-w-0 truncate bg-transparent font-semibold outline-none"
                />
                <span className="text-tiny text-muted block truncate">{item.portion}</span>
              </div>
              <span className="font-display text-diet-ink bg-diet-soft text-tiny shrink-0 rounded-full px-2 py-0.5 font-semibold tabular-nums">
                {item.kcal} kcal
              </span>
            </div>
          ))}
        </div>
      </MagicFieldBlock>
      <p className="text-tiny text-muted flex flex-wrap items-center justify-between gap-1">
        <span>估算结果，非医疗建议</span>
        <span className="font-display text-foreground font-semibold">合计约 {totalKcal} kcal</span>
      </p>
      <Button
        size="sm"
        icon="check"
        className="h-10 w-full"
        onClick={() =>
          onConfirm(`饮食打卡：${items.map((i) => i.name).join('、')}（${totalKcal} kcal）`)
        }
      >
        确认记录到「好好吃饭」
      </Button>
    </div>
  )
}

/** 子组件 2.3：睡眠板块智能填充（SleepSmartFill） */
export function SleepSmartFill({
  preset,
  magicStreaming = false,
  magicStage = 4,
  field2Prog = 1,
  noteProg = 1,
  onConfirm,
}: ModuleSmartFillProps) {
  const init = preset.sleep ?? SMART_PRESETS.sleep.sleep!
  const [bed, setBed] = useState(init.bed)
  const [wake, setWake] = useState(init.wake)
  const [quality, setQuality] = useState<RatingValue | null>(init.quality)
  const [note, setNote] = useState(init.note)

  const shownQuality = magicStreaming
    ? (Math.max(1, Math.round(init.quality * Math.max(0.3, field2Prog))) as RatingValue)
    : quality
  const shownNote = magicStreaming ? sliceStr(init.note, noteProg) : note

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <MagicFieldBlock stage={1} activeStage={magicStage} streaming={magicStreaming}>
        <TimeRangeField
          label="入睡与起床时刻"
          start={bed}
          end={wake}
          onStartChange={setBed}
          onEndChange={setWake}
          hint={`深睡约 ${init.deepHours}`}
        />
      </MagicFieldBlock>
      <MagicFieldBlock stage={2} activeStage={magicStage} streaming={magicStreaming}>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-caption font-semibold">睡眠质量</span>
          <Rating value={shownQuality} onValueChange={setQuality} tone="sleep" label="睡眠质量" />
        </div>
      </MagicFieldBlock>
      <MagicFieldBlock stage={3} activeStage={magicStage} streaming={magicStreaming}>
        <Field label="睡眠备注" htmlFor="smart-sl-note" aside="可微调" className="min-w-0 gap-1">
          <Input
            id="smart-sl-note"
            value={shownNote}
            onChange={(e) => setNote(e.target.value)}
            className="text-caption h-10 px-3"
          />
        </Field>
      </MagicFieldBlock>
      <Button
        size="sm"
        icon="check"
        className="h-10 w-full"
        onClick={() => onConfirm(`睡眠打卡：${bed} → ${wake}（质量 ${quality ?? 4}/5）`)}
      >
        确认记录到「早点睡」
      </Button>
    </div>
  )
}

/** 子组件 2.4：学习板块智能填充（StudySmartFill） */
export function StudySmartFill({
  preset,
  magicStreaming = false,
  magicStage = 4,
  field1Prog = 1,
  field2Prog = 1,
  noteProg = 1,
  onConfirm,
}: ModuleSmartFillProps) {
  const init = preset.study ?? SMART_PRESETS.study.study!
  const [what, setWhat] = useState(init.what)
  const [minutes, setMinutes] = useState<number | null>(init.minutes)
  const [note, setNote] = useState(init.note)

  const shownWhat = magicStreaming ? sliceStr(init.what, field1Prog) : what
  const shownMinutes = magicStreaming ? countNum(init.minutes, field2Prog) : minutes
  const shownNote = magicStreaming ? sliceStr(init.note, noteProg) : note

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <MagicFieldBlock stage={1} activeStage={magicStage} streaming={magicStreaming}>
        <Field label="学了什么" htmlFor="smart-st-what" aside="AI 提炼" className="min-w-0 gap-1">
          <Input
            id="smart-st-what"
            value={shownWhat}
            onChange={(e) => setWhat(e.target.value)}
            className="text-caption h-10 px-3"
          />
        </Field>
      </MagicFieldBlock>
      <MagicFieldBlock stage={2} activeStage={magicStage} streaming={magicStreaming}>
        <Field label="专注时长" htmlFor="smart-st-min" className="min-w-0 gap-1">
          <NumberField
            id="smart-st-min"
            size="sm"
            value={shownMinutes}
            onValueChange={setMinutes}
            min={1}
            max={1440}
            step={5}
            unit="分钟"
          />
        </Field>
      </MagicFieldBlock>
      <MagicFieldBlock stage={3} activeStage={magicStage} streaming={magicStreaming}>
        <Field label="要点摘录" htmlFor="smart-st-note" aside="可微调" className="min-w-0 gap-1">
          <Textarea
            id="smart-st-note"
            rows={2}
            value={shownNote}
            onChange={(e) => setNote(e.target.value)}
            className="text-caption min-h-16 px-3 py-2"
          />
        </Field>
      </MagicFieldBlock>
      <Button
        size="sm"
        icon="check"
        className="h-10 w-full"
        onClick={() => onConfirm(`学习打卡：${what}（${minutes ?? 0} 分钟）`)}
      >
        确认记录到「学一点」
      </Button>
    </div>
  )
}

/** 子组件 2.5：自定义板块智能填充（CustomSmartFill） */
export function CustomSmartFill({
  preset,
  magicStreaming = false,
  magicStage = 4,
  field2Prog = 1,
  noteProg = 1,
  onConfirm,
}: ModuleSmartFillProps) {
  const init = preset.custom ?? SMART_PRESETS.custom.custom!
  const [cups, setCups] = useState<number | null>(init.cups)
  const [moodNote, setMoodNote] = useState(init.moodNote)

  const shownCups = magicStreaming ? countNum(init.cups, field2Prog) : cups
  const shownNote = magicStreaming ? sliceStr(init.moodNote, noteProg) : moodNote

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="bg-custom-soft/50 text-custom-ink flex min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2">
        <span className="text-caption min-w-0 truncate font-semibold">{init.habitName}</span>
        <Badge tone="custom" className="shrink-0">
          动态字段
        </Badge>
      </div>
      <MagicFieldBlock stage={1} activeStage={magicStage} streaming={magicStreaming}>
        <Field label="今日完成数量" htmlFor="smart-cu-cups" className="min-w-0 gap-1">
          <NumberField
            id="smart-cu-cups"
            size="sm"
            value={shownCups}
            onValueChange={setCups}
            min={1}
            max={20}
            step={1}
            unit="杯"
          />
        </Field>
      </MagicFieldBlock>
      <MagicFieldBlock stage={3} activeStage={magicStage} streaming={magicStreaming}>
        <Field
          label="习惯打卡心得"
          htmlFor="smart-cu-note"
          aside="可微调"
          className="min-w-0 gap-1"
        >
          <Input
            id="smart-cu-note"
            value={shownNote}
            onChange={(e) => setMoodNote(e.target.value)}
            className="text-caption h-10 px-3"
          />
        </Field>
      </MagicFieldBlock>
      <Button
        size="sm"
        icon="check"
        className="h-10 w-full"
        onClick={() => onConfirm(`自定义打卡：${init.habitName} · ${cups ?? 0} 杯`)}
      >
        确认记录到「我的小目标」
      </Button>
    </div>
  )
}

export const smartModuleFillComponents: Record<
  ModuleTone,
  (props: ModuleSmartFillProps) => ReactNode
> = {
  exercise: (props) => <ExerciseSmartFill {...props} />,
  diet: (props) => <DietSmartFill {...props} />,
  sleep: (props) => <SleepSmartFill {...props} />,
  study: (props) => <StudySmartFill {...props} />,
  custom: (props) => <CustomSmartFill {...props} />,
}

// ============================================================================
// 原子组件 3：全板块统一的打卡模式 Tab 栏（CheckinModeTabs）
// ============================================================================

const modeTabOptions: { value: CheckinInputMode; label: string; icon: IconName }[] = [
  { value: 'manual', label: '手动填写', icon: 'edit' },
  { value: 'smart-capture', label: '智能拍照', icon: 'camera' },
  { value: 'smart-upload', label: '智能上传', icon: 'sparkles' },
]

export function CheckinModeTabs({
  value,
  onValueChange,
}: {
  value: CheckinInputMode
  onValueChange: (next: CheckinInputMode) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="打卡记录方式"
      className="bg-surface-sunken grid grid-cols-3 gap-1 rounded-full p-1"
    >
      {modeTabOptions.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              'text-caption flex h-9 min-w-0 items-center justify-center gap-1 rounded-full px-1.5 font-semibold whitespace-nowrap transition-all duration-(--dur-fast) select-none',
              active
                ? 'bg-surface text-primary-ink shadow-soft'
                : 'text-muted hover:text-foreground',
            )}
          >
            <Icon name={tab.icon} size={14} lineOnly={active} className="shrink-0" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// 联动沙盒 1：全局「智能识别页面」（放入 PhoneFrame 手机框内渲染）
// ============================================================================

export function GlobalSmartRecognitionDemo({
  initialModule = 'exercise',
}: {
  initialModule?: ModuleTone
  initialAction?: 'capture' | 'upload'
}) {
  const [sampleKey, setSampleKey] = useState<ModuleTone>(initialModule)
  const [selectedModule, setSelectedModule] = useState<ModuleTone>(initialModule)
  const [phase, setPhase] = useState<ScanPhase>('done')
  const [streamSeq, setStreamSeq] = useState(1)
  const [stampedText, setStampedText] = useState<string | null>(null)
  const [customFileInfo, setCustomFileInfo] = useState<{
    name: string
    kind: 'image' | 'text'
    previewText?: string
    previewUrl?: string
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const preset = SMART_PRESETS[sampleKey]
  const activePreset = SMART_PRESETS[selectedModule]
  const FillComponent = smartModuleFillComponents[selectedModule]

  const magic = usePlaybookMagicStream(`${selectedModule}-${streamSeq}`, phase === 'done')

  function triggerScan(nextModule: ModuleTone) {
    setSampleKey(nextModule)
    setSelectedModule(nextModule)
    setStampedText(null)
    setPhase('scanning')
  }

  useEffect(() => {
    if (phase !== 'scanning') return
    const timer = setTimeout(() => {
      setStreamSeq((s) => s + 1)
      setPhase('done')
    }, 1250)
    return () => clearTimeout(timer)
  }, [phase])

  async function handleLocalFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStampedText(null)
    setPhase('scanning')
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setCustomFileInfo({ name: file.name, kind: 'image', previewUrl: url })
      const lower = file.name.toLowerCase()
      const guessed: ModuleTone = lower.includes('sleep')
        ? 'sleep'
        : lower.includes('run') || lower.includes('keep')
          ? 'exercise'
          : 'diet'
      setSampleKey(guessed)
      setSelectedModule(guessed)
    } else {
      const raw = await file.text()
      const clean = raw
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 220)
      setCustomFileInfo({ name: file.name, kind: 'text', previewText: clean || raw.slice(0, 220) })
      setSampleKey('study')
      setSelectedModule('study')
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
      {/* 左侧：真实手机屏幕外框（360px 视口） */}
      <div className="flex justify-center">
        <PhoneFrame label="手机 · /checkin/smart（全局智能识别页）" className="h-[760px]">
          <div className="flex h-full flex-col overflow-hidden">
            <TopBar
              sticky={false}
              title="智能识别"
              leading={<IconButton icon="chevron-left" label="返回" className="-ml-2" />}
              className="shrink-0 pt-10"
            />
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 pt-2 pb-6">
              {/* 1. 扫描镜 */}
              <SmartScannerLens
                preset={preset}
                phase={phase}
                tone={selectedModule}
                customFileInfo={customFileInfo}
                onRescan={() => setPhase('scanning')}
              />

              {/* 2. 扫描中：展示「正在搜索匹配的打卡分区」自定义懒加载动画 */}
              {phase === 'scanning' && <SmartPartitionSearchLoader />}

              {/* 3. 识别完成后：锁定一行识别方向条 + Agent 流式魔法摘要 + 各字段逐行流式填入 */}
              {phase === 'done' && (
                <>
                  <SmartModuleDetector
                    detectedModule={preset.module}
                    selectedModule={selectedModule}
                    magicHighlight={magic.streaming}
                    onSelectModule={(m) => {
                      setSelectedModule(m)
                      setStreamSeq((s) => s + 1)
                      setStampedText(null)
                    }}
                  />

                  <SmartMagicTurnBanner
                    tone={selectedModule}
                    summary={sliceStr(
                      activePreset.summaryText ?? activePreset.visualTitle,
                      magic.summaryProg,
                    )}
                    streaming={magic.streaming}
                    magicStage={magic.stage}
                  />

                  <Card className="animate-fade-up flex flex-col gap-3 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <IconTile
                          icon={moduleMeta[selectedModule].icon}
                          tone={selectedModule}
                          size="sm"
                        />
                        <span className="text-caption truncate font-bold">
                          {activePreset.goalTitle}
                        </span>
                      </div>
                      <Badge tone={selectedModule}>
                        {magic.streaming ? '魔法写入中…' : moduleMeta[selectedModule].label}
                      </Badge>
                    </div>

                    {stampedText ? (
                      <div className="flex flex-col items-center gap-2 py-5 text-center">
                        <div className="relative">
                          <Mascot mood="cheer" size={80} />
                          <Stamp
                            caption="11.05"
                            tone={selectedModule}
                            animate
                            size={58}
                            className="absolute -top-2 -right-9"
                          />
                        </div>
                        <p className="text-caption font-bold">{stampedText}</p>
                        <Button variant="soft" size="sm" onClick={() => setStampedText(null)}>
                          继续修改
                        </Button>
                      </div>
                    ) : (
                      <FillComponent
                        key={`${activePreset.id}-${streamSeq}`}
                        preset={activePreset}
                        magicStreaming={magic.streaming}
                        magicStage={magic.stage}
                        field1Prog={magic.field1Prog}
                        field2Prog={magic.field2Prog}
                        noteProg={magic.noteProg}
                        onConfirm={(summary) => {
                          setStampedText(summary)
                          toast.success(summary)
                        }}
                      />
                    )}
                  </Card>
                </>
              )}
            </div>
          </div>
        </PhoneFrame>
      </div>

      {/* 右侧：沙盒测试控制台与页面拆解说明 */}
      <div className="flex min-w-0 flex-col gap-3.5">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-subhead font-bold">切换模拟样本与阶段（体验流式魔法填充）</span>
            <Badge tone="primary" icon="sparkles">
              沙盒控制台
            </Badge>
          </div>
          <p className="text-caption text-muted">
            点击下方 5 种预设样本：先观察取景框内扫描条上下往返 + 1/2/3 步骤转圈 +
            下方「正在搜索匹配的打卡分区」轮询动画；识别完成后复用 Agent 流式效果逐项魔法填入表单！
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={phase === 'idle' ? 'primary' : 'secondary'}
              onClick={() => setPhase('idle')}
            >
              阶段 0：未扫描（下方留白）
            </Button>
            <Button
              size="sm"
              variant={phase === 'scanning' ? 'primary' : 'soft'}
              icon="search"
              onClick={() => setPhase('scanning')}
            >
              阶段 1：扫描与搜索分区动画
            </Button>
            <Button
              size="sm"
              variant={phase === 'done' ? 'primary' : 'soft'}
              icon="sparkles"
              onClick={() => {
                setStreamSeq((s) => s + 1)
                setPhase('done')
              }}
            >
              阶段 2：重播流式魔法填充
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {moduleTones.map((m) => {
              const active = sampleKey === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setCustomFileInfo(null)
                    triggerScan(m)
                  }}
                  className={cn(
                    'text-caption flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left font-semibold transition-all active:scale-95',
                    active
                      ? cn(softToneClass[m], 'shadow-soft border-current font-bold')
                      : 'border-border bg-surface-sunken/60 text-muted hover:text-foreground',
                  )}
                >
                  <Icon name={moduleMeta[m].icon} size={16} className="shrink-0" />
                  <span className="truncate">
                    {m === 'study'
                      ? '学习 HTML'
                      : m === 'custom'
                        ? '饮水 TXT'
                        : `${moduleMeta[m].label}图片`}
                  </span>
                </button>
              )
            })}
            <input
              ref={fileInputRef}
              type="file"
              accept={SMART_UPLOAD_ACCEPT}
              className="sr-only"
              onChange={(e) => void handleLocalFile(e)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="border-primary/30 bg-primary-soft/60 text-primary-ink text-caption flex items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-2.5 font-semibold transition-all hover:brightness-[0.98] active:scale-95"
            >
              <Icon name="plus" size={15} />
              <span className="truncate">传本地文件</span>
            </button>
          </div>
        </Card>

        <Card variant="sunken" className="flex flex-col gap-2">
          <p className="text-caption font-bold">三阶段流式魔法交互编排</p>
          <ol className="text-tiny text-muted space-y-1.5 leading-relaxed">
            <li>
              1. <strong className="text-foreground">未扫描前（Idle）</strong>
              ：仅展示扫描镜，不提前暴露下方识别方向条和打卡表单。
            </li>
            <li>
              2. <strong className="text-foreground">扫描与搜索分区（Scanning）</strong>
              ：扫描条上下往返移动，1/2/3 步骤依次转圈；下方挂载{' '}
              <code>SmartPartitionSearchLoader</code> 轮询探测 5 大打卡分区。
            </li>
            <li>
              3. <strong className="text-foreground">流式魔法填充（Magic Stream）</strong>
              ：复用 Agent 的 <code>AnswerText</code>{' '}
              流式光标输出摘要，并按字段顺序逐字填入、数字递增。
            </li>
          </ol>
        </Card>
      </div>
    </div>
  )
}

// ============================================================================
// 联动沙盒 2：单板块打卡页内统一 Tab 栏（放入 PhoneFrame 手机框内渲染，跳过判别器）
// ============================================================================

export function UnifiedModuleCheckinTabDemo() {
  const [activeModule, setActiveModule] = useState<ModuleTone>('exercise')
  const [inputMode, setInputMode] = useState<CheckinInputMode>('smart-capture')
  const [phase, setPhase] = useState<ScanPhase>('done')
  const [streamSeq, setStreamSeq] = useState(1)

  const preset = SMART_PRESETS[activeModule]
  const FillComponent = smartModuleFillComponents[activeModule]
  const magic = usePlaybookMagicStream(
    `tab-${activeModule}-${streamSeq}`,
    inputMode !== 'manual' && phase === 'done',
  )

  useEffect(() => {
    if (phase !== 'scanning') return
    const t = setTimeout(() => {
      setStreamSeq((s) => s + 1)
      setPhase('done')
    }, 1150)
    return () => clearTimeout(t)
  }, [phase])

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
      {/* 左侧：真实手机屏幕外框（360px 视口） */}
      <div className="flex justify-center">
        <PhoneFrame label={`手机 · /goals/${activeModule}/checkin`} className="h-[760px]">
          <div className="flex h-full flex-col overflow-hidden">
            <TopBar
              sticky={false}
              title={preset.goalTitle}
              leading={<IconButton icon="chevron-left" label="返回" className="-ml-2" />}
              actions={<Badge tone={activeModule}>{moduleMeta[activeModule].label}</Badge>}
              className="shrink-0 pt-10"
            />
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 pt-2 pb-6">
              {/* 顶部今日目标进度与全板块统一 Tab 栏 */}
              <Card className="flex flex-col gap-2.5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <IconTile icon={moduleMeta[activeModule].icon} tone={activeModule} size="sm" />
                    <span className="text-caption truncate font-bold">
                      今日进度 · {preset.goalTitle}
                    </span>
                  </div>
                  <span className="font-display text-tiny text-muted">1 / 3</span>
                </div>
                <ProgressBar value={1} max={3} tone={activeModule} size="sm" label="今日进度" />
                <CheckinModeTabs
                  value={inputMode}
                  onValueChange={(next) => {
                    setInputMode(next)
                    if (next !== 'manual') setPhase('scanning')
                  }}
                />
              </Card>

              {/* 切到智能拍照 / 智能上传时，已知当前板块，直接挂载扫描镜（无板块判别器！） */}
              {inputMode !== 'manual' && (
                <SmartScannerLens
                  preset={preset}
                  phase={phase}
                  mode={inputMode}
                  tone={activeModule}
                  onRescan={() => setPhase('scanning')}
                />
              )}

              {/* 扫描进行中：展示当前板块专属提取动画，不提前暴露下方表单 */}
              {inputMode !== 'manual' && phase === 'scanning' && (
                <SmartPartitionSearchLoader knownModule={activeModule} />
              )}

              {/* 识别完成后（或手动填写模式下）：展示流式魔法摘要与填充表单 */}
              {(inputMode === 'manual' || phase === 'done') && (
                <>
                  {inputMode !== 'manual' && (
                    <SmartMagicTurnBanner
                      tone={activeModule}
                      summary={sliceStr(
                        preset.summaryText ?? preset.visualTitle,
                        magic.summaryProg,
                      )}
                      streaming={magic.streaming}
                      magicStage={magic.stage}
                    />
                  )}

                  <Card className="animate-fade-up flex flex-col gap-3 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-caption font-bold">
                        {inputMode === 'manual' ? '手动填写数值' : 'AI 识别结果（可微调）'}
                      </span>
                      <Badge tone={inputMode === 'manual' ? 'neutral' : activeModule}>
                        {inputMode === 'manual'
                          ? '默认模式'
                          : magic.streaming
                            ? '魔法写入中…'
                            : inputMode === 'smart-capture'
                              ? '智能拍照'
                              : '智能上传'}
                      </Badge>
                    </div>
                    <FillComponent
                      key={`${preset.id}-${inputMode}-${streamSeq}`}
                      preset={preset}
                      magicStreaming={inputMode !== 'manual' && magic.streaming}
                      magicStage={magic.stage}
                      field1Prog={magic.field1Prog}
                      field2Prog={magic.field2Prog}
                      noteProg={magic.noteProg}
                      onConfirm={(summary) => toast.success(`已记录：${summary}`)}
                    />
                  </Card>
                </>
              )}
            </div>
          </div>
        </PhoneFrame>
      </div>

      {/* 右侧：切换查看 5 大独立打卡板块页的控制台 */}
      <div className="flex min-w-0 flex-col gap-3.5">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-subhead font-bold">切换查看 5 个独立打卡板块页面</span>
            <Badge tone="exercise">已知板块免判别</Badge>
          </div>
          <p className="text-caption text-muted">
            每一个单独的打卡板块页面顶部都有完全一致的「手动填写 | 智能拍照 | 智能上传」Tab 栏。
            切到「智能拍照 /
            智能上传」时，在扫描完成前只展示加载动画，识别完成后直接流式魔法填入当前板块表单！
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {moduleTones.map((m) => {
              const active = activeModule === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setActiveModule(m)
                    if (inputMode !== 'manual') setPhase('scanning')
                  }}
                  className={cn(
                    'text-caption flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left font-semibold transition-all active:scale-95',
                    active
                      ? cn(softToneClass[m], 'shadow-soft border-current font-bold')
                      : 'border-border bg-surface-sunken/60 text-muted hover:text-foreground',
                  )}
                >
                  <Icon name={moduleMeta[m].icon} size={16} className="shrink-0" />
                  <span className="truncate">{SMART_PRESETS[m].goalTitle}</span>
                </button>
              )
            })}
          </div>

          <div className="border-border bg-surface-sunken/60 flex flex-col gap-2 rounded-xl border p-3">
            <span className="text-tiny text-muted font-semibold">快捷切换左侧手机框内的 Tab：</span>
            <CheckinModeTabs
              value={inputMode}
              onValueChange={(next) => {
                setInputMode(next)
                if (next !== 'manual') setPhase('scanning')
              }}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}
