import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DailyQuoteCard } from './daily-quote-card'
import { SummaryCard } from './summary-card'

describe('DailyQuoteCard', () => {
  it('将鼓励语独立展示在文本框中，按今日完成状态切换文案', () => {
    const startHtml = renderToStaticMarkup(<DailyQuoteCard completion={{ done: 0, planned: 3 }} />)
    expect(startHtml).toContain('新的一天，从一小步开始')
    expect(startHtml).toContain('data-daily-quote="true"')

    const doneHtml = renderToStaticMarkup(<DailyQuoteCard completion={{ done: 3, planned: 3 }} />)
    expect(doneHtml).toContain('今天的目标都完成啦')
  })
})

describe('SummaryCard', () => {
  it('清晰区分「今日打卡」百分比环与「总打卡进度」进度条，不混入鸡汤标题', () => {
    const html = renderToStaticMarkup(
      <SummaryCard
        localDate="2026-11-16"
        completion={{ done: 2, planned: 3 }}
        streak={5}
        feed={[]}
        overall={{
          checkedDays: 12,
          targetDays: 21,
          startDate: '2026-11-05',
          deadlineDate: '2026-11-25',
          hasDeadline: true,
        }}
      />,
    )
    expect(html).toContain('67%')
    expect(html).toContain('今日打卡')
    expect(html).toContain('已完成 2 / 3 项')
    expect(html).not.toContain('新的一天，从一小步开始')
    expect(html).toContain('总打卡进度')
    expect(html).toContain('21 天周期')
    expect(html).toContain('已打卡 12 / 21 天')
    expect(html).toContain('调整周期')
  })

  it('只读好友模式不渲染调整周期链接，未设截止日期时显示阶段里程碑', () => {
    const html = renderToStaticMarkup(
      <SummaryCard
        localDate="2026-11-16"
        completion={{ done: 1, planned: 1 }}
        streak={3}
        feed={[]}
        overall={{
          checkedDays: 3,
          targetDays: 7,
          startDate: '2026-11-14',
          deadlineDate: null,
          hasDeadline: false,
        }}
        readOnly
      />,
    )
    expect(html).toContain('阶段里程碑')
    expect(html).toContain('已打卡 3 / 7 天')
    expect(html).not.toContain('调整周期')
    expect(html).not.toContain('去设周期')
  })
})
