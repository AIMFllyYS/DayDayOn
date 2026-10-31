import type { Pt, Sketch, SketchItem } from './types'
import { frameSize, sketchColorHex } from './types'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** 统一成宽高为正的包围盒 */
export function bbox(item: SketchItem): Box {
  switch (item.kind) {
    case 'stroke': {
      const xs = item.points.map((p) => p.x)
      const ys = item.points.map((p) => p.y)
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
    }
    case 'text': {
      const lines = item.text.split('\n')
      const longest = Math.max(1, ...lines.map((l) => l.length))
      return {
        x: item.x,
        y: item.y,
        w: longest * item.size * 0.95,
        h: lines.length * item.size * 1.35,
      }
    }
    default: {
      const x = Math.min(item.x, item.x + item.w)
      const y = Math.min(item.y, item.y + item.h)
      return { x, y, w: Math.abs(item.w), h: Math.abs(item.h) }
    }
  }
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = dx * dx + dy * dy
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** 命中测试：笔迹和箭头按线段距离，其余按包围盒；tolerance 是画布坐标下的容差 */
export function hitTest(item: SketchItem, p: Pt, tolerance = 8): boolean {
  if (item.kind === 'stroke') {
    for (let i = 1; i < item.points.length; i++) {
      const a = item.points[i - 1]
      const b = item.points[i]
      if (a && b && distToSegment(p, a, b) <= tolerance + item.width / 2) return true
    }
    const only = item.points[0]
    return item.points.length === 1 && !!only && Math.hypot(p.x - only.x, p.y - only.y) <= tolerance
  }
  if (item.kind === 'arrow') {
    return (
      distToSegment(p, { x: item.x, y: item.y }, { x: item.x + item.w, y: item.y + item.h }) <=
      tolerance
    )
  }
  const b = bbox(item)
  return (
    p.x >= b.x - tolerance &&
    p.x <= b.x + b.w + tolerance &&
    p.y >= b.y - tolerance &&
    p.y <= b.y + b.h + tolerance
  )
}

/** 从上往下找第一个命中的元素（数组越靠后越在上层） */
export function topHit(items: readonly SketchItem[], p: Pt, tolerance?: number): SketchItem | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]
    if (it && hitTest(it, p, tolerance)) return it
  }
  return null
}

export function translate(item: SketchItem, dx: number, dy: number): SketchItem {
  if (item.kind === 'stroke') {
    return { ...item, points: item.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
  }
  return { ...item, x: item.x + dx, y: item.y + dy }
}

/** 拖右下角手柄改尺寸；笔迹和文字不支持 */
export function resizeTo(item: SketchItem, corner: Pt): SketchItem {
  if (item.kind === 'stroke' || item.kind === 'text') return item
  if (item.kind === 'arrow') return { ...item, w: corner.x - item.x, h: corner.y - item.y }
  return { ...item, w: Math.max(16, corner.x - item.x), h: Math.max(12, corner.y - item.y) }
}

export const canResize = (item: SketchItem) => item.kind !== 'stroke' && item.kind !== 'text'

/** 用二次贝塞尔曲线连接相邻点的中点，让手绘线条更顺 */
export function strokePath(points: readonly Pt[]): string {
  const [first, ...rest] = points
  if (!first) return ''
  if (rest.length === 0) return `M${first.x} ${first.y}l0.01 0`
  let d = `M${first.x} ${first.y}`
  for (let i = 0; i < rest.length - 1; i++) {
    const a = rest[i]
    const b = rest[i + 1]
    if (!a || !b) continue
    d += `Q${a.x} ${a.y} ${(a.x + b.x) / 2} ${(a.y + b.y) / 2}`
  }
  const last = rest.at(-1)
  if (last) d += `L${last.x} ${last.y}`
  return d
}

export function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number): string {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const a1 = angle + Math.PI - 0.45
  const a2 = angle + Math.PI + 0.45
  return `M${x2 + size * Math.cos(a1)} ${y2 + size * Math.sin(a1)}L${x2} ${y2}L${x2 + size * Math.cos(a2)} ${y2 + size * Math.sin(a2)}`
}

export const round1 = (v: number) => Math.round(v * 10) / 10

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * 导出成独立 SVG：笔迹、图形、文字原样输出；组件画成带名称和属性的虚线框，
 * 方便在文档里直接查看。组件的真实样子以 JSON 里的 ref + props 为准。
 */
export function sketchToSvg(sketch: Sketch, labelOf: (ref: string) => string): string {
  const { width, height } = frameSize[sketch.frame]
  const body = sketch.items
    .map((it) => {
      const color = sketchColorHex[it.color]
      switch (it.kind) {
        case 'stroke':
          return `<path d="${strokePath(it.points)}" fill="none" stroke="${color}" stroke-width="${it.width}" stroke-linecap="round" stroke-linejoin="round"/>`
        case 'rect': {
          const b = bbox(it)
          return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10" fill="none" stroke="${color}" stroke-width="${it.width}"/>`
        }
        case 'ellipse': {
          const b = bbox(it)
          return `<ellipse cx="${b.x + b.w / 2}" cy="${b.y + b.h / 2}" rx="${b.w / 2}" ry="${b.h / 2}" fill="none" stroke="${color}" stroke-width="${it.width}"/>`
        }
        case 'arrow': {
          const x2 = it.x + it.w
          const y2 = it.y + it.h
          return `<g fill="none" stroke="${color}" stroke-width="${it.width}" stroke-linecap="round" stroke-linejoin="round"><path d="M${it.x} ${it.y}L${x2} ${y2}"/><path d="${arrowHead(it.x, it.y, x2, y2, 10 + it.width * 2)}"/></g>`
        }
        case 'text':
          return it.text
            .split('\n')
            .map(
              (line, i) =>
                `<text x="${it.x}" y="${it.y + it.size * (i + 1) * 1.2}" font-size="${it.size}" fill="${color}" font-family="sans-serif">${esc(line)}</text>`,
            )
            .join('')
        case 'image':
          return `<image href="${it.src}" x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" preserveAspectRatio="none"/>`
        case 'component': {
          const props = Object.entries(it.props)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')
          return `<g><rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" rx="10" fill="#fffdf9" stroke="#f28b74" stroke-width="2" stroke-dasharray="6 4"/><text x="${it.x + 8}" y="${it.y + 18}" font-size="13" font-weight="700" fill="#8f3b28" font-family="sans-serif">${esc(labelOf(it.ref))}</text><text x="${it.x + 8}" y="${it.y + 34}" font-size="11" fill="#7a6a5b" font-family="monospace">${esc(props)}</text>${it.note ? `<text x="${it.x}" y="${it.y - 6}" font-size="12" fill="#f28b74" font-family="sans-serif">${esc(it.note)}</text>` : ''}</g>`
        }
      }
    })
    .join('\n  ')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${esc(sketch.title)}</title>
  <rect width="${width}" height="${height}" fill="#fff8f0"/>
  ${body}
</svg>
`
}
