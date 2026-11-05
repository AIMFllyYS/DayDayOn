import type { LocalDate } from '@/features/shared/schemas'
import { addDays } from '@/lib/time'

/*
 * Agent 能改、删哪些打卡（checkin-modules.md 第 7 节）：只限今天和昨天的打卡日。
 * 草稿工具（出草稿前）和打卡接口（origin = agent 时）用同一个函数，两层都拦。
 * 页面上的手动删除不受这个限制。
 */

export const AGENT_EDIT_WINDOW_DAYS = 2

export function isAgentEditable(localDate: LocalDate, today: LocalDate): boolean {
  return localDate === today || localDate === addDays(today, -1)
}

export const AGENT_EDIT_WINDOW_TEXT = '团团只能改、删今天和昨天的打卡，更早的请到目标详情页处理'
