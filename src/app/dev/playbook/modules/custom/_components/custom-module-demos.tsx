'use client'

import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/top-bar'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { NumberField } from '@/components/ui/number-field'
import { ProgressBar } from '@/components/ui/progress'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Stamp } from '@/components/ui/stamp'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { PhoneFrame } from '../../../_components/device-frame'
import { deckClass } from '../../_components/deck'
import {
  CheckinModeTabs,
  SmartScannerLens,
  type CheckinInputMode,
  type ScanPhase,
  type SmartSamplePreset,
} from '../../../_components/smart-recognition-demos'

// ============================================================================
// 自定义目标模板与个性化 AI 裁判模型
// ============================================================================

export type CustomGoalTemplateId = 'sugar-free-water' | 'kaoyan-reading' | 'calligraphy-daily'

export type DynamicFieldKind =
  'number' | 'text' | 'select' | 'multiselect' | 'boolean' | 'duration' | 'rating'

export interface CustomGoalTemplate {
  id: CustomGoalTemplateId
  title: string
  periodLabel: string
  startDate: string
  endDate: string
  totalDays: number
  completedDays: number
  activeFieldKinds: DynamicFieldKind[]
  fieldsSummary: { name: string; kindLabel: string; ruleDesc: string }[]
  ruleFormula: string
  aiNaturalRule: string
}

const DYNAMIC_FIELD_CATALOG: { kind: DynamicFieldKind; label: string; example: string }[] = [
  { kind: 'number', label: '数字 Number', example: '杯数 / 篇数 / 页数' },
  { kind: 'duration', label: '时长 Duration', example: '专注分钟数' },
  { kind: 'boolean', label: '布尔 Switch', example: '是否零含糖 / 是否早起' },
  { kind: 'select', label: '单选 Select', example: '饮品类型 / 题型' },
  { kind: 'multiselect', label: '多选 Checkbox', example: '完成子项清单' },
  { kind: 'rating', label: '评分 Rating', example: '状态自评 1–5 星' },
  { kind: 'text', label: '文本 Text', example: '生词摘录 / 心得备注' },
]

export const CUSTOM_GOAL_TEMPLATES: Record<CustomGoalTemplateId, CustomGoalTemplate> = {
  'sugar-free-water': {
    id: 'sugar-free-water',
    title: '戒糖饮水 21 天挑战',
    periodLabel: '21 天习惯冲刺 · 剩余 12 天',
    startDate: '2026-11-01',
    endDate: '2026-11-21',
    totalDays: 21,
    completedDays: 9,
    activeFieldKinds: ['number', 'select', 'rating', 'text'],
    fieldsSummary: [
      { name: '今日温水杯数', kindLabel: '数字 (杯)', ruleDesc: '必须 ≥ 6 杯（约 1500ml）' },
      {
        name: '含糖饮料摄入',
        kindLabel: '单选 (0杯/破戒)',
        ruleDesc: '必须 = 0 杯（一票否决红线）',
      },
      { name: '身体轻盈度', kindLabel: '评分 (1–5)', ruleDesc: '记录皮肤与精神状态（不作硬门槛）' },
      { name: '饮水手账备注', kindLabel: '文本', ruleDesc: 'AI 排查是否含隐形奶茶/果茶' },
    ],
    ruleFormula: '温水杯数 ≥ 6 AND 含糖饮料 == "0杯"',
    aiNaturalRule:
      '每日饮水必须 ≥ 6 杯，且含糖饮料为 0 杯；若备注或照片中出现奶茶、可乐、含糖果茶则判定破戒，仅存档不盖章。',
  },
  'kaoyan-reading': {
    id: 'kaoyan-reading',
    title: '考研英语每日精读 2 篇',
    periodLabel: '考前 45 天冲刺 · 剩余 28 天',
    startDate: '2026-10-20',
    endDate: '2026-12-03',
    totalDays: 45,
    completedDays: 17,
    activeFieldKinds: ['number', 'duration', 'text'],
    fieldsSummary: [
      { name: '精读真题篇数', kindLabel: '数字 (篇)', ruleDesc: '必须 ≥ 2 篇历年阅读真题' },
      { name: '精读专注用时', kindLabel: '时长 (分钟)', ruleDesc: '必须 ≥ 40 分钟深度拆解' },
      {
        name: '生词与长难句',
        kindLabel: '文本摘录',
        ruleDesc: '至少记录 2 个核心生词或长难句语法',
      },
    ],
    ruleFormula: '精读篇数 ≥ 2 AND 专注时长 ≥ 40m AND 笔记字数 ≥ 10',
    aiNaturalRule:
      '每日必须完成至少 2 篇考研阅读真题精读、用时不少于 40 分钟，且附上长难句或高频生词复盘摘要。',
  },
  'calligraphy-daily': {
    id: 'calligraphy-daily',
    title: '每日硬笔练字 1 页',
    periodLabel: '30 天静心计划 · 剩余 19 天',
    startDate: '2026-10-25',
    endDate: '2026-11-23',
    totalDays: 30,
    completedDays: 11,
    activeFieldKinds: ['number', 'duration', 'rating', 'text'],
    fieldsSummary: [
      { name: '完成字帖页数', kindLabel: '数字 (页)', ruleDesc: '必须 ≥ 1 页完整临摹' },
      { name: '静心书写时长', kindLabel: '时长 (分钟)', ruleDesc: '必须 ≥ 20 分钟慢写不敷衍' },
      { name: '卷面工整度自评', kindLabel: '评分 (1–5)', ruleDesc: '自评 ≥ 3 分（一般及以上）' },
      { name: '临摹字帖与心得', kindLabel: '文本', ruleDesc: '记录今日练习的偏旁或结构要点' },
    ],
    ruleFormula: '字帖页数 ≥ 1 AND 书写时长 ≥ 20m AND 工整度 ≥ 3',
    aiNaturalRule:
      '每日完成至少 1 页硬笔字帖临摹、静心书写不少于 20 分钟，避免 3 分钟鬼画符应付打卡。',
  },
}

