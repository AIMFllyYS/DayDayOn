'use client'

import Link from 'next/link'
import { useState } from 'react'
import { LineChart } from '@/components/charts/line-chart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { ProgressBar } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import type { AdminOverview, Anomaly, AnomalyKind } from '@/features/admin/schemas'
import { useQuery } from '@/lib/api'
import { adminOverviewQuery, useSetAiPaused } from '@/lib/api/queries/admin'
import { formatYuan } from '../money'
import { AdminHeader, ConfirmDialog, messageOf } from './shared'

/*
 * 后台首页（PRD 2.12）：今日全站花费 / 上限、AI 开关、近 30 天花费曲线、异常列表。
 * 恢复只清手动暂停；今天已到上限时提示"先调高今日上限"（PRD 7.3）。
 */

const ANOMALY_META: Record<AnomalyKind, { title: string; value: (v: number) => string }> = {
  'user-daily-spend': { title: '单日花费超过 5 元', value: (v) => formatYuan(v) },
  'user-hourly-calls': { title: '每小时调用超过 60 次', value: (v) => `${v} 次 / 小时` },
  'ip-multi-account': { title: '同一 IP 注册超过 3 个账号', value: (v) => `${v} 个账号` },
  'redeem-failures': { title: '兑换失败过多', value: (v) => `24 小时失败 ${v} 次` },
}

export function OverviewPanel() {
  const query = useQuery(adminOverviewQuery())
  return (
    <div className="flex flex-col gap-4">
      <AdminHeader title="额度监控" description="全站 AI 花费按北京时间每天 00:00 重新计算" />
      {query.isPending ? (
        <OverviewSkeleton />
      ) : query.isError ? (
        <Card>
          <ErrorState
            message={messageOf(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        </Card>
      ) : (
        <OverviewView data={query.data} />
      )}
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div role="status" aria-label="加载中" className="grid gap-4 lg:grid-cols-[2fr_3fr]">
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl lg:col-span-2" />
    </div>
  )
}

interface OverviewViewProps {
  data: AdminOverview
  /** Playbook 演示：按钮只弹提示，不请求接口 */
  demo?: boolean
}

export function OverviewView({ data, demo = false }: OverviewViewProps) {
  return (
    <div className="grid w-full min-w-0 gap-4 lg:grid-cols-[2fr_3fr]">
      <SpendCard data={data} demo={demo} />
      <Card>
        <CardHeader title="近 30 天每日花费" description="北京时间，单位元" />
        <LineChart
          label="近 30 天每日 AI 花费"
          data={data.spendSeries.map((d) => ({
            // 'YYYY-MM-DD' → 'MM/DD'：只是截取显示，不做日期计算
            label: d.dayKey.slice(5).replace('-', '/'),
            value: d.spentMicros / 1_000_000,
          }))}
          unit="元"
          decimals={2}
          emptyText="近 30 天还没有花费"
        />
      </Card>
      <AnomalyList anomalies={data.anomalies} />
    </div>
  )
}

function SpendCard({ data, demo }: OverviewViewProps) {
  const toggle = useSetAiPaused()
  const [confirmPause, setConfirmPause] = useState(false)
  const status = data.aiPaused ? 'paused' : data.capReached ? 'capped' : 'running'

  async function setPaused(paused: boolean) {
    if (demo) {
      toast.info(paused ? '演示：已暂停' : '演示：已恢复')
      return
    }
    try {
      const r = await toggle.mutateAsync(paused)
      if (paused) toast.success('全站 AI 已暂停')
      else if (r.capReached) toast.info('已取消手动暂停，但今天已到上限，先调高今日上限')
      else toast.success('全站 AI 已恢复')
    } catch (error) {
      toast.error(messageOf(error))
      throw error
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-caption text-muted">今日全站花费</p>
          <p className="font-display text-display font-bold tabular-nums">
            {formatYuan(data.todaySpentMicros)}
            <span className="text-subhead text-muted font-semibold">
              {' '}
              / {formatYuan(data.dailySpendCapMicros)}
            </span>
          </p>
        </div>
        {status === 'running' && (
          <Badge tone="success" dot>
            AI 运行中
          </Badge>
        )}
        {status === 'paused' && (
          <Badge tone="warning" dot>
            已手动暂停
          </Badge>
        )}
        {status === 'capped' && (
          <Badge tone="danger" dot>
            已达今日上限
          </Badge>
        )}
      </div>
      <ProgressBar
        label="今日花费占上限"
        value={data.todaySpentMicros}
        max={Math.max(1, data.dailySpendCapMicros)}
        tone={data.capReached ? 'danger' : 'primary'}
      />
      {data.capReached && (
        <p className="text-caption text-danger-ink">
          今天的花费已到上限，AI 会暂停到明天 00:00。要继续用，先
          <Link href="/admin/settings" className="font-semibold underline underline-offset-2">
            调高今日上限
          </Link>
          。
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {data.aiPaused ? (
          <Button
            icon="bolt"
            loading={toggle.isPending}
            onClick={() => void setPaused(false).catch(() => {})}
          >
            恢复全站 AI
          </Button>
        ) : (
          <Button variant="danger" icon="alert" onClick={() => setConfirmPause(true)}>
            暂停全站 AI
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmPause}
        onOpenChange={setConfirmPause}
        title="暂停全站 AI？"
        description="所有人的拍照识别会立即停用，直到你手动恢复。"
        tone="danger"
        confirmLabel="暂停"
        onConfirm={() => setPaused(true)}
      />
    </Card>
  )
}

function AnomalyList({ anomalies }: { anomalies: readonly Anomaly[] }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader title="异常" description="只标记不自动处理；需要时去用户页封号或调额度" />
      {anomalies.length === 0 ? (
        <EmptyState size="compact" title="今天一切正常" description="没有触发任何异常阈值" />
      ) : (
        <ul className="divide-border flex flex-col divide-y">
          {anomalies.map((a) => {
            const meta = ANOMALY_META[a.kind]
            const isUser = a.kind !== 'ip-multi-account'
            return (
              <li
                key={`${a.kind}:${a.subject}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
              >
                <Badge tone={a.kind === 'ip-multi-account' ? 'warning' : 'danger'}>
                  {meta.title}
                </Badge>
                <span className="text-body min-w-0 flex-1 truncate font-semibold">
                  {a.label ?? a.subject}
                  {isUser && a.label && (
                    <span className="text-tiny text-muted ml-2 font-mono font-normal">
                      {a.subject}
                    </span>
                  )}
                </span>
                <span className="text-caption font-display tabular-nums">
                  {meta.value(a.value)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
