import { PendingCard } from '@/features/shared/components/pending-card'

export interface GoalCheckinHistoryProps {
  goalId: string
}

/**
 * 目标详情页的打卡历史列表（PRD 2.3、2.4）：GET /goals/{goalId}/checkins 游标分页，可删除（二次确认）。
 * 自定义目标按当时的字段版本展示。props F1 定；实现 D3；D2 的详情页嵌入。
 */
export function GoalCheckinHistory({ goalId }: GoalCheckinHistoryProps) {
  void goalId
  return <PendingCard title="打卡记录" owner="D3" />
}