// ============================================================================
// Section 01 组件：多目标自定义期限与个性化检验规则设计器（每行 2 卡 md:grid-cols-2）
// ============================================================================

export function CustomGoalRuleDesignerDemo() {
  const [selectedId, setSelectedId] = useState<CustomGoalTemplateId>('sugar-free-water')
  const tpl = CUSTOM_GOAL_TEMPLATES[selectedId]
  const [startDate, setStartDate] = useState(tpl.startDate)
  const [endDate, setEndDate] = useState(tpl.endDate)

  function handleSelectTemplate(nextId: CustomGoalTemplateId) {
    setSelectedId(nextId)
    setStartDate(CUSTOM_GOAL_TEMPLATES[nextId].startDate)
    setEndDate(CUSTOM_GOAL_TEMPLATES[nextId].endDate)
  }

  return (
    <div className={deckClass}>
      {/* 左卡：多目标自定义期限 + 7 类动态字段组装器 */}
      <Card
        data-ann="playbook.modules.custom.designer.fields"
        className="flex min-w-0 flex-col justify-between gap-4"
      >
        <div className="flex flex-col gap-3">
          <div className="border-border flex items-start justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <IconTile icon="custom" tone="custom" size="md" />
              <div className="min-w-0">
                <h3 className="text-subhead truncate font-bold">
                  01 · 多目标独立期限与动态字段组装
                </h3>
                <p className="text-tiny text-muted truncate">
                  每个目标拥有独立起止周期与 7 种可选字段控件
                </p>
              </div>
            </div>
            <Badge tone="custom" icon="sliders">
              字段拼装
            </Badge>
          </div>

          {/* 切换查看 3 个典型自定义目标模板 */}
          <SegmentedControl
            size="sm"
            label="选择自定义目标示例"
            value={selectedId}
            onValueChange={handleSelectTemplate}
            options={[
              { value: 'sugar-free-water', label: '戒糖饮水' },
              { value: 'kaoyan-reading', label: '考研精读' },
              { value: 'calligraphy-daily', label: '每日练字' },
            ]}
          />

          {/* 自定义起止日期与冲刺进度 */}
          <div className="bg-surface-sunken flex flex-col gap-2.5 rounded-2xl p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption font-bold">{tpl.title} · 目标期限</span>
              <span className="font-display text-custom-ink bg-custom-soft text-tiny rounded-full px-2.5 py-0.5 font-bold">
                {tpl.completedDays} / {tpl.totalDays} 天
              </span>
            </div>
            <ProgressBar
              value={tpl.completedDays}
              max={tpl.totalDays}
              tone="custom"
              size="sm"
              label="目标周期进度"
            />
            <div className="grid gap-2">
              <DateField
                id="custom-design-start"
                label="开始日期"
                value={startDate}
                onValueChange={setStartDate}
                aside="独立起算"
              />
              <DateField
                id="custom-design-end"
                label="截止日期（冲刺终点）"
                value={endDate}
                onValueChange={setEndDate}
                aside={tpl.periodLabel}
              />
            </div>
          </div>

          {/* 7 种动态字段类型支持矩阵 */}
          <div className="flex flex-col gap-1.5">
            <span className="text-tiny text-muted font-semibold">
              支持的 7 类动态字段（高亮项为当前目标已启用）：
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DYNAMIC_FIELD_CATALOG.map((f) => {
                const active = tpl.activeFieldKinds.includes(f.kind)
                return (
                  <span
                    key={f.kind}
                    className={cn(
                      'text-tiny inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold transition-colors',
                      active
                        ? 'bg-custom-soft text-custom-ink border-custom/40 font-bold'
                        : 'border-border bg-surface text-muted',
                    )}
                  >
                    {active && <Icon name="check" size={12} />}
                    <span>{f.label}</span>
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* 右卡：自定义 AI 裁判检验标准设计器 */}
      <Card
        data-ann="playbook.modules.custom.designer.referee-rules"
        className="flex min-w-0 flex-col justify-between gap-4"
      >
        <div className="flex flex-col gap-3">
          <div className="border-border flex items-start justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <IconTile icon="shield" tone="custom" size="md" />
              <div className="min-w-0">
                <h3 className="text-subhead truncate font-bold">
                  02 · 自定义 AI 裁判检验标准（用户定规矩）
                </h3>
                <p className="text-tiny text-muted truncate">
                  自己设定达到什么条件才算有效打卡，AI 严格帮自己把关
                </p>
              </div>
            </div>
            <Badge tone="primary" icon="sparkles">
              个性化裁判
            </Badge>
          </div>

          {/* 字段级阈值清单 */}
          <div className="bg-surface-sunken flex flex-col gap-2 rounded-2xl p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption font-bold">「{tpl.title}」字段检验清单</span>
              <Badge tone="custom">{tpl.fieldsSummary.length} 个字段</Badge>
            </div>

            <div className="divide-border bg-surface divide-y rounded-xl px-3">
              {tpl.fieldsSummary.map((item) => (
                <div key={item.name} className="flex flex-col gap-0.5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-caption font-bold">{item.name}</span>
                    <span className="text-tiny text-muted font-mono">{item.kindLabel}</span>
                  </div>
                  <p className="text-tiny text-custom-ink font-semibold">
                    检验规则：{item.ruleDesc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 组合逻辑表达式 + AI 语义裁判补充 */}
          <div className="border-custom/30 bg-custom-soft/45 flex flex-col gap-2 rounded-2xl border p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-tiny text-custom-ink font-bold">有效打卡判定表达式</span>
              <span className="text-tiny text-subtle font-mono">Custom Rule Engine</span>
            </div>
            <p className="bg-surface text-custom-ink text-tiny rounded-lg px-2.5 py-1.5 font-mono font-bold">
              {tpl.ruleFormula}
            </p>
            <p className="text-tiny text-muted leading-relaxed">
              <strong className="text-foreground">AI 裁判自然语言指令：</strong>
              {tpl.aiNaturalRule}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ============================================================================
// Section 02 组件：自定义目标 AI 裁判对比（每行 2 卡 md:grid-cols-2）
// ============================================================================

export function CustomRefereeComparisonMatrix() {
  return (
    <div className={deckClass}>
      {/* 场景 A：满足自定义检验规则 · 有效打卡 */}
      <Card
        data-ann="playbook.modules.custom.verdict.valid"
        className="flex min-w-0 flex-col justify-between gap-4"
      >
        <div className="flex flex-col gap-3">
          <div className="border-border flex items-center justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2">
              <IconTile icon="custom" tone="custom" size="sm" />
              <div className="min-w-0">
                <p className="text-caption truncate font-bold">
                  场景 A · 温水 7 杯 + 含糖饮料 0 杯
                </p>
                <p className="text-tiny text-muted truncate">
                  目标：戒糖饮水 21 天挑战（满足全部自定义规则）
                </p>
              </div>
            </div>
            <Badge tone="success" dot>
              有效打卡
            </Badge>
          </div>

          {/* 自定义规则逐项核验 */}
          <div className="bg-surface-sunken grid gap-2 rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-success-soft text-success-ink text-tiny flex size-5 shrink-0 items-center justify-center rounded-full font-bold">
                  ✓
                </span>
                <span className="text-caption font-semibold">规则 1：今日温水 ≥ 6 杯</span>
              </div>
              <span className="font-display text-success-ink text-caption font-bold tabular-nums">
                已喝 7 杯（2100ml）
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-success-soft text-success-ink text-tiny flex size-5 shrink-0 items-center justify-center rounded-full font-bold">
                  ✓
                </span>
                <span className="text-caption font-semibold">规则 2：含糖饮料 = 0 杯</span>
              </div>
              <span className="text-success-ink text-caption font-bold">0 杯（无糖绿茶替代）</span>
            </div>
          </div>

          {/* 团团正向裁判评语 */}
          <div className="bg-custom-soft/50 border-custom/30 relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3.5">
            <Mascot mood="cheer" size={56} />
            <div className="min-w-0 flex-1 pr-14">
              <p className="text-caption text-custom-ink font-bold">
                团团裁判：自定义双条件达成，盖章！
              </p>
              <p className="text-tiny text-muted mt-1 leading-relaxed">
                喝够 7 杯水而且成功抵御了下午茶奶茶！戒糖 21 天挑战推进到第 9 天，继续冲～
              </p>
            </div>
            <Stamp
              text="小目标"
              caption="Day 09"
              tone="custom"
              size={60}
              className="absolute top-2.5 right-2.5"
            />
          </div>
        </div>

        <div className="border-border flex items-center justify-between border-t pt-2.5">
          <span className="text-tiny text-muted">判定结果：计入「戒糖 21 天挑战」有效连击</span>
          <Badge tone="custom" icon="check">
            已盖章
          </Badge>
        </div>
      </Card>

      {/* 场景 B：未达自定义阈值 · 仅存档不盖章 */}
      <Card
        data-ann="playbook.modules.custom.verdict.intercept"
        className="flex min-w-0 flex-col justify-between gap-4"
      >
        <div className="flex flex-col gap-3">
          <div className="border-border flex items-center justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2">
              <IconTile icon="alert" tone="warning" size="sm" />
              <div className="min-w-0">
                <p className="text-caption truncate font-bold">
                  场景 B · 温水 7 杯 + 偷喝 1 杯三分糖奶茶
                </p>
                <p className="text-tiny text-muted truncate">
                  违反用户自定义的「含糖饮料 = 0 杯」一票否决红线
                </p>
              </div>
            </div>
            <Badge tone="warning" icon="alert">
              未达自定义阈值
            </Badge>
          </div>

          {/* 自定义规则逐项核验 */}
          <div className="bg-surface-sunken grid gap-2 rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-success-soft text-success-ink text-tiny flex size-5 shrink-0 items-center justify-center rounded-full font-bold">
                  ✓
                </span>
                <span className="text-caption font-semibold">规则 1：今日温水 ≥ 6 杯</span>
              </div>
              <span className="font-display text-success-ink text-caption font-bold tabular-nums">
                已喝 7 杯（达标）
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-danger-soft text-danger-ink text-tiny flex size-5 shrink-0 items-center justify-center rounded-full font-bold">
                  ✕
                </span>
                <span className="text-caption font-semibold">规则 2：含糖饮料 = 0 杯</span>
              </div>
              <span className="text-danger-ink text-caption font-bold">1 杯（三分糖奶茶破戒）</span>
            </div>
          </div>

          {/* 团团温和拦截评语 */}
          <div className="bg-warning-soft/55 border-warning/35 flex items-center gap-3 rounded-2xl border p-3.5">
            <Mascot mood="shy" size={56} />
            <div className="min-w-0 flex-1">
              <p className="text-caption text-warning-ink font-bold">
                团团裁判：触发戒糖红线，今天先诚实存档不盖章哦
              </p>
              <p className="text-tiny text-muted mt-1 leading-relaxed">
                「温水喝够 7 杯超棒！不过按你定下的『含糖饮料 = 0
                杯』戒糖规则，三分糖也含有添加糖哦～本次为你诚实存档，明天满血继续！」
              </p>
            </div>
          </div>
        </div>

        <div className="border-border flex items-center justify-between border-t pt-2.5">
          <span className="text-tiny text-muted">判定结果：保留今日饮水流水，不触发挑战印章</span>
          <Badge tone="neutral" icon="clock">
            仅存档不盖章
          </Badge>
        </div>
      </Card>
    </div>
  )
}

// ============================================================================
// Section 03 组件：自定义板块完整页面沙盒（PhoneFrame + 右侧多目标切换控制台）
// ============================================================================

type SugarStatus = 'zero' | 'has-sugar'

export function CustomModulePhoneSandbox() {
  const [goalId, setGoalId] = useState<CustomGoalTemplateId>('sugar-free-water')
  const [inputMode, setInputMode] = useState<CheckinInputMode>('smart-upload')
  const [phase, setPhase] = useState<ScanPhase>('done')
  const [submitResult, setSubmitResult] = useState<'stamped' | 'archived' | null>(null)

  // 目标 1（戒糖饮水）字段状态
  const [waterCups, setWaterCups] = useState<number | null>(7)
  const [sugarStatus, setSugarStatus] = useState<SugarStatus>('zero')
  const [waterMood, setWaterMood] = useState<RatingValue | null>(4)
  const [waterNote, setWaterNote] = useState('用柠檬水和无糖绿茶代替了下午茶奶茶')

  // 目标 2（考研英语精读）字段状态
  const [articlesCount, setArticlesCount] = useState<number | null>(2)
  const [readingMinutes, setReadingMinutes] = useState<number | null>(50)
  const [vocabNote, setVocabNote] = useState(
    '2019 Text 1 & 2：掌握政经类长难句倒装结构，整理 subtle / scrutiny 等 8 个高频词',
  )

  // 目标 3（每日硬笔练字）字段状态
  const [pagesCount, setPagesCount] = useState<number | null>(1)
  const [writingMinutes, setWritingMinutes] = useState<number | null>(25)
  const [neatRating, setNeatRating] = useState<RatingValue | null>(4)
  const [writingNote, setWritingNote] = useState('临摹《灵飞经》小楷第 11 页，注意走之底的捺画舒展')

  const tpl = CUSTOM_GOAL_TEMPLATES[goalId]

  useEffect(() => {
    if (phase !== 'scanning') return
    const timer = setTimeout(() => setPhase('done'), 900)
    return () => clearTimeout(timer)
  }, [phase])

  // 计算当前选中目标的实时 AI 裁判结果
  const evaluation = (() => {
    if (goalId === 'sugar-free-water') {
      const cups = waterCups ?? 0
      const cond1 = cups >= 6
      const cond2 = sugarStatus === 'zero'
      const valid = cond1 && cond2
      return {
        isValid: valid,
        summaryText: `${tpl.title} · 温水 ${cups} 杯 / ${sugarStatus === 'zero' ? '0 含糖' : '含糖破戒'}`,
        verdictTitle: valid ? '自定义戒糖双规则达成 · 可盖章' : '未达自定义戒糖规则 · 仅存档',
        verdictDetail: valid
          ? `温水 ${cups} 杯（≥ 6 杯）且坚守 0 含糖饮料红线，符合你设定的有效打卡标准！`
          : !cond2
            ? '虽然记录了饮水，但今天摄入了含糖饮料（违反“含糖饮料 = 0 杯”红线），本次仅诚实归档数据。'
            : `当前温水 ${cups} 杯，还差 ${6 - cups} 杯达到你设定的 6 杯底线。`,
        checks: [
          { label: `温水 ${cups}/6 杯`, passed: cond1 },
          { label: sugarStatus === 'zero' ? '含糖 0 杯' : '含糖破戒', passed: cond2 },
        ],
        scannerPreset: {
          id: 'custom-scan-water',
          module: 'custom',
          goalTitle: tpl.title,
          sourceKind: 'text',
          visualTitle: '今日饮水与戒糖流水.txt',
          visualLines: [
            `累计温水：${cups} 杯（约 ${cups * 300}ml）`,
            `含糖饮料：${sugarStatus === 'zero' ? '0 杯（无糖绿茶替代）' : '1 杯（三分糖奶茶）'}`,
            `目标期限：${tpl.periodLabel}`,
          ],
          scanSteps: [
            '正在解析饮水文本流水与自定义目标字段…',
            `匹配动态字段：温水 ${cups} 杯 · ${sugarStatus === 'zero' ? '零含糖' : '检测到奶茶'}`,
            valid
              ? 'AI 规则裁判：满足自定义双条件，可盖有效章'
              : 'AI 规则裁判：触发自定义红线，切换为诚实存档模式',
          ],
        } satisfies SmartSamplePreset,
      }
    }

    if (goalId === 'kaoyan-reading') {
      const count = articlesCount ?? 0
      const mins = readingMinutes ?? 0
      const cond1 = count >= 2
      const cond2 = mins >= 40 && vocabNote.trim().length >= 10
      const valid = cond1 && cond2
      return {
        isValid: valid,
        summaryText: `${tpl.title} · 精读 ${count} 篇（${mins} 分钟）`,
        verdictTitle: valid ? '考研精读三项标准达成 · 可盖章' : '未达自定义精读标准 · 暂存进度',
        verdictDetail: valid
          ? `已完成 ${count} 篇真题精读（用时 ${mins} 分钟）并整理长难句词汇，满足自定义冲刺规则！`
          : `距离你设定的「≥ 2 篇 + ≥ 40 分钟 + 生词笔记」还有未达标项，建议补完后再盖章。`,
        checks: [
          { label: `篇数 ${count}/2 篇`, passed: cond1 },
          { label: `时长 ${mins}/40m & 笔记`, passed: cond2 },
        ],
        scannerPreset: {
          id: 'custom-scan-kaoyan',
          module: 'custom',
          goalTitle: tpl.title,
          sourceKind: 'text',
          visualTitle: '考研阅读真题批注笔记.md',
          visualLines: [
            `精读篇目：${count} 篇（2019 Text 1 & Text 2）`,
            `专注耗时：${mins} 分钟`,
            '已提取 8 个核心词汇与长难句拆分',
          ],
          scanSteps: [
            '正在解析 Markdown 阅读笔记与计时记录…',
            `映射动态字段：精读 ${count} 篇 · 专注 ${mins} 分钟`,
            valid ? 'AI 规则裁判：篇数、时长与笔记均达标' : 'AI 规则裁判：未满自定义篇数或时长门槛',
          ],
        } satisfies SmartSamplePreset,
      }
    }

    const pages = pagesCount ?? 0
    const mins = writingMinutes ?? 0
    const ratingVal = neatRating ?? 0
    const cond1 = pages >= 1 && mins >= 20
    const cond2 = ratingVal >= 3
    const valid = cond1 && cond2
    return {
      isValid: valid,
      summaryText: `${tpl.title} · 临摹 ${pages} 页（${mins} 分钟）`,
      verdictTitle: valid ? '每日练字自定义标准达成 · 可盖章' : '未达自定义练字门槛 · 仅存档',
      verdictDetail: valid
        ? `静心书写 ${pages} 页共 ${mins} 分钟，工整度自评 ${ratingVal} 分，符合练字打卡标准！`
        : '页数、静心时长（≥ 20m）或工整度（≥ 3 分）未达设定门槛，拒绝敷衍鬼画符哦～',
      checks: [
        { label: `${pages}页 · ${mins}/20m`, passed: cond1 },
        { label: `工整度 ${ratingVal}/5 分`, passed: cond2 },
      ],
      scannerPreset: {
        id: 'custom-scan-calligraphy',
        module: 'custom',
        goalTitle: tpl.title,
        sourceKind: 'image',
        visualTitle: '硬笔字帖临摹实拍 · 第 11 页',
        visualLines: [
          `完成页数：${pages} 页（田字格满页）`,
          `书写时长：${mins} 分钟`,
          `笔画结构评估：工整度 ${ratingVal} / 5`,
        ],
        scanSteps: [
          '正在扫描字帖实拍照片与书写格数…',
          `映射动态字段：完成 ${pages} 页 · 用时 ${mins} 分钟`,
          valid
            ? 'AI 规则裁判：书写饱满工整，符合自定义门槛'
            : 'AI 规则裁判：书写时长或页数不足，仅作存档',
        ],
      } satisfies SmartSamplePreset,
    }
  })()

  function switchGoal(nextGoal: CustomGoalTemplateId) {
    setGoalId(nextGoal)
    setSubmitResult(null)
    if (inputMode !== 'manual') setPhase('scanning')
  }

  function applyQuickPreset(pass: boolean) {
    setSubmitResult(null)
    if (inputMode !== 'manual') setPhase('scanning')
    if (goalId === 'sugar-free-water') {
      setWaterCups(7)
      setSugarStatus(pass ? 'zero' : 'has-sugar')
      setWaterNote(
        pass ? '用柠檬水和无糖绿茶代替了下午茶奶茶' : '下午同事请客喝了一杯三分糖珍珠奶茶',
      )
    } else if (goalId === 'kaoyan-reading') {
      setArticlesCount(pass ? 2 : 1)
      setReadingMinutes(pass ? 50 : 15)
      setVocabNote(
        pass
          ? '2019 Text 1 & 2：掌握政经类长难句倒装结构，整理 subtle / scrutiny 等 8 个高频词'
          : '只粗略扫了一篇阅读',
      )
    } else {
      setPagesCount(1)
      setWritingMinutes(pass ? 25 : 6)
      setNeatRating(pass ? 4 : 2)
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
      {/* 左侧：360px 真实手机外框 */}
      <div
        className="flex justify-center max-lg:order-2"
        data-ann="playbook.modules.custom.sandbox.phone"
      >
        <PhoneFrame
          fluid
          label="手机 · /goals/custom/checkin（我的小目标专页）"
          className="h-[760px]"
        >
          <div className="flex h-full flex-col overflow-hidden">
            <TopBar
              sticky={false}
              title="我的小目标"
              leading={<IconButton icon="chevron-left" label="返回" className="-ml-2" />}
              actions={<Badge tone="custom">自定义</Badge>}
              className="shrink-0 pt-10"
            />

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 pt-2 pb-6">
              {/* 1. 顶部自定义目标期限进度卡 + 三态输入 Tab */}
              <Card className="flex flex-col gap-2.5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <IconTile icon="custom" tone="custom" size="sm" />
                    <div className="min-w-0">
                      <p className="text-caption truncate font-bold">{tpl.title}</p>
                      <p className="text-tiny text-muted truncate">{tpl.periodLabel}</p>
                    </div>
                  </div>
                  <span className="font-display text-custom-ink bg-custom-soft text-tiny shrink-0 rounded-full px-2 py-0.5 font-bold tabular-nums">
                    {tpl.completedDays}/{tpl.totalDays}天
                  </span>
                </div>
                <ProgressBar
                  value={tpl.completedDays}
                  max={tpl.totalDays}
                  tone="custom"
                  size="sm"
                  label="自定义目标周期进度"
                />
                <CheckinModeTabs
                  value={inputMode}
                  onValueChange={(next) => {
                    setInputMode(next)
                    setSubmitResult(null)
                    if (next !== 'manual') setPhase('scanning')
                  }}
                />
              </Card>

              {/* 2. 智能拍照/上传模式下挂载扫描镜 */}
              {inputMode !== 'manual' && (
                <SmartScannerLens
                  preset={evaluation.scannerPreset}
                  phase={phase}
                  tone="custom"
                  onRescan={() => setPhase('scanning')}
                />
              )}

              {/* 3. 动态字段表单 + 个性化 AI 裁判反馈卡 */}
              <Card className="flex flex-col gap-3 p-3.5">
                {submitResult ? (
                  <div className="flex flex-col items-center gap-2.5 py-4 text-center">
                    <div className="relative">
                      <Mascot mood={submitResult === 'stamped' ? 'cheer' : 'shy'} size={76} />
                      {submitResult === 'stamped' && (
                        <Stamp
                          text="小目标"
                          caption={`Day ${tpl.completedDays + 1}`}
                          tone="custom"
                          animate
                          size={58}
                          className="absolute -top-2 -right-9"
                        />
                      )}
                    </div>
                    <Badge tone={submitResult === 'stamped' ? 'success' : 'warning'} dot>
                      {submitResult === 'stamped'
                        ? '满足自定义检验规则 · 已盖章'
                        : '已诚实存档记录（未触发小目标印章）'}
                    </Badge>
                    <p className="text-caption font-bold">{evaluation.summaryText}</p>
                    <p className="text-tiny text-muted max-w-xs leading-relaxed">
                      {evaluation.verdictDetail}
                    </p>
                    <Button variant="soft" size="sm" onClick={() => setSubmitResult(null)}>
                      返回修改字段
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-caption font-bold">自定义动态字段表单</span>
                      <Badge tone="custom">单列自适应</Badge>
                    </div>

                    {/* 按当前目标渲染对应的动态字段（严格单列垂直流） */}
                    {goalId === 'sugar-free-water' && (
                      <>
                        <Field
                          label="今日温水杯数"
                          htmlFor="custom-water-cups"
                          aside="规则：≥ 6 杯"
                        >
                          <NumberField
                            id="custom-water-cups"
                            value={waterCups}
                            onValueChange={(v) => {
                              setWaterCups(v)
                              setSubmitResult(null)
                            }}
                            min={0}
                            max={20}
                            step={1}
                            unit="杯"
                          />
                        </Field>

                        <div className="flex min-w-0 flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-caption font-semibold">含糖饮料摄入</span>
                            <span className="text-tiny text-muted">规则：必须 = 0 杯</span>
                          </div>
                          <SegmentedControl
                            size="sm"
                            label="含糖饮料摄入"
                            value={sugarStatus}
                            onValueChange={(v) => {
                              setSugarStatus(v)
                              setSubmitResult(null)
                            }}
                            options={[
                              { value: 'zero', label: '0 杯（坚守戒糖）' },
                              { value: 'has-sugar', label: '喝了甜饮（破戒）' },
                            ]}
                          />
                        </div>

                        <div className="flex min-w-0 flex-col gap-1.5">
                          <span className="text-caption font-semibold">身体轻盈感评分</span>
                          <Rating
                            value={waterMood}
                            onValueChange={setWaterMood}
                            tone="custom"
                            label="身体轻盈感"
                          />
                        </div>

                        <Field label="饮水与戒糖心得" htmlFor="custom-water-note" aside="可微调">
                          <Input
                            id="custom-water-note"
                            value={waterNote}
                            onChange={(e) => setWaterNote(e.target.value)}
                          />
                        </Field>
                      </>
                    )}

                    {goalId === 'kaoyan-reading' && (
                      <>
                        <Field label="精读真题篇数" htmlFor="custom-ky-count" aside="规则：≥ 2 篇">
                          <NumberField
                            id="custom-ky-count"
                            value={articlesCount}
                            onValueChange={(v) => {
                              setArticlesCount(v)
                              setSubmitResult(null)
                            }}
                            min={0}
                            max={10}
                            step={1}
                            unit="篇"
                          />
                        </Field>

                        <Field
                          label="精读专注用时"
                          htmlFor="custom-ky-mins"
                          aside="规则：≥ 40 分钟"
                        >
                          <NumberField
                            id="custom-ky-mins"
                            value={readingMinutes}
                            onValueChange={(v) => {
                              setReadingMinutes(v)
                              setSubmitResult(null)
                            }}
                            min={5}
                            max={300}
                            step={5}
                            unit="分钟"
                          />
                        </Field>

                        <Field
                          label="长难句与生词复盘"
                          htmlFor="custom-ky-note"
                          aside="规则：≥ 10 字"
                        >
                          <Textarea
                            id="custom-ky-note"
                            rows={2}
                            value={vocabNote}
                            onChange={(e) => {
                              setVocabNote(e.target.value)
                              setSubmitResult(null)
                            }}
                          />
                        </Field>
                      </>
                    )}

                    {goalId === 'calligraphy-daily' && (
                      <>
                        <Field label="完成字帖页数" htmlFor="custom-cal-pages" aside="规则：≥ 1 页">
                          <NumberField
                            id="custom-cal-pages"
                            value={pagesCount}
                            onValueChange={(v) => {
                              setPagesCount(v)
                              setSubmitResult(null)
                            }}
                            min={0}
                            max={10}
                            step={1}
                            unit="页"
                          />
                        </Field>

                        <Field
                          label="静心书写时长"
                          htmlFor="custom-cal-mins"
                          aside="规则：≥ 20 分钟"
                        >
                          <NumberField
                            id="custom-cal-mins"
                            value={writingMinutes}
                            onValueChange={(v) => {
                              setWritingMinutes(v)
                              setSubmitResult(null)
                            }}
                            min={1}
                            max={180}
                            step={5}
                            unit="分钟"
                          />
                        </Field>

                        <div className="flex min-w-0 flex-col gap-1.5">
                          <span className="text-caption font-semibold">
                            卷面工整度自评（规则 ≥ 3 分）
                          </span>
                          <Rating
                            value={neatRating}
                            onValueChange={(v) => {
                              setNeatRating(v)
                              setSubmitResult(null)
                            }}
                            tone="custom"
                            label="卷面工整度"
                          />
                        </div>

                        <Field label="练字心得" htmlFor="custom-cal-note" aside="可选">
                          <Input
                            id="custom-cal-note"
                            value={writingNote}
                            onChange={(e) => setWritingNote(e.target.value)}
                          />
                        </Field>
                      </>
                    )}

                    {/* 实时个性化规则 AI 裁判卡 */}
                    <div
                      className={cn(
                        'flex flex-col gap-2 rounded-2xl border p-3',
                        evaluation.isValid
                          ? 'bg-custom-soft/50 border-custom/35'
                          : 'bg-warning-soft/55 border-warning/40',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Icon
                            name={evaluation.isValid ? 'shield' : 'alert'}
                            size={15}
                            className={evaluation.isValid ? 'text-custom-ink' : 'text-warning-ink'}
                          />
                          <span
                            className={cn(
                              'text-caption font-bold',
                              evaluation.isValid ? 'text-custom-ink' : 'text-warning-ink',
                            )}
                          >
                            {evaluation.verdictTitle}
                          </span>
                        </div>
                        <Badge tone={evaluation.isValid ? 'success' : 'warning'}>
                          {evaluation.isValid ? '达标盖章' : '仅存档'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        {evaluation.checks.map((chk) => (
                          <div
                            key={chk.label}
                            className="bg-surface/85 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5"
                          >
                            <span
                              className={cn(
                                'text-tiny font-bold',
                                chk.passed ? 'text-success-ink' : 'text-danger-ink',
                              )}
                            >
                              {chk.passed ? '✓' : '✕'}
                            </span>
                            <span className="text-tiny truncate font-semibold">{chk.label}</span>
                          </div>
                        ))}
                      </div>

                      <p className="text-tiny text-muted leading-relaxed">
                        {evaluation.verdictDetail}
                      </p>
                    </div>

                    {evaluation.isValid ? (
                      <Button
                        icon="check"
                        className="w-full"
                        onClick={() => {
                          setSubmitResult('stamped')
                          toast.success(`小目标打卡成功：${evaluation.summaryText}`)
                        }}
                      >
                        确认记录 · 盖下小目标印章
                      </Button>
                    ) : (
                      <Button
                        variant="soft"
                        icon="clock"
                        className="w-full"
                        onClick={() => {
                          setSubmitResult('archived')
                          toast.info(`已诚实存档记录：${evaluation.summaryText}（未触发印章）`)
                        }}
                      >
                        诚实存档今日记录（未达自定义规则不盖章）
                      </Button>
                    )}
                  </>
                )}
              </Card>
            </div>
          </div>
        </PhoneFrame>
      </div>

      {/* 右侧：多目标切换控制台 */}
      <div
        className="flex min-w-0 flex-col gap-3.5"
        data-ann="playbook.modules.custom.sandbox.console"
      >
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-subhead font-bold">多目标与检验状态切换控制台</span>
            <Badge tone="custom" icon="sparkles">
              动态沙盒
            </Badge>
          </div>
          <p className="text-caption text-muted">
            点击切换下方 3
            个不同结构的「我的小目标」，观察左侧手机框如何动态渲染对应的期限进度条、专属字段控件与个性化
            AI 裁判规则：
          </p>

          <div className="flex flex-col gap-2">
            {(Object.keys(CUSTOM_GOAL_TEMPLATES) as CustomGoalTemplateId[]).map((key) => {
              const item = CUSTOM_GOAL_TEMPLATES[key]
              const active = goalId === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchGoal(key)}
                  className={cn(
                    'flex min-w-0 items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-all active:scale-[0.99]',
                    active
                      ? 'border-custom bg-custom-soft/60 shadow-soft'
                      : 'border-border bg-surface-sunken/60 hover:bg-surface-sunken',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-caption truncate font-bold">{item.title}</p>
                    <p className="text-tiny text-muted mt-0.5 truncate">
                      {item.periodLabel} · {item.ruleFormula}
                    </p>
                  </div>
                  <Badge tone="custom">
                    {item.completedDays}/{item.totalDays}天
                  </Badge>
                </button>
              )
            })}
          </div>

          <div className="border-border bg-surface-sunken/70 flex flex-col gap-2.5 rounded-2xl border p-3.5">
            <span className="text-caption font-semibold">
              快捷切换当前目标的「达标 / 未达标」判例：
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="soft" icon="check" onClick={() => applyQuickPreset(true)}>
                填入达标数据（可盖章）
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon="alert"
                onClick={() => applyQuickPreset(false)}
              >
                填入破戒/未达标数据
              </Button>
            </div>
            <p className="text-tiny text-muted">
              当前目标检验公式：<code className="font-mono font-bold">{tpl.ruleFormula}</code>
            </p>
          </div>
        </Card>

        <Card variant="sunken" className="flex flex-col gap-2 max-lg:hidden">
          <p className="text-caption font-bold">我的小目标（自定义板块）核心亮点</p>
          <ul className="text-tiny text-muted space-y-1.5 leading-relaxed">
            <li>
              • <strong className="text-foreground">千人千面的小目标期限</strong>
              ：支持 21 天习惯养成、45 天备考冲刺或长期日常习惯，每个目标独立倒计时。
            </li>
            <li>
              • <strong className="text-foreground">7 类动态字段自由组合</strong>
              ：数字、时长、布尔开关、单选、多选、表情评分与文本备注全部复用统一手账 UI 原语。
            </li>
            <li>
              • <strong className="text-foreground">用户给自己立规矩、团团负责严格执行</strong>
              ：用户可设定多条件组合（如“喝水 ≥ 6 杯 且 含糖饮料 = 0”），破戒时温柔存档不盖章。
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
