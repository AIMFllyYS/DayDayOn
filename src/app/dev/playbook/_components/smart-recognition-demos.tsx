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
import type { Intensity, MealType } from '@/features/checkin/schemas'
import { cn } from '@/lib/cn'
import { PhoneFrame } from './device-frame'
import { SMART_UPLOAD_ACCEPT } from './smart-action-bar'

/*
 * 智能识别页面与全板块模块化组件演示（Playbook 先行设计 · 第二轮批注迭代版）：
 *
 * 迭代要点（对齐批注 JSON）：
 * 1. 【扫描镜 SmartScannerLens】：去除顶部多余的「重拍」「传图」小标签与文件名路径，
 *    顶部仅保留左状态 + 右「重新扫描」，视窗内去除冗余标签，整体清爽聚焦。
 * 2. 【第 1 组件：板块智能判别器 SmartModuleDetector】：去除把握度百分比与长篇解释，
 *    收敛为「一行识别方向胶囊条」（AI 自动高亮对应板块，点击同行任意胶囊可秒切）。
 * 3. 【第 2 组件：5 大板块专属填充子组件】：表单内部全单列垂直排布（NumberField 等独占一行），
 *    在 Playbook 矩阵中采用每行 2 张卡片（1:1 还原手机宽度），彻底根除窄列挤压溢出。
 * 4. 【联动沙盒 A & B】：统一放入 <PhoneFrame> 手机框内渲染真实二级页面，右侧配切换控制台。
 */

export type CheckinInputMode = 'manual' | 'smart-capture' | 'smart-upload'
export type ScanPhase = 'scanning' | 'done'

