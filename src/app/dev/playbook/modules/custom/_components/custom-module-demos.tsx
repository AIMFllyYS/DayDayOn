'use client'

import { useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DateField } from '@/components/ui/date-field'
import { Icon } from '@/components/ui/icon'
import { ProgressBar } from '@/components/ui/progress'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Stamp } from '@/components/ui/stamp'
import { cn } from '@/lib/cn'
import { deckClass } from '../../_components/deck'

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
