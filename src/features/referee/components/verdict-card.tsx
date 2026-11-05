import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import type { Verdict } from '../schemas'

/*
 * 裁判结论卡：打卡页的 Agent 分析和对话里的分析回合共用（全局一个 Agent，同一种样子）。
 */

/** 评分结论卡：达标 = 绿，未达标 = 红；有分数时右侧放大显示 */
export function VerdictCard({ verdict }: { verdict: Verdict }) {
  const passed = verdict.isValid
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-2.5',
        passed
          ? 'border-success/40 bg-success-soft text-success-ink'
          : 'border-danger/40 bg-danger-soft text-danger-ink',
      )}
    >
      <span
        className={cn(
          'text-on-primary grid size-8 shrink-0 place-items-center rounded-full',
          passed ? 'bg-success' : 'bg-danger',
        )}
      >
        <Icon name={passed ? 'check' : 'x'} size={16} lineOnly strokeWidth={2.6} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-caption font-bold">{passed ? '达标' : '未达标'}</span>
        <span className="text-tiny leading-snug opacity-90">{verdict.detail}</span>
      </span>
      {verdict.score !== null && (
        <span className="font-display flex shrink-0 flex-col items-end leading-none font-bold">
          <span className="text-heading tabular-nums">{verdict.score.toFixed(1)}</span>
          <span className="text-tiny mt-1 font-semibold opacity-80">
            / {verdict.scoreMax ?? 5} · 线 {String(verdict.metrics.passScore ?? 3)}
          </span>
        </span>
      )}
    </div>
  )
}
