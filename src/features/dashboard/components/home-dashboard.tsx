import { WeekHeatmap } from '@/components/charts/week-heatmap'
import { Card, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { FeedList } from '@/features/rank/components/feed-list'
import type { DashboardToday } from '../schemas'
import { LinkButton } from './link-button'
import { MoodCard, WeightCard } from './metric-cards'
import { ProgressCard } from './progress-card'
import { ReminderBanner } from './reminder-banner'
import { SummaryCard } from './summary-card'

/*
 * 主页仪表盘的展示部分（PRD 2.8，原型 HomeScreen）：只接收数据和回调，不取数据。
 * 正式页面由 HomeView 传入 /dashboard/today 的结果；Playbook 传演示数据。
 * 固定布局：左栏 总览 → 今日进度 → 本周热力图；右栏 体重 / 心情 → 榜单动态。
 */

export interface HomeDashboardProps {
  data: DashboardToday
  /** 数据取到的时刻（毫秒）：动态里区分"今天 / 昨天" */
  now: number
  /** 显示动态时间用的时区 */
  timeZone: string
  onOpenWeight: () => void
  onOpenMood: () => void
}

export function HomeDashboard({
  data,
  now,
  timeZone,
  onOpenWeight,
  onOpenMood,
}: HomeDashboardProps) {
  if (!data.hasGoals) {
    return (
      <Card variant="sticker" className="mx-auto w-full max-w-md">
        <EmptyState
          title="还没有目标呢"
          description="选一两件想坚持的小事，团团陪你每天打卡"
          action={
            <LinkButton href="/goals/new" icon="plus">
              去设定目标
            </LinkButton>
          }
        />
      </Card>
    )
  }

  return (
    <div className="grid gap-3 pb-8 @xl:grid-cols-[1.25fr_1fr] @xl:gap-4">
      {data.reminder && (
        <div className="@xl:col-span-2">
          <ReminderBanner reminder={data.reminder} localDate={data.localDate} />
        </div>
      )}

      <div className="grid content-start gap-3">
        <SummaryCard
          localDate={data.localDate}
          completion={data.completion}
          streak={data.streak}
          feed={data.feed}
        />
        <ProgressCard goals={data.goals} />
        <Card>
          <CardHeader title="本周热力图" description="格子越深，那天完成得越多" />
          <WeekHeatmap days={data.heatmap.days} rows={data.heatmap.rows} today={data.localDate} />
        </Card>
      </div>

      <div className="grid content-start gap-3">
        <div className="grid grid-cols-2 gap-3">
          <WeightCard weight={data.weight} onOpen={onOpenWeight} />
          <MoodCard mood={data.mood} onOpen={onOpenMood} />
        </div>

        <Card>
          <CardHeader title="榜单动态" description="上榜朋友最近 24 小时的打卡" />
          {data.feed.length > 0 ? (
            <FeedList items={data.feed} now={now} timeZone={timeZone} />
          ) : (
            <EmptyState
              size="compact"
              mood="sleepy"
              title="朋友们还没动静"
              description="先打个卡，说不定你就是第一个"
            />
          )}
        </Card>
      </div>
    </div>
  )
}
