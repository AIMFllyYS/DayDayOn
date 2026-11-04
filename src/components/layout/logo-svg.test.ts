import { describe, expect, it } from 'vitest'
import {
  LOGO_BG,
  logoDataUri,
  logoSvg,
  paperPlaneSvg,
  type LogoShape,
  type LogoVariant,
} from './logo-svg'

describe('logoSvg (05 连击热力·五彩织锦)', () => {
  it('导出正确的底色', () => {
    expect(LOGO_BG).toBe('#fff8f0')
  })

  const variants: LogoVariant[] = ['full', 'mark']
  const shapes: LogoShape[] = ['rounded', 'square', 'foreground']

  for (const variant of variants) {
    for (const shape of shapes) {
      it(`生成有效的 SVG 字符串: variant=${variant}, shape=${shape}`, () => {
        const svg = logoSvg(variant, shape)
        expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
        expect(svg).toContain('viewBox="0 0 512 512"')
        expect(svg).toContain('</svg>')

        if (shape === 'foreground') {
          // 自适应图标前景层不带大背景矩形
          expect(svg).not.toContain(`fill="${LOGO_BG}"`)
        } else {
          expect(svg).toContain(`fill="${LOGO_BG}"`)
        }
      })

      it(`生成可解析的 base64 Data URI: variant=${variant}, shape=${shape}`, () => {
        const uri = logoDataUri(variant, shape)
        expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true)
        const base64Content = uri.replace('data:image/svg+xml;base64,', '')
        const decoded = atob(base64Content)
        expect(decoded).toContain('<svg')
        expect(decoded).toContain('</svg>')
      })
    }
  }

  it('备选资产 paperPlaneSvg 正常生成', () => {
    const plane = paperPlaneSvg(256)
    expect(plane).toContain('<svg')
    expect(plane).toContain('width="256"')
    expect(plane).toContain('height="256"')
    expect(plane).toContain('</svg>')
  })
})
