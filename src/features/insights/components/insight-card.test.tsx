import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GoalInsight } from '../schemas'
import { InsightGrid } from './insight-card'

function makeInsight(index: number): GoalInsight {
  const modules = ['exercise', 'diet', 'sleep', 'study', 'custom'] as const
  const mod = modules[index % modules.length]!
  return {
    goalId: `00000000-0000-4000-8000-00000000000${index + 1}`,
    module: mod,
    title: `板块 ${index + 1}`,
    total: 5,
    valid: 4,
    validDays: 4,
    avgScore: mod === 'diet' ? 4.2 : null,
    passScore: mod === 'diet' ? 3 : null,
    totalSeconds: 9000,
    dailyTargetSeconds: 1800,
    kcal: mod === 'exercise' ? 1200 : null,
    avgSleepSeconds: mod === 'sleep' ? 27000 : null,
    avgBedMinutes: mod === 'sleep' ? 1390 : null,
    lateNights: mod === 'sleep' ? 1 : null,
    bedtimeBy: mod === 'sleep' ? '23:30' : null,
    minSleepSeconds: mod === 'sleep' ? 25200 : null,
    series: [
      { date: '2026-11-17', value: 1800 },
      { date: '2026-11-18', value: 1800 },
      { date: '2026-11-19', value: 0 },
      { date: '2026-11-20', value: 1800 },
      { date: '2026-11-21', value: 1800 },
      { date: '2026-11-22', value: 1800 },
      { date: '2026-11-23', value: null },
    ],
    topFailure: null,
    deadline: null,
  }
}

describe('InsightGrid', () => {
  it.each([1, 3, 5])(
    '传入 addHref 且有 %d 个板块（奇数）时，右侧补齐虚线「＋」卡片跳目标设置',
    (n) => {
      const items = Array.from({ length: n }, (_, i) => makeInsight(i))
      const html = renderToStaticMarkup(
        <InsightGrid items={items} days={7} columns={2} addHref="/goals" />,
      )
      expect(html).toContain('data-insight-add-card="true"')
      expect(html).toContain('href="/goals"')
      expect(html).toContain('添加板块')
    },
  )

  it.each([2, 4])('传入 addHref 且有 %d 个板块（偶数）时，不渲染多余虚线卡片', (n) => {
    const items = Array.from({ length: n }, (_, i) => makeInsight(i))
    const html = renderToStaticMarkup(
      <InsightGrid items={items} days={7} columns={2} addHref="/goals" />,
    )
    expect(html).not.toContain('data-insight-add-card="true"')
  })

  it('好友视角通过 getHref 跳只读好友目标详情且不显示虚线添加卡片', () => {
    const items = [makeInsight(0), makeInsight(1), makeInsight(2)]
    const html = renderToStaticMarkup(
      <InsightGrid
        items={items}
        days={7}
        columns={2}
        getHref={(i) => `/friends/friend-u1/goals/${i.goalId}`}
      />,
    )
    expect(html).not.toContain('data-insight-add-card="true"')
    expect(html).toContain(`/friends/friend-u1/goals/${items[0]!.goalId}`)
  })
})
