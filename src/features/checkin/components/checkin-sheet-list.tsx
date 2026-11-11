'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { IconTile } from '@/components/ui/badge'
import { Icon, type IconName } from '@/components/ui/icon'
import { ProgressBar } from '@/components/ui/progress'
import { moduleMeta, type Tone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { gramsToKg, rowStatusText } from '../format'
import type { CheckinLauncherView } from '../launcher-store'
import type { CheckinToday } from '../schemas'

/*
 * 打卡弹层的列表视图（原型 Playbook _components/checkin-sheet.tsx：菜单列表从下往上拉）。
 * 行 = 今天计划内的进行中目标（PRD 7.2），另有"体重""今日心情"两行快捷记录。
 * 纯展示：数据由 CheckinSheet 传入，Playbook 用演示数据渲染同一个组件。
 */

const moodText = ['很糟', '不太好', '一般', '不错', '超棒'] as const

export interface CheckinSheetListProps {
  data: CheckinToday
  /** 点目标行跳转前调用（关闭弹层） */
  onNavigate: () => void
  /** 切到体重 / 心情视图 */
  onOpenView: (view: Exclude<CheckinLauncherView, 'list'>) => void
  /** 今天没有计划目标时只显示两行快捷记录 */
  metricsOnly?: boolean
}

const rowClass =
  'animate-fade-up hover:bg-surface active:bg-surface-sunken flex min-h-15 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-(--dur-fast)'

function RowBody({
  icon,
  tone,
  title,
  status,
  done,
}: {
  icon: IconName
  tone: Tone
  title: string
  status: string
  done: boolean
}): ReactNode {
  return (
    <>
      <IconTile icon={icon} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        <span className={cn('text-tiny block truncate', done ? 'text-success-ink' : 'text-muted')}>
          {status}
        </span>
      </span>
      {done ? (
        <span className="bg-success-soft text-success-ink flex size-7 items-center justify-center rounded-full">
          <Icon name="check" size={14} strokeWidth={2.6} label="已完成" />
        </span>
      ) : (
        <Icon name="chevron-right" size={18} className="text-subtle" />
      )}
    </>
  )
}

export function CheckinSheetList({
  data,
  onNavigate,
  onOpenView,
  metricsOnly,
}: CheckinSheetListProps) {
  const { done, planned } = data.completion
  const delay = (i: number) => ({ animationDelay: `${Math.min(i, 6) * 60}ms` })
  return (
    <>
      {!metricsOnly && planned > 0 && (
        <ProgressBar value={done} max={planned} label="今日完成目标" size="sm" />
      )}
      {!metricsOnly && (
        <ul className="divide-border bg-surface-sunken/60 mt-3 divide-y overflow-hidden rounded-2xl">
          {data.goals.map((g, i) => (
            <li key={g.goalId}>
              <Link
                href={`/goals/${g.goalId}/checkin`}
                onClick={onNavigate}
                className={rowClass}
                style={delay(i)}
              >
                <RowBody
                  icon={moduleMeta[g.module].icon}
                  tone={g.module}
                  title={g.title}
                  status={rowStatusText(g.target.kind, g.progress)}
                  done={g.progress.done}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ul className="divide-border bg-surface-sunken/60 mt-3 divide-y overflow-hidden rounded-2xl">
        <li>
          <button type="button" onClick={() => onOpenView('weight')} className={rowClass}>
            <RowBody
              icon="chart"
              tone="primary"
              title="体重"
              status={
                data.weightGrams === null
                  ? '今天还没记'
                  : `今天 ${gramsToKg(data.weightGrams).toFixed(1)} kg`
              }
              done={data.weightGrams !== null}
            />
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onOpenView('mood')} className={rowClass}>
            <RowBody
              icon="heart"
              tone="custom"
              title="今日心情"
              status={
                data.mood === null ? '今天感觉怎么样？' : `今天${moodText[data.mood - 1] ?? ''}`
              }
              done={data.mood !== null}
            />
          </button>
        </li>
        <li>
          <button type="button" onClick={() => onOpenView('steps')} className={rowClass}>
            <RowBody
              icon="footprints"
              tone="exercise"
              title="今日步数"
              status="同步手机计步或手动记录步数"
              done={false}
            />
          </button>
        </li>
      </ul>
    </>
  )
}

/**
 * 一个目标都没有时的占位卡：虚线框，尺寸和目标行一致；点击去全局唯一的目标设置页
 * （checkin-modules.md 第 5 节）。
 */
export function FirstCheckinCard({ onNavigate }: { onNavigate: () => void }) {
  return (
    <Link
      href="/goals"
      onClick={onNavigate}
      className="animate-fade-up border-border-strong text-muted hover:text-foreground hover:bg-surface flex min-h-15 w-full items-center gap-3 rounded-2xl border-2 border-dashed px-3.5 py-2.5 transition-colors duration-(--dur-fast)"
    >
      <span className="border-border-strong grid size-10 shrink-0 place-items-center rounded-xl border border-dashed">
        <Icon name="plus" size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block font-semibold">建立你的第一个打卡</span>
        <span className="text-tiny block truncate">选板块、定人群和达标规则，一分钟搞定</span>
      </span>
      <Icon name="chevron-right" size={18} className="text-subtle" />
    </Link>
  )
}
