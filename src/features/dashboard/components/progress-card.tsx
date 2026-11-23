import Link from 'next/link'
import { IconTile } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { ProgressBar } from '@/components/ui/progress'
import { moduleMeta } from '@/components/ui/tone'
import type { TodayGoal } from '@/features/checkin/schemas'
import { progressText } from '../format'

/** 今日进度（PRD 2.8 第 2 项）：今天计划内的目标一行一个，本人点进打卡页，好友只读态点进好友目标详情 */
export function ProgressCard({
  goals,
  readOnly = false,
  friendUserId,
}: {
  goals: readonly TodayGoal[]
  readOnly?: boolean
  friendUserId?: string
}) {
  const description = readOnly
    ? goals.length > 0
      ? friendUserId
        ? '好友今天计划内的目标进度 · 点一项看详情'
        : '好友今天计划内的目标进度'
      : '好友今天没有计划内的目标'
    : goals.length > 0
      ? '点一项继续打卡'
      : '今天没有计划内的目标'

  return (
    <Card>
      <CardHeader title="今日进度" description={description}>
        {!readOnly && (
          <Link
            href="/goals"
            className="text-caption text-muted hover:text-foreground -m-2 inline-flex min-h-11 items-center gap-0.5 rounded-full px-2 font-semibold"
          >
            全部目标
            <Icon name="chevron-right" size={16} />
          </Link>
        )}
      </CardHeader>
      {goals.length > 0 && (
        <ul className="-mx-2 grid">
          {goals.map((g) => {
            const meta = moduleMeta[g.module]
            const text = progressText(g)
            const rowContent = (
              <>
                <IconTile icon={meta.icon} tone={g.module} size="sm" />
                <span className="text-caption w-20 shrink-0 truncate font-semibold">{g.title}</span>
                <ProgressBar
                  value={g.progress.value}
                  max={g.progress.target}
                  tone={g.module}
                  label={g.title}
                  className="flex-1"
                />
                <span className="font-display text-tiny text-muted w-22 shrink-0 text-right tabular-nums">
                  {text}
                </span>
                {g.progress.done ? (
                  <Icon name="check" size={16} className="text-success-ink shrink-0" />
                ) : !readOnly || friendUserId ? (
                  <Icon name="chevron-right" size={16} className="text-subtle shrink-0" />
                ) : null}
              </>
            )

            const href = readOnly
              ? friendUserId
                ? `/friends/${encodeURIComponent(friendUserId)}/goals/${encodeURIComponent(g.goalId)}`
                : null
              : `/goals/${g.goalId}/checkin`

            return (
              <li key={g.goalId}>
                {href === null ? (
                  <div className="flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-1.5">
                    {rowContent}
                  </div>
                ) : (
                  <Link
                    href={href}
                    aria-label={`${g.title}，${text}${g.progress.done ? '，已完成' : ''}，${readOnly ? '查看详情' : '去打卡'}`}
                    className="hover:bg-surface-sunken flex min-h-11 items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors duration-(--dur-fast)"
                  >
                    {rowContent}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
