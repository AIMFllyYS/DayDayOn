import type { ReactNode } from 'react'
import { WeekHeatmap } from '@/components/charts/week-heatmap'
import { Card, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { InsightGrid } from '@/features/insights/components/insight-card'
import type { Insights } from '@/features/insights/schemas'
import { FeedList } from '@/features/rank/components/feed-list'
import type { DashboardToday } from '../schemas'
import { DailyQuoteCard } from './daily-quote-card'
import { LinkButton } from './link-button'
import { MoodCard, StepsCard, WeightCard } from './metric-cards'
import { ProgressCard } from './progress-card'
import { ReminderBanner } from './reminder-banner'
import { SummaryCard } from './summary-card'

/*
 * 主页仪表盘的展示部分（PRD 2.8，原型 HomeScreen）：只接收数据和回调，不取数据。
 * 正式页面由 HomeView 传入 /dashboard/today（或好友仪表盘）的结果；Playbook 传演示数据。
 * 固定布局：左栏 独立每日鸡汤 → 进度总览 → 今日进度 → 各板块近况（近7天）→ 本周热力图；右栏 体重 / 心情 / 步数 → 榜单动态。
 * 好友视角（readOnly + friendUserId）同步展示好友的各板块近况，点击直达只读好友目标详情。
 */

export interface HomeDashboardProps {
  data: DashboardToday
  /** 数据取到的时刻（毫秒）：动态里区分"今天 / 昨天" */
  now: number
  /** 显示动态时间用的时区 */
  timeZone: string
  onOpenWeight: () => void
  onOpenMood: () => void
  onOpenSteps?: () => void
  /** 查看好友仪表盘时开启只读模式 */
  readOnly?: boolean
  /** 查看好友空间时传入好友 userId，用于拼接只读目标详情跳转链接 */
  friendUserId?: string
  /** 顶部好友视角提示条 */
  friendBanner?: ReactNode
  /** 静态演示语录（Playbook 预览专用，避免多实例读写 localStorage） */
  staticQuote?: string
  /** 各板块近况（近 7 天），本人与好友视角均支持 */
  insights?: Insights
}

export function HomeDashboard({
  data,
  now,
  timeZone,
  onOpenWeight,
  onOpenMood,
  onOpenSteps,
  readOnly = false,
  friendUserId,
  friendBanner,
  staticQuote,
  insights,
}: HomeDashboardProps) {
  if (!data.hasGoals) {
    return (
      <div className="flex flex-col gap-3 pb-8">
        {friendBanner}
        <Card variant="sticker" className="mx-auto w-full max-w-md">
          <EmptyState
            title={readOnly ? '好友还没有设定目标呢' : '还没有目标呢'}
            description={
              readOnly
                ? '等好友选好想坚持的小事，就能在这里看到完整打卡情况啦'
                : '选一两件想坚持的小事，团团陪你每天打卡'
            }
            action={
              !readOnly ? (
                <LinkButton href="/goals" icon="plus">
                  去设定目标
                </LinkButton>
              ) : undefined
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="grid gap-3 pb-8 @xl:grid-cols-[1.25fr_1fr] @xl:gap-4">
      {friendBanner && <div className="@xl:col-span-2">{friendBanner}</div>}

      {!readOnly && data.reminder && (
        <div className="@xl:col-span-2">
          <ReminderBanner reminder={data.reminder} localDate={data.localDate} />
        </div>
      )}

      <div className="grid min-w-0 content-start gap-3">
        {!friendBanner && <DailyQuoteCard completion={data.completion} staticQuote={staticQuote} />}
        <SummaryCard
          localDate={data.localDate}
          completion={data.completion}
          streak={data.streak}
          feed={data.feed}
          overall={data.overall}
          readOnly={readOnly}
        />
        <ProgressCard goals={data.goals} readOnly={readOnly} friendUserId={friendUserId} />
        {insights && insights.items.length > 0 && (
          <section aria-labelledby="home-insights" className="flex flex-col gap-2">
            <h2 id="home-insights" className="text-caption text-muted px-1 font-bold">
              各板块近况 · 近 {insights.days} 天
            </h2>
            <InsightGrid
              items={insights.items}
              days={insights.days}
              columns={2}
              addHref={!readOnly ? '/goals' : undefined}
              getHref={(i) =>
                friendUserId
                  ? `/friends/${encodeURIComponent(friendUserId)}/goals/${encodeURIComponent(i.goalId)}`
                  : `/goals/${encodeURIComponent(i.goalId)}`
              }
            />
          </section>
        )}
        <Card>
          <CardHeader title="本周热力图" description="格子越深，那天完成得越多" />
          <WeekHeatmap days={data.heatmap.days} rows={data.heatmap.rows} today={data.localDate} />
        </Card>
      </div>

      <div className="grid content-start gap-3">
        <div className="grid grid-cols-2 gap-3">
          <WeightCard weight={data.weight} onOpen={onOpenWeight} readOnly={readOnly} />
          <MoodCard mood={data.mood} onOpen={onOpenMood} readOnly={readOnly} />
          <StepsCard
            steps={data.steps}
            onOpen={onOpenSteps}
            readOnly={readOnly}
            className="col-span-2"
          />
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
