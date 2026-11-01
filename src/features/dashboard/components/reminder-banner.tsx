'use client'

import { IconButton } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import type { Reminder } from '../schemas'
import { useReminderDismissed } from '../reminder-dismissal'

/**
 * 打卡提醒（PRD 7.1）："今天还有 N 项没打卡"。可关闭，当天关掉后不再出现（localStorage 记日期）。
 * 只是应用内提示：不发邮件、不推送。
 */
export function ReminderBanner({ reminder, localDate }: { reminder: Reminder; localDate: string }) {
  const { dismissed, dismiss } = useReminderDismissed(localDate)
  if (dismissed) return null
  return (
    <div
      role="status"
      className="bg-warning-soft text-warning-ink animate-fade-up flex items-center gap-3 rounded-2xl py-1 pr-1 pl-4"
    >
      <Icon name="bell" size={20} className="shrink-0" />
      <p className="text-caption min-w-0 flex-1 font-semibold">
        今天还有 {reminder.remaining} 项没打卡，现在记一下吧
      </p>
      <IconButton icon="x" label="今天不再提醒" onClick={dismiss} />
    </div>
  )
}
