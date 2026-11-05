import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import type { DraftVerdict } from '../schemas'

/*
 * 草稿卡里的裁判结论条（checkin-modules.md 第 8 节）：确认前就告诉用户这条算不算有效打卡。
 * 结论由服务端按达标规则算出，入库时再算一次；这里只展示。
 */

function scoreText(v: DraftVerdict): string | null {
  if (v.score === null) return null
  return v.scoreMax === null ? `${v.score.toFixed(1)} 分` : `${v.score.toFixed(1)} / ${v.scoreMax}`
}

export function VerdictStrip({
  verdict,
  className,
}: {
  verdict: DraftVerdict
  className?: string
}) {
  const score = scoreText(verdict)
  const misses = verdict.checks.filter((c) => !c.ok).slice(0, 2)
  return (
    <div
      className={cn(
        'rounded-xl px-3 py-2.5',
        verdict.isValid ? 'bg-success-soft text-success-ink' : 'bg-warning-soft text-warning-ink',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon name={verdict.isValid ? 'shield' : 'alert'} size={16} />
        <p className="min-w-0 flex-1 font-semibold">
          {verdict.isValid ? '达标 · 计入进度' : '未达标 · 只存档'}
        </p>
        {score && <span className="font-display font-semibold tabular-nums">{score}</span>}
      </div>
      <p className="text-tiny mt-1 break-words">{verdict.detail}</p>
      {misses.length > 0 && (
        <ul className="text-tiny mt-1 flex flex-col gap-0.5">
          {misses.map((c) => (
            <li key={c.text} className="flex items-start gap-1">
              <Icon name="x" size={12} className="mt-0.5 shrink-0" />
              <span className="break-words">{c.text}</span>
            </li>
          ))}
        </ul>
      )}
      {verdict.offline && (
        <Badge tone="neutral" className="mt-1.5">
          按规则估算
        </Badge>
      )}
    </div>
  )
}
