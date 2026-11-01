import type { Module } from '@/features/shared/schemas'
import { PendingCard } from '@/features/shared/components/pending-card'

export interface GoalCheckinCalendarProps {
  goalId: string
  /** 已打卡的日子用板块色标记 */
  module: Module
}

/**
 * 目标详情页的打卡日历（PRD 2.4）：GET /goals/{goalId}/calendar，补卡日用描边样式。
 * props F1 定；实现 D3；D2 的详情页嵌入。
 */
export function GoalCheckinCalendar({ goalId, module }: GoalCheckinCalendarProps) {
  void goalId
  void module
  return <PendingCard title="打卡日历" owner="D3" />
}
