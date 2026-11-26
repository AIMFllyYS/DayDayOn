'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { GoalSettingsContent } from '@/features/checkin/components/goal-settings-view'
import { DEFAULT_GOALS } from '@/features/goal/defaults'
import { GoalDetailContent } from '@/features/goal/components/goal-detail-view'
import { GoalForm } from '@/features/goal/components/goal-form'
import { GoalListContent } from '@/features/goal/components/goal-list-view'
import { ModulePicker } from '@/features/goal/components/module-picker'
import { SchemaForm } from '@/features/goal/components/schema-form'
import type { FieldDef, FieldValues, GoalDetail } from '@/features/goal/schemas'
import { ApiProvider } from '@/lib/api'

/*
 * 目标（PRD 2.3）：列表、新建（先选板块）、详情。渲染正式组件 + 演示数据，不接后端。
 * 详情里的打卡日历 / 记录是 D3 的组件，在这里会请求接口（没登录时显示错误态，属正常）；
 * 编辑、归档、删除按钮会真的发请求，演示时只看样式即可。
 */

const NOW = '2026-11-01T08:00:00.000Z'

const demoFields: FieldDef[] = [
  {
    key: 'f1',
    label: '喝了几杯',
    type: 'number',
    unit: '杯',
    min: 0,
    max: 20,
    integer: true,
    required: true,
  },
  {
    key: 'f2',
    label: '感觉',
    type: 'single-select',
    options: ['口渴', '刚好', '喝撑了'],
    required: false,
  },
  { key: 'f3', label: '今天满意吗', type: 'rating', required: false },
  { key: 'f4', label: '备注', type: 'text', maxLength: 100, required: false },
]

function demoGoal(over: Partial<GoalDetail>): GoalDetail {
  return {
    id: '0193f6b2-0000-7000-8000-000000000001',
    module: 'exercise',
    title: '动一动',
    description: null,
    target: { kind: 'duration', value: 1800 },
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    plannedTime: null,
    status: 'active',
    sortOrder: 0,
    fieldVersion: null,
    refereeRules: null,
    deadlineDate: null,
    validDays: 0,
    fields: null,
    createdAt: NOW,
    updatedAt: NOW,
    fieldVersions: [],
    targetHistory: [
      {
        effectiveFrom: '2026-10-20',
        kind: 'duration',
        value: 1800,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
      },
    ],
    ...over,
  }
}

const demoGoals: GoalDetail[] = [
  demoGoal({ plannedTime: '07:00', description: '每天出门走走也算' }),
  demoGoal({
    id: '0193f6b2-0000-7000-8000-000000000002',
    module: 'diet',
    title: '好好吃饭',
    target: { kind: 'count', value: 3 },
  }),
  demoGoal({
    id: '0193f6b2-0000-7000-8000-000000000003',
    module: 'sleep',
    title: '早点睡',
    target: { kind: 'duration', value: 28_800 },
  }),
  demoGoal({
    id: '0193f6b2-0000-7000-8000-000000000004',
    module: 'study',
    title: '背单词',
    target: { kind: 'count', value: 2 },
    weekdays: [1, 2, 3, 4, 5],
  }),
  demoGoal({
    id: '0193f6b2-0000-7000-8000-000000000005',
    module: 'custom',
    title: '多喝水',
    target: { kind: 'count', value: 1 },
    fieldVersion: 2,
    fields: demoFields,
  }),
]

type View = 'settings' | 'list' | 'new' | 'form' | 'detail' | 'schema'

const VIEWS = [
  { value: 'settings', label: '目标设置' },
  { value: 'list', label: '列表' },
  { value: 'new', label: '选板块' },
  { value: 'form', label: '表单' },
  { value: 'detail', label: '详情' },
  { value: 'schema', label: '动态表单' },
] as const

const demoMe = {
  profile: {
    nickname: '小满',
    avatar: 'mascot:tuan:happy:primary',
    gender: null,
    birthYear: null,
    heightCm: null,
    timeZone: 'Asia/Shanghai',
  },
  preferences: {
    theme: 'caramel' as const,
    mascot: 'tuan' as const,
    leaderboardOptIn: true,
    dayStartHour: 4,
    remindAt: '21:00',
    remindMode: 'in-app' as const,
    refereeTier: 'balanced-glycemic' as const,
  },
}

const demoOverall = {
  checkedDays: 12,
  targetDays: 21,
  startDate: '2026-10-21',
  deadlineDate: '2026-11-10',
  hasDeadline: true,
}

const FOOTER_MODES = [
  { value: 'auto', label: '自动断点' },
  { value: 'inline', label: '宽裕态（页底）' },
  { value: 'dock', label: '紧凑态（收进 Dock）' },
] as const

const demoArchived: GoalDetail[] = [
  demoGoal({
    id: '0193f6b2-0000-7000-8000-000000000099',
    module: 'custom',
    title: '每天练琴 20 分钟',
    status: 'archived',
  }),
]

export function GoalsScreen() {
  const [view, setView] = useState<View>('settings')
  const [footerMode, setFooterMode] = useState<'auto' | 'inline' | 'dock'>('auto')
  const [values, setValues] = useState<FieldValues>({ f1: 6 })
  const custom = DEFAULT_GOALS.custom

  return (
    <ApiProvider>
      <div className="flex w-full min-w-0 flex-col gap-4" data-ann="playbook.pages.goals">
        <div className="flex flex-wrap items-center gap-2">
          <div className="max-w-full overflow-x-auto pb-1">
            <SegmentedControl
              label="目标页面"
              size="sm"
              options={VIEWS}
              value={view}
              onValueChange={setView}
            />
          </div>
          {view === 'settings' && (
            <SegmentedControl
              label="底部入口布局"
              size="sm"
              options={FOOTER_MODES}
              value={footerMode}
              onValueChange={setFooterMode}
            />
          )}
        </div>
        {view === 'settings' && (
          <GoalSettingsContent
            active={demoGoals}
            archived={demoArchived}
            me={demoMe}
            today="2026-11-01"
            overall={demoOverall}
            footerMode={footerMode}
          />
        )}
        {view === 'list' && <GoalListContent items={demoGoals} status="active" />}
        {view === 'new' && <ModulePicker hrefFor={() => '#'} />}
        {view === 'form' && (
          <GoalForm
            id="pb-goal-form"
            module="custom"
            initial={{ ...custom, description: null, plannedTime: null, fields: demoFields }}
            onSubmit={() => undefined}
          />
        )}
        {view === 'detail' && <GoalDetailContent goal={demoGoals[4] ?? demoGoal({})} />}
        {view === 'schema' && (
          <SchemaForm fields={demoFields} value={values} onChange={setValues} />
        )}
      </div>
    </ApiProvider>
  )
}
