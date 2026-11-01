'use client'

import type { ReactNode } from 'react'
import { BottomNav } from '@/components/layout/bottom-nav'
import { appNavItems } from '@/components/layout/nav-items'
import { SideNav } from '@/components/layout/side-nav'
import { TopBar } from '@/components/layout/top-bar'
import { Mascot } from '@/components/mascot/mascot'
import { mascotMoods, type MascotMood } from '@/components/mascot/mascot-svg'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, type ButtonVariant } from '@/components/ui/button'
import { Card, CardHeader, type CardVariant } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { MenuItem, MenuList } from '@/components/ui/menu-list'
import { ProgressBar, ProgressRing } from '@/components/ui/progress'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Skeleton } from '@/components/ui/skeleton'
import { Stamp } from '@/components/ui/stamp'
import { Switch } from '@/components/ui/switch'
import { moduleTones, type ModuleTone, type Tone } from '@/components/ui/tone'
import { AgentTurn } from '@/features/agent/components/agent-turn'
import { AiDraftCard } from '@/features/agent/components/ai-draft-card'
import { QuotaMeter } from '@/features/agent/components/quota-meter'

/*
 * 画板里可以引用的组件。每个条目给出默认尺寸、可编辑属性和渲染方式。
 * 组件在画板里只做展示（不响应点击），导出的 JSON 用 ref + props 精确描述"用了哪个组件、什么参数"。
 * 新增原子组件时顺手在这里登记，画草图时才能引用到。
 */
type PropSpec =
  | { key: string; label: string; type: 'text'; default: string }
  | { key: string; label: string; type: 'select'; options: readonly string[]; default: string }

export interface ComponentEntry {
  ref: string
  label: string
  group: '原子' | '布局' | '宠物' | 'Agent'
  w: number
  h: number
  props: PropSpec[]
  render: (p: Record<string, string>) => ReactNode
}

const tones: Tone[] = ['primary', 'neutral', 'success', 'warning', 'danger', ...moduleTones]
const noop = () => {}

const asTone = (v: string | undefined): Tone =>
  tones.includes(v as Tone) ? (v as Tone) : 'primary'
const asModule = (v: string | undefined): ModuleTone =>
  moduleTones.includes(v as ModuleTone) ? (v as ModuleTone) : 'diet'
const num = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const sampleTurn = {
  id: 'sketch',
  status: 'done' as const,
  durationMs: 3200,
  parts: [
    { type: 'step-start' as const },
    {
      type: 'tool' as const,
      id: 'a',
      toolName: 'estimateFoodNutrition',
      state: 'output-available' as const,
      durationMs: 700,
    },
    {
      type: 'tool' as const,
      id: 'b',
      toolName: 'webSearch',
      state: 'output-available' as const,
      durationMs: 800,
    },
    { type: 'text' as const, id: 'c', state: 'done' as const, text: '这顿大约 **520 kcal**。' },
  ],
}

