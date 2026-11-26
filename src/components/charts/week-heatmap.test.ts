import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { heatLevel, WeekHeatmap } from './week-heatmap'

describe('heatLevel', () => {
  it('0 和非法值是第 0 档', () => {
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(Number.NaN)).toBe(0)
    expect(heatLevel(-1)).toBe(0)
  })
  it('不到一半是第 1 档，一半起是第 2 档', () => {
    expect(heatLevel(0.3)).toBe(1)
    expect(heatLevel(0.5)).toBe(2)
    expect(heatLevel(0.99)).toBe(2)
  })
  it('全部完成是第 3 档', () => {
    expect(heatLevel(1)).toBe(3)
  })
})

describe('WeekHeatmap 静态渲染', () => {
  it('inRange=false 显示不在打卡范围而不是没有打卡，并展示范围外图例', () => {
    const html = renderToStaticMarkup(
      createElement(WeekHeatmap, {
        days: ['2026-10-26', '2026-10-27', '2026-10-28'],
        today: '2026-10-28',
        rows: [
          {
            module: 'exercise',
            cells: [0, 1, 0],
            inRange: [false, true, true],
          },
        ],
      }),
    )
    expect(html).toContain('data-out-of-range="true"')
    expect(html).toContain('不在打卡范围')
    expect(html).toContain('范围外')
    expect(html).toContain('本周 1 格全部完成，0 格完成了一部分')
  })

  it('非周一起始日期按真实 isoWeekday 显示正确表头星期', () => {
    // 2026-10-28 为周三，2026-10-29 为周四
    const html = renderToStaticMarkup(
      createElement(WeekHeatmap, {
        days: ['2026-10-28', '2026-10-29'],
        today: '2026-10-29',
        rows: [{ module: 'sleep', cells: [1, 0] }],
      }),
    )
    expect(html).toContain('周三 10/28')
    expect(html).toContain('周四 10/29')
    expect(html).not.toContain('周一 10/28')
  })

  it('空行渲染紧凑提示不崩溃', () => {
    const html = renderToStaticMarkup(
      createElement(WeekHeatmap, {
        days: ['2026-10-26'],
        today: '2026-10-26',
        rows: [],
      }),
    )
    expect(html).toContain('本周暂无打卡范围内的记录')
  })

  it('全部格不在范围时展示周期提示而非漏打提示', () => {
    const html = renderToStaticMarkup(
      createElement(WeekHeatmap, {
        days: ['2026-10-26', '2026-10-27'],
        today: '2026-10-27',
        rows: [{ module: 'diet', cells: [0, 0], inRange: [false, false] }],
      }),
    )
    expect(html).toContain('本周不在目标打卡周期内')
  })
})
