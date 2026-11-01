import { Icon } from '@/components/ui/icon'
import { ProgressBar } from '@/components/ui/progress'
import { cn } from '@/lib/cn'
import { formatYuan } from '../format'

interface QuotaMeterProps {
  /** 本周额度上限（微元），默认 10 元 */
  weeklyLimitMicro: number
  /** 本周已用（微元，含已预占未结算） */
  weeklyUsedMicro: number
  /** 兑换码加购余额（微元），长期有效 */
  bonusMicro?: number
  /** 周额度重置时间的展示文字，例如"周一 00:00 重置" */
  resetText?: string
  compact?: boolean
  className?: string
}

/**
 * AI 额度：显示"本周还剩多少"，而不是"用了多少"，减少焦虑感。
 * 剩余低于 20% 变成警告色。扣费顺序是先扣周额度、再扣加购余额（ADR-0002 第 8 节）。
 */
export function QuotaMeter({
  weeklyLimitMicro,
  weeklyUsedMicro,
  bonusMicro = 0,
  resetText = '周一 00:00 重置',
  compact = false,
  className,
}: QuotaMeterProps) {
  const remaining = Math.max(0, weeklyLimitMicro - weeklyUsedMicro)
  const ratio = weeklyLimitMicro > 0 ? remaining / weeklyLimitMicro : 0
  const low = ratio < 0.2
  return (
    <div className={cn('border-border bg-surface rounded-2xl border p-3', className)}>
      <div className="text-tiny text-muted mb-2 flex items-center gap-1.5 font-semibold">
        <Icon name="custom" size={14} />
        本周 AI 额度
        {!compact && <span className="ml-auto font-normal">{resetText}</span>}
      </div>
      <p className="font-display text-heading mb-2 font-semibold">
        {formatYuan(remaining)}
        <span className="text-caption text-muted ml-1 font-normal">
          / {formatYuan(weeklyLimitMicro)}
        </span>
      </p>
      <ProgressBar
        value={remaining}
        max={weeklyLimitMicro}
        tone={low ? 'warning' : 'primary'}
        size="sm"
        label="本周 AI 额度剩余"
      />
      {bonusMicro > 0 && (
        <p className="text-tiny text-muted mt-2">另有加购余额 {formatYuan(bonusMicro)}</p>
      )}
    </div>
  )
}