export const componentRegistry: ComponentEntry[] = [
  {
    ref: 'button',
    label: '按钮',
    group: '原子',
    w: 140,
    h: 44,
    props: [
      { key: 'label', label: '文字', type: 'text', default: '确认记录' },
      {
        key: 'variant',
        label: '变体',
        type: 'select',
        options: ['primary', 'secondary', 'soft', 'ghost', 'danger'],
        default: 'primary',
      },
    ],
    render: (p) => <Button variant={(p.variant ?? 'primary') as ButtonVariant}>{p.label}</Button>,
  },
  {
    ref: 'badge',
    label: '徽章',
    group: '原子',
    w: 96,
    h: 24,
    props: [
      { key: 'label', label: '文字', type: 'text', default: '连续 12 天' },
      { key: 'tone', label: '色调', type: 'select', options: tones, default: 'primary' },
    ],
    render: (p) => <Badge tone={asTone(p.tone)}>{p.label}</Badge>,
  },
  {
    ref: 'card',
    label: '卡片',
    group: '原子',
    w: 300,
    h: 120,
    props: [
      { key: 'title', label: '标题', type: 'text', default: '今日完成度' },
      { key: 'description', label: '说明', type: 'text', default: '3 / 4 个板块' },
      {
        key: 'variant',
        label: '变体',
        type: 'select',
        options: ['plain', 'sticker', 'outline', 'sunken'],
        default: 'plain',
      },
    ],
    render: (p) => (
      <Card variant={(p.variant ?? 'plain') as CardVariant} className="size-full">
        <CardHeader title={p.title ?? ''} description={p.description} />
      </Card>
    ),
  },
  {
    ref: 'progress-bar',
    label: '进度条',
    group: '原子',
    w: 260,
    h: 12,
    props: [
      { key: 'value', label: '进度 0–100', type: 'text', default: '60' },
      { key: 'tone', label: '色调', type: 'select', options: tones, default: 'primary' },
    ],
    render: (p) => (
      <ProgressBar value={num(p.value, 60)} tone={asTone(p.tone)} label="草图进度条" />
    ),
  },
  {
    ref: 'progress-ring',
    label: '进度圆环',
    group: '原子',
    w: 72,
    h: 72,
    props: [
      { key: 'value', label: '进度 0–100', type: 'text', default: '75' },
      { key: 'tone', label: '色调', type: 'select', options: tones, default: 'primary' },
    ],
    render: (p) => (
      <ProgressRing value={num(p.value, 75)} tone={asTone(p.tone)} label="草图圆环">
        <span className="font-display font-semibold">{p.value}%</span>
      </ProgressRing>
    ),
  },
  {
    ref: 'input',
    label: '输入框',
    group: '原子',
    w: 300,
    h: 80,
    props: [
      { key: 'label', label: '标签', type: 'text', default: '今日体重' },
      { key: 'placeholder', label: '占位文字', type: 'text', default: '单位 kg' },
    ],
    render: (p) => (
      <Field label={p.label ?? ''} htmlFor="sketch-input">
        <Input id="sketch-input" placeholder={p.placeholder} readOnly tabIndex={-1} />
      </Field>
    ),
  },
  {
    ref: 'switch',
    label: '开关',
    group: '原子',
    w: 56,
    h: 44,
    props: [
      { key: 'checked', label: '状态', type: 'select', options: ['on', 'off'], default: 'on' },
    ],
    render: (p) => <Switch checked={p.checked !== 'off'} onCheckedChange={noop} label="草图开关" />,
  },
  {
    ref: 'segmented',
    label: '分段切换',
    group: '原子',
    w: 260,
    h: 44,
    props: [{ key: 'options', label: '选项（逗号分隔）', type: 'text', default: '日,周,月' }],
    render: (p) => {
      const options = (p.options ?? '日,周,月')
        .split(/[,，]/)
        .filter(Boolean)
        .map((label, i) => ({ value: String(i), label }))
      return (
        <SegmentedControl
          options={options}
          value="0"
          onValueChange={noop}
          label="草图分段"
          className="w-full"
        />
      )
    },
  },
  {
    ref: 'menu-item',
    label: '菜单项',
    group: '原子',
    w: 320,
    h: 64,
    props: [
      { key: 'label', label: '文字', type: 'text', default: '打卡提醒' },
      { key: 'description', label: '说明', type: 'text', default: '每天 21:00' },
    ],
    render: (p) => (
      <MenuList className="w-full">
        <MenuItem
          label={p.label ?? ''}
          description={p.description}
          icon="bell"
          tone="primary"
          onClick={noop}
        />
      </MenuList>
    ),
  },
  {
    ref: 'avatar',
    label: '头像',
    group: '原子',
    w: 40,
    h: 40,
    props: [{ key: 'name', label: '昵称', type: 'text', default: '小满' }],
    render: (p) => <Avatar name={p.name ?? '?'} />,
  },
  {
    ref: 'stamp',
    label: '印章',
    group: '原子',
    w: 88,
    h: 88,
    props: [
      { key: 'text', label: '文字', type: 'text', default: '已打卡' },
      { key: 'caption', label: '日期', type: 'text', default: '10.31' },
    ],
    render: (p) => <Stamp text={p.text} caption={p.caption} />,
  },
  {
    ref: 'skeleton',
    label: '骨架占位',
    group: '原子',
    w: 200,
    h: 16,
    props: [],
    render: () => <Skeleton className="size-full" />,
  },
  {
    ref: 'placeholder',
    label: '占位框',
    group: '原子',
    w: 200,
    h: 120,
    props: [{ key: 'label', label: '写明这里放什么', type: 'text', default: '图表：本周热量' }],
    render: (p) => (
      <div className="border-border-strong bg-surface-sunken text-caption text-muted flex size-full items-center justify-center rounded-2xl border-2 border-dashed p-2 text-center">
        {p.label}
      </div>
    ),
  },
  {
    ref: 'top-bar',
    label: '顶栏',
    group: '布局',
    w: 390,
    h: 76,
    props: [
      { key: 'title', label: '标题', type: 'text', default: '主页' },
      { key: 'eyebrow', label: '小字', type: 'text', default: '10 月 31 日 · 周六' },
    ],
    render: (p) => <TopBar title={p.title ?? ''} eyebrow={p.eyebrow} sticky={false} />,
  },
  {
    ref: 'bottom-nav',
    label: '底部导航',
    group: '布局',
    w: 362,
    h: 64,
    props: [
      {
        key: 'active',
        label: '当前页',
        type: 'select',
        options: ['/', '/todo', '/rank', '/me'],
        default: '/',
      },
    ],
    render: (p) => (
      <BottomNav items={appNavItems} currentPath={p.active ?? '/'} onAddClick={noop} />
    ),
  },
  {
    ref: 'side-nav',
    label: '侧栏',
    group: '布局',
    w: 256,
    h: 560,
    props: [
      {
        key: 'mode',
        label: '形态',
        type: 'select',
        options: ['expanded', 'compact'],
        default: 'expanded',
      },
    ],
    render: (p) => (
      <SideNav
        items={appNavItems}
        currentPath="/"
        onAddClick={noop}
        mode={p.mode === 'compact' ? 'compact' : 'expanded'}
        className="h-full"
      />
    ),
  },
  {
    ref: 'mascot',
    label: '团团',
    group: '宠物',
    w: 96,
    h: 96,
    props: [
      {
        key: 'mood',
        label: '表情',
        type: 'select',
        options: mascotMoods.map((m) => m.mood),
        default: 'happy',
      },
    ],
    render: (p) => <Mascot mood={(p.mood ?? 'happy') as MascotMood} size={96} />,
  },
  {
    ref: 'agent-turn',
    label: 'AI 回复',
    group: 'Agent',
    w: 380,
    h: 120,
    props: [],
    render: () => <AgentTurn turn={sampleTurn} />,
  },
  {
    ref: 'draft-card',
    label: 'AI 草稿卡',
    group: 'Agent',
    w: 360,
    h: 300,
    props: [
      { key: 'module', label: '板块', type: 'select', options: moduleTones, default: 'diet' },
      { key: 'title', label: '标题', type: 'text', default: '午餐 · 12:30' },
    ],
    render: (p) => (
      <AiDraftCard
        module={asModule(p.module)}
        title={p.title ?? ''}
        confidence={0.8}
        fields={[
          { label: '合计', value: '约 520 kcal' },
          { label: '蛋白质', value: '约 24g' },
        ]}
      />
    ),
  },
  {
    ref: 'quota',
    label: 'AI 额度',
    group: 'Agent',
    w: 240,
    h: 112,
    props: [],
    render: () => <QuotaMeter weeklyLimitMicro={10_000_000} weeklyUsedMicro={3_420_000} compact />,
  },
]

const byRef = new Map(componentRegistry.map((c) => [c.ref, c]))

export const getComponentEntry = (ref: string) => byRef.get(ref)
export const componentLabel = (ref: string) => byRef.get(ref)?.label ?? ref

export function defaultProps(entry: ComponentEntry): Record<string, string> {
  return Object.fromEntries(entry.props.map((p) => [p.key, p.default]))
}
