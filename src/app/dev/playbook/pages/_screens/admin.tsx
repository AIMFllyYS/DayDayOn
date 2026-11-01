'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/segmented-control'
import type { AdminCodeRow, AdminOverview, AdminUserRow } from '@/features/admin/schemas'
import { CodesTable } from '@/features/admin/components/codes-panel'
import { GenerateCodesSheet } from '@/features/admin/components/generate-codes'
import { OverviewView } from '@/features/admin/components/overview-panel'
import { SettingsForm } from '@/features/admin/components/settings-panel'
import { TwoFactorSetup } from '@/features/admin/components/two-factor-setup'
import { UsersTable } from '@/features/admin/components/users-panel'
import { ApiProvider } from '@/lib/api'
import { eachLocalDate } from '@/lib/time'
import { DEFAULT_SETTINGS } from '@/server/settings-schema'

/*
 * 后台预览（D7）：直接渲染正式组件（src/features/admin/components），只用假数据，操作只弹提示。
 * 正式组件里用到 mutation hook，所以包一层 ApiProvider。
 */

const series = eachLocalDate('2026-10-03', '2026-11-01').map((dayKey, i) => ({
  dayKey,
  spentMicros: i % 6 === 0 ? 0 : 400_000 + ((i * 370_000) % 3_000_000),
}))

const overview: AdminOverview = {
  dayKey: '2026-11-01',
  todaySpentMicros: 6_420_000,
  dailySpendCapMicros: 10_000_000,
  aiPaused: false,
  capReached: false,
  spendSeries: series,
  anomalies: [
    {
      kind: 'user-daily-spend',
      subject: 'u_3f9a',
      label: '阿柚',
      value: 5_380_000,
      detectedAt: '2026-11-01T04:00:00.000Z',
    },
    {
      kind: 'ip-multi-account',
      subject: '58.19.2.33',
      label: null,
      value: 5,
      detectedAt: '2026-11-01T04:00:00.000Z',
    },
  ],
}

const users: AdminUserRow[] = [
  {
    userId: 'u_3f9a',
    nickname: '阿柚',
    email: 'ayou@qq.com',
    role: 'user',
    createdAt: '2026-10-20T02:13:00.000Z',
    signupIp: '58.19.2.33',
    sameIpCount: 5,
    weekSpentMicros: 7_820_000,
    weekCalls: 41,
    bonusMicros: 10_000_000,
    status: 'active',
    banReason: null,
    banExpiresAt: null,
  },
  {
    userId: 'u_8c21',
    nickname: '七七',
    email: 'qiqi@hust.edu.cn',
    role: 'admin',
    createdAt: '2026-10-18T09:40:00.000Z',
    signupIp: '113.57.8.4',
    sameIpCount: 1,
    weekSpentMicros: 120_000,
    weekCalls: 3,
    bonusMicros: 0,
    status: 'active',
    banReason: null,
    banExpiresAt: null,
  },
  {
    userId: 'u_77b0',
    nickname: null,
    email: 'spam01@163.com',
    role: 'user',
    createdAt: '2026-10-31T15:02:00.000Z',
    signupIp: '58.19.2.33',
    sameIpCount: 5,
    weekSpentMicros: 0,
    weekCalls: 0,
    bonusMicros: 0,
    status: 'banned',
    banReason: '批量注册',
    banExpiresAt: '2026-11-07T15:02:00.000Z',
  },
]

const codes: AdminCodeRow[] = [
  {
    id: '0193f6b2-0000-7000-8000-000000000001',
    prefix: 'DDON-K7QX',
    valueMicros: 10_000_000,
    status: 'unused',
    createdAt: '2026-10-30T08:00:00.000Z',
    redeemedBy: null,
    redeemedAt: null,
  },
  {
    id: '0193f6b2-0000-7000-8000-000000000002',
    prefix: 'DDON-3MPA',
    valueMicros: 10_000_000,
    status: 'redeemed',
    createdAt: '2026-10-30T08:00:00.000Z',
    redeemedBy: { userId: 'u_3f9a', nickname: '阿柚', email: 'ayou@qq.com' },
    redeemedAt: '2026-10-31T12:30:00.000Z',
  },
  {
    id: '0193f6b2-0000-7000-8000-000000000003',
    prefix: 'DDON-W2HT',
    valueMicros: 10_000_000,
    status: 'void',
    createdAt: '2026-10-29T08:00:00.000Z',
    redeemedBy: null,
    redeemedAt: null,
  },
]

const generated = {
  valueMicros: 10_000_000,
  codes: ['DDON-K7QX-9MZD-4RTA', 'DDON-PN3E-B8WH-2KXC', 'DDON-5GYV-QJ7M-HD3S'].map((code, i) => ({
    id: `0193f6b2-0000-7000-8000-00000000010${i}`,
    code,
  })),
}

const views = [
  { value: 'overview', label: '额度监控' },
  { value: 'users', label: '用户' },
  { value: 'codes', label: '兑换码' },
  { value: 'settings', label: '设置' },
  { value: '2fa', label: '两步验证' },
] as const
type View = (typeof views)[number]['value']

export function AdminScreen() {
  const [view, setView] = useState<View>('overview')
  const [sheet, setSheet] = useState(false)
  return (
    <ApiProvider>
      <div className="flex w-full min-w-0 flex-col gap-4 py-4">
        <SegmentedControl
          label="后台页面"
          options={views}
          value={view}
          onValueChange={setView}
          className="w-full min-w-0"
        />
        {view === 'overview' && <OverviewView data={overview} demo />}
        {view === 'users' && <UsersTable rows={users} demo />}
        {view === 'codes' && (
          <>
            <Button className="self-start" icon="plus" onClick={() => setSheet(true)}>
              批量生成（看结果）
            </Button>
            <CodesTable rows={codes} demo />
            <GenerateCodesSheet open={sheet} onOpenChange={setSheet} demoResult={generated} />
          </>
        )}
        {view === 'settings' && <SettingsForm settings={DEFAULT_SETTINGS} demo />}
        {view === '2fa' && (
          <TwoFactorSetup
            demo={{
              setup: {
                secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
                account: 'qiqi@hust.edu.cn',
                issuer: 'DayDayOn',
              },
              backupCodes: ['a1b2c-3d4e5', 'f6g7h-8i9j0', 'k1l2m-3n4o5', 'p6q7r-8s9t0'],
            }}
          />
        )}
      </div>
    </ApiProvider>
  )
}
