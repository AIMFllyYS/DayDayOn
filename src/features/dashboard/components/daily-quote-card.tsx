import { Icon } from '@/components/ui/icon'
import { summaryTitle } from '../format'

/**
 * 独立每日鼓励语（鸡汤）文本框：与数据进度卡解耦，柔和呈现在主页顶部。
 */
export function DailyQuoteCard({ completion }: { completion: { done: number; planned: number } }) {
  return (
    <div
      data-daily-quote="true"
      className="border-primary/20 bg-primary-soft/35 flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5"
    >
      <span
        aria-hidden="true"
        className="bg-primary/15 text-primary-ink inline-flex size-7 shrink-0 items-center justify-center rounded-full"
      >
        <Icon name="sparkles" size={14} lineOnly />
      </span>
      <p className="text-caption text-foreground min-w-0 flex-1 font-semibold">
        {summaryTitle(completion)}
      </p>
    </div>
  )
}
