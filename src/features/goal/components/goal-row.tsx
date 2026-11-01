import Link from 'next/link'
import type { ReactNode } from 'react'
import { Badge, IconTile } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import { moduleMeta } from '@/components/ui/tone'
import { formatGoalPlan } from '../format'
import type { Goal } from '../schemas'

type GoalRowData = Pick<
  Goal,
  'id' | 'module' | 'title' | 'target' | 'weekdays' | 'plannedTime' | 'status'
>

/** 目标列表的一行：板块图标、标题、计划（每天 · 30分钟 · 07:30），点进详情 */
export function GoalRow({ goal, href }: { goal: GoalRowData; href?: string }) {
  const meta = moduleMeta[goal.module]
  return (
    <li>
      <Link
        href={href ?? `/goals/${goal.id}`}
        className="hover:bg-background active:bg-surface-sunken flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-(--dur-fast)"
      >
        <IconTile icon={meta.icon} tone={goal.module} />
        <span className="min-w-0 flex-1">
          <span className="text-subhead block truncate font-semibold">{goal.title}</span>
          <span className="text-caption text-muted block truncate">
            {meta.label} · {formatGoalPlan(goal)}
          </span>
        </span>
        {goal.status === 'archived' && <Badge>已归档</Badge>}
        <Icon name="chevron-right" size={18} className="text-subtle shrink-0" />
      </Link>
    </li>
  )
}

/** 一组目标行：一张卡片，组内细线分隔（与 MenuList 同一套外观） */
export function GoalRows({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-border bg-surface shadow-soft divide-y overflow-hidden rounded-2xl">
      {children}
    </ul>
  )
}