export interface SmartSamplePreset {
  id: string
  module: ModuleTone
  goalTitle: string
  sourceKind: 'image' | 'text'
  visualTitle: string
  visualLines: string[]
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
    scanSteps: [
      '正在扫描运动截图中的轨迹与表盘数字…',
      '提取关键指标：跑步 · 32 分钟 · 中等强度',
      '已自动填入「动一动」运动打卡表单',
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
    scanSteps: [
      '正在扫描餐盘区域与食材份量比例…',
      '识别出 3 项食物并完成热量估算（共约 490 kcal）',
      '已自动生成「好好吃饭」可编辑饮食清单',
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
    scanSteps: [
      '正在扫描睡眠阶段波形图与起止时间戳…',
      '解析出跨午夜时段 23:15 → 次日 07:10',
      '已自动填入「早点睡」睡眠时间段与质量评分',
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
    scanSteps: [
      '正在读取纯文本 / HTML 附件并提纯正文…',
      '提炼学习主题「二叉树层序遍历」及专注 45 分钟',
      '已自动填入「学一点」学习打卡表单',
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
    scanSteps: [
      '正在解析文本记录与自定义目标字段定义…',
      '匹配字段：今日饮水杯数 = 7 杯 · 心得备注已提取',
      '已自动填入「我的小目标」动态表单',
    ],
    custom: {
      habitName: '每天喝够 8 杯温水',
      cups: 7,
      moodNote: '用柠檬水和绿茶代替了下午茶奶茶',
    },
  },
}

// ============================================================================
// 原子组件 0：扫描镜取景与实时分析流（SmartScannerLens）
// 极简头部：仅保留左侧扫描状态 + 右侧「重新扫描」，不放多余小标签与文件名路径
// ============================================================================

export interface SmartScannerLensProps {
  preset: SmartSamplePreset
  phase: ScanPhase
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
  customFileInfo,
  onRescan,
  tone,
}: SmartScannerLensProps) {
  const activeTone = tone ?? preset.module
  const isScanning = phase === 'scanning'

  return (
    <div className="border-border bg-surface shadow-soft flex min-w-0 flex-col gap-2.5 overflow-hidden rounded-2xl border p-3.5">
      {/* 极简顶部栏：左侧单一状态指示 + 右侧唯一「重新扫描」操作 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'size-2 shrink-0 rounded-full',
              isScanning ? 'bg-primary animate-pulse' : 'bg-success',
            )}
          />
          <span className="text-caption font-bold">
            {isScanning ? '团团扫描镜识别中…' : '扫描识别完成'}
          </span>
        </div>
        <button
          type="button"
          onClick={onRescan}
          className="text-primary-ink hover:bg-primary-soft/60 text-tiny inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 font-semibold transition-colors active:scale-95"
        >
          <Icon name="sparkles" size={13} />
          <span>重新扫描</span>
        </button>
      </div>

      {/* 扫描镜主视窗（四角手账对焦角标 + 往返呼吸扫描光束） */}
      <div className="bg-surface-sunken border-border-strong relative min-w-0 overflow-hidden rounded-2xl border p-3.5">
        <span className="border-primary pointer-events-none absolute top-2 left-2 size-3.5 rounded-tl-md border-t-2 border-l-2" />
        <span className="border-primary pointer-events-none absolute top-2 right-2 size-3.5 rounded-tr-md border-t-2 border-r-2" />
        <span className="border-primary pointer-events-none absolute bottom-2 left-2 size-3.5 rounded-bl-md border-b-2 border-l-2" />
        <span className="border-primary pointer-events-none absolute right-2 bottom-2 size-3.5 rounded-br-md border-r-2 border-b-2" />

        {/* 扫描光束 */}
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-2 z-10 transition-all duration-(--dur-slow)',
            isScanning ? 'animate-pulse opacity-100' : 'opacity-0',
          )}
          style={{ top: isScanning ? '36%' : '90%' }}
        >
          <div className="bg-primary h-0.5 w-full rounded-full shadow-sm" />
          <div className="from-primary/25 h-9 w-full bg-gradient-to-b to-transparent" />
        </div>

        {/* 视窗内容：无冗余小标签，纯净展示被扫描对象 */}
        {customFileInfo?.kind === 'image' && customFileInfo.previewUrl ? (
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
          <div className="flex min-w-0 items-start gap-3">
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

      {/* 下方实时 3 步分析流 */}
      <ol className="bg-surface-sunken/60 grid gap-1.5 rounded-xl px-3 py-2">
        {preset.scanSteps.map((step, idx) => {
          const doneStep = !isScanning || idx === 0
          const activeStep = isScanning && idx === 1
          return (
            <li key={step} className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'font-display text-tiny flex size-4.5 shrink-0 items-center justify-center rounded-full font-semibold',
                  doneStep
                    ? 'bg-success-soft text-success-ink'
                    : activeStep
                      ? 'bg-primary-soft text-primary-ink animate-breathe'
                      : 'bg-surface text-subtle',
                )}
              >
                {doneStep ? '✓' : idx + 1}
              </span>
              <span
                className={cn(
                  'text-tiny min-w-0 flex-1 truncate',
                  doneStep ? 'text-foreground font-semibold' : 'text-muted',
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
// 一行识别方向样式：去除把握度百分比和长段说明，5 大方向浓缩在一行内，AI 自动高亮，点选秒切
// ============================================================================

export interface SmartModuleDetectorProps {
  detectedModule: ModuleTone
  selectedModule: ModuleTone
  goalTitle?: string
  scanning?: boolean
  onSelectModule: (m: ModuleTone) => void
}

export function SmartModuleDetector({ selectedModule, onSelectModule }: SmartModuleDetectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="识别出的打卡方向"
      className="bg-surface-sunken flex min-w-0 items-center gap-1 rounded-full p-1"
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
              'text-tiny flex h-9 flex-1 items-center justify-center gap-1 rounded-full px-1.5 font-semibold whitespace-nowrap transition-all duration-(--dur-fast) select-none active:scale-95',
              active
                ? cn(softToneClass[m], 'shadow-soft font-bold')
                : 'text-muted hover:text-foreground',
            )}
          >
            <Icon name={moduleMeta[m].icon} size={13} className="shrink-0" />
            <span>{moduleMeta[m].label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// 原子组件 2：5 大打卡板块独立 AI 填充子组件
// 内部全部采用单列垂直流（严禁把 NumberField 塞进半宽双列），确保在 340–412px 手机宽度下零溢出
// ============================================================================

export interface ModuleSmartFillProps {
  preset: SmartSamplePreset
  onConfirm: (summary: string) => void
}

/** 子组件 2.1：运动板块智能填充（ExerciseSmartFill） */
export function ExerciseSmartFill({ preset, onConfirm }: ModuleSmartFillProps) {
  const init = preset.exercise ?? SMART_PRESETS.exercise.exercise!
  const [category, setCategory] = useState(init.category)
  const [minutes, setMinutes] = useState<number | null>(init.minutes)
  const [intensity, setIntensity] = useState<Intensity>(init.intensity)
  const [note, setNote] = useState(init.note)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Field label="运动品类" htmlFor="smart-ex-cat" aside="AI 已识别">
        <Input id="smart-ex-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
      </Field>
      <Field label="运动时长" htmlFor="smart-ex-min" aside={`约消耗 ${init.kcal} kcal`}>
        <NumberField
          id="smart-ex-min"
          value={minutes}
          onValueChange={setMinutes}
          min={1}
          max={600}
          step={5}
          unit="分钟"
        />
      </Field>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-caption font-semibold">运动强度</span>
        <SegmentedControl
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
      <Field label="备注" htmlFor="smart-ex-note" aside="可微调">
        <Input id="smart-ex-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button
        icon="check"
        className="w-full"
        onClick={() => onConfirm(`运动打卡：${category} ${minutes ?? 0} 分钟`)}
      >
        确认记录到「动一动」
      </Button>
    </div>
  )
}

/** 子组件 2.2：饮食板块智能填充（DietSmartFill） */
export function DietSmartFill({ preset, onConfirm }: ModuleSmartFillProps) {
  const init = preset.diet ?? SMART_PRESETS.diet.diet!
  const [meal, setMeal] = useState<MealType>(init.meal)
  const [items, setItems] = useState(init.items)

  const totalKcal = items.reduce((acc, i) => acc + i.kcal, 0)

  return (
    <div className="flex min-w-0 flex-col gap-3">
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
      <div className="bg-surface-sunken divide-border divide-y rounded-2xl px-3.5 py-1">
        {items.map((item, idx) => (
          <div key={idx} className="flex min-w-0 items-center justify-between gap-2 py-2.5">
            <div className="min-w-0 flex-1">
              <input
                value={item.name}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((it, i) => (i === idx ? { ...it, name: e.target.value } : it)),
                  )
                }
                aria-label={`第 ${idx + 1} 项食物名称`}
                className="text-body w-full min-w-0 truncate bg-transparent font-semibold outline-none"
              />
              <span className="text-tiny text-muted block truncate">{item.portion}</span>
            </div>
            <span className="font-display text-diet-ink bg-diet-soft text-tiny shrink-0 rounded-full px-2.5 py-0.5 font-semibold tabular-nums">
              {item.kcal} kcal
            </span>
          </div>
        ))}
      </div>
      <p className="text-tiny text-muted flex flex-wrap items-center justify-between gap-1">
        <span>估算结果，非医疗建议</span>
        <span className="font-display text-foreground font-semibold">合计约 {totalKcal} kcal</span>
      </p>
      <Button
        icon="check"
        className="w-full"
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
export function SleepSmartFill({ preset, onConfirm }: ModuleSmartFillProps) {
  const init = preset.sleep ?? SMART_PRESETS.sleep.sleep!
  const [bed, setBed] = useState(init.bed)
  const [wake, setWake] = useState(init.wake)
  const [quality, setQuality] = useState<RatingValue | null>(init.quality)
  const [note, setNote] = useState(init.note)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <TimeRangeField
        label="入睡与起床时刻"
        start={bed}
        end={wake}
        onStartChange={setBed}
        onEndChange={setWake}
        hint={`深睡约 ${init.deepHours}`}
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-caption font-semibold">睡眠质量</span>
        <Rating value={quality} onValueChange={setQuality} tone="sleep" label="睡眠质量" />
      </div>
      <Field label="睡眠备注" htmlFor="smart-sl-note" aside="可微调">
        <Input id="smart-sl-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button
        icon="check"
        className="w-full"
        onClick={() => onConfirm(`睡眠打卡：${bed} → ${wake}（质量 ${quality ?? 4}/5）`)}
      >
        确认记录到「早点睡」
      </Button>
    </div>
  )
}

/** 子组件 2.4：学习板块智能填充（StudySmartFill） */
export function StudySmartFill({ preset, onConfirm }: ModuleSmartFillProps) {
  const init = preset.study ?? SMART_PRESETS.study.study!
  const [what, setWhat] = useState(init.what)
  const [minutes, setMinutes] = useState<number | null>(init.minutes)
  const [note, setNote] = useState(init.note)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Field label="学了什么" htmlFor="smart-st-what" aside="AI 提炼">
        <Input id="smart-st-what" value={what} onChange={(e) => setWhat(e.target.value)} />
      </Field>
      <Field label="专注时长" htmlFor="smart-st-min">
        <NumberField
          id="smart-st-min"
          value={minutes}
          onValueChange={setMinutes}
          min={1}
          max={1440}
          step={5}
          unit="分钟"
        />
      </Field>
      <Field label="要点摘录" htmlFor="smart-st-note" aside="可微调">
        <Textarea
          id="smart-st-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <Button
        icon="check"
        className="w-full"
        onClick={() => onConfirm(`学习打卡：${what}（${minutes ?? 0} 分钟）`)}
      >
        确认记录到「学一点」
      </Button>
    </div>
  )
}

/** 子组件 2.5：自定义板块智能填充（CustomSmartFill） */
export function CustomSmartFill({ preset, onConfirm }: ModuleSmartFillProps) {
  const init = preset.custom ?? SMART_PRESETS.custom.custom!
  const [cups, setCups] = useState<number | null>(init.cups)
  const [moodNote, setMoodNote] = useState(init.moodNote)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="bg-custom-soft/50 text-custom-ink flex min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2">
        <span className="text-caption min-w-0 truncate font-semibold">{init.habitName}</span>
        <Badge tone="custom">动态字段</Badge>
      </div>
      <Field label="今日完成数量" htmlFor="smart-cu-cups">
        <NumberField
          id="smart-cu-cups"
          value={cups}
          onValueChange={setCups}
          min={1}
          max={20}
          step={1}
          unit="杯"
        />
      </Field>
      <Field label="习惯打卡心得" htmlFor="smart-cu-note" aside="可微调">
        <Input id="smart-cu-note" value={moodNote} onChange={(e) => setMoodNote(e.target.value)} />
      </Field>
      <Button
        icon="check"
        className="w-full"
        onClick={() => onConfirm(`自定义打卡：${init.habitName} · ${cups ?? 0} 杯`)}
      >
        确认记录到「我的小目标」
      </Button>
    </div>
  )
}

/**
 * 5 大打卡方向的静态组件字典（无需复杂动态注册表）
 */
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
// 联动沙盒 1：全局「智能识别页面」（放入 PhoneFrame 手机框内渲染，清晰直观）
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

  function triggerScan(nextModule: ModuleTone) {
    setSampleKey(nextModule)
    setSelectedModule(nextModule)
    setStampedText(null)
    setPhase('scanning')
  }

  useEffect(() => {
    if (phase !== 'scanning') return
    const timer = setTimeout(() => setPhase('done'), 1000)
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
        <PhoneFrame label="手机 · /checkin/smart（全局智能识别页）" className="h-[740px]">
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

              {/* 2. 一行识别方向条（组件 01） */}
              <SmartModuleDetector
                detectedModule={preset.module}
                selectedModule={selectedModule}
                scanning={phase === 'scanning'}
                onSelectModule={(m) => {
                  setSelectedModule(m)
                  setStampedText(null)
                }}
              />

              {/* 3. 动态加载的对应板块子组件（组件 02） */}
              <Card className="flex flex-col gap-3 p-3.5">
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
                  <Badge tone={selectedModule}>{moduleMeta[selectedModule].label}</Badge>
                </div>

                {stampedText ? (
                  <div className="flex flex-col items-center gap-2 py-5 text-center">
                    <div className="relative">
                      <Mascot mood="cheer" size={80} />
                      <Stamp
                        caption="11.03"
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
                    key={activePreset.id}
                    preset={activePreset}
                    onConfirm={(summary) => {
                      setStampedText(summary)
                      toast.success(summary)
                    }}
                  />
                )}
              </Card>
            </div>
          </div>
        </PhoneFrame>
      </div>

      {/* 右侧：沙盒测试控制台与页面拆解说明 */}
      <div className="flex min-w-0 flex-col gap-3.5">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-subhead font-bold">切换模拟样本（测试自动识别方向）</span>
            <Badge tone="primary" icon="sparkles">
              沙盒控制台
            </Badge>
          </div>
          <p className="text-caption text-muted">
            点击下方 5 种预设样本（或上传本机真实图片 / HTML / TXT 文件），观察左侧手机框内：
            扫描镜实时扫描 → 一行识别方向条自动高亮对应板块 → 下方自动切换为该板块的填充子组件。
          </p>
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
          <p className="text-caption font-bold">全局智能识别页三段式结构</p>
          <ol className="text-tiny text-muted space-y-1.5 leading-relaxed">
            <li>
              1. <strong className="text-foreground">SmartScannerLens（扫描镜）</strong>
              ：极简顶栏（仅保留状态与「重新扫描」），视窗内呼吸扫描光束配合底部 3 步实时识别轨迹。
            </li>
            <li>
              2. <strong className="text-foreground">SmartModuleDetector（一行识别方向条）</strong>
              ：不展示冗余把握度百分比，5 大打卡方向濃縮在同一行胶囊内，AI
              自动高亮，用户也可一键点选改向。
            </li>
            <li>
              3. <strong className="text-foreground">5 选 1 板块填充子组件</strong>
              ：根据选中的方向从静态字典挂载对应表单，预填识别出的数值供核对确认。
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

  const preset = SMART_PRESETS[activeModule]
  const FillComponent = smartModuleFillComponents[activeModule]

  useEffect(() => {
    if (phase !== 'scanning') return
    const t = setTimeout(() => setPhase('done'), 900)
    return () => clearTimeout(t)
  }, [phase])

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
      {/* 左侧：真实手机屏幕外框（360px 视口） */}
      <div className="flex justify-center">
        <PhoneFrame label={`手机 · /goals/${activeModule}/checkin`} className="h-[740px]">
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
                  tone={activeModule}
                  onRescan={() => setPhase('scanning')}
                />
              )}

              {/* 当前板块的填充表单（手动与智能模式共用同一个子组件） */}
              <Card className="flex flex-col gap-3 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-bold">
                    {inputMode === 'manual' ? '手动填写数值' : 'AI 识别结果（可微调）'}
                  </span>
                  <Badge tone={inputMode === 'manual' ? 'neutral' : activeModule}>
                    {inputMode === 'manual'
                      ? '默认模式'
                      : inputMode === 'smart-capture'
                        ? '智能拍照'
                        : '智能上传'}
                  </Badge>
                </div>
                <FillComponent
                  key={`${preset.id}-${inputMode}`}
                  preset={preset}
                  onConfirm={(summary) => toast.success(`已记录：${summary}`)}
                />
              </Card>
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
            在左侧手机框内切换 Tab 试试：切到「智能拍照 / 智能上传」时，因为已经明确知道在哪个板块，
            <strong>直接跳过「一行识别方向条」</strong>，扫描后直接把数据填入当前板块表单！
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {moduleTones.map((m) => {
              const active = activeModule === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setActiveModule(m)}
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
