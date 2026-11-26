import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarqueeText, computeMarqueeDuration } from './marquee-text'

describe('MarqueeText（等高单行条件跑马灯）', () => {
  it('SSR 首帧输出定高 h-7、不折行容器，且不重复渲染克隆轨', () => {
    const html = renderToStaticMarkup(
      <MarqueeText
        text="不必把今天过成一场考试，哪怕只是按时吃饭、出门走走，也已经是很棒的一天了"
        textClassName="text-caption font-semibold"
      />,
    )
    expect(html).toContain('data-marquee="true"')
    expect(html).toContain('data-marquee-active="false"')
    expect(html).toContain('h-7')
    expect(html).toContain('whitespace-nowrap')
    expect(html).not.toContain('aria-hidden="true"')
  })

  it('computeMarqueeDuration 按像素长度恒速计算且不低于 8 秒', () => {
    expect(computeMarqueeDuration(0)).toBe(8)
    expect(computeMarqueeDuration(100)).toBe(8)
    expect(computeMarqueeDuration(400)).toBeCloseTo((400 + 48) / 36, 1)
    expect(computeMarqueeDuration(720)).toBeGreaterThan(computeMarqueeDuration(400))
  })
})
