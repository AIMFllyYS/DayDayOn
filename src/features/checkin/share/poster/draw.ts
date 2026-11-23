import { encodeQr } from '@/lib/qr'
import { alpha } from './palette'
import type { Painter, Rect } from './types'

/* Canvas 2D 绘图原语：文字、纸片、胶带、印章、二维码等「手账零件」，不含任何板块逻辑。 */

type Ctx = CanvasRenderingContext2D

export function font(
  p: Painter,
  weight: number,
  size: number,
  family: 'sans' | 'display' = 'sans',
): string {
  return `${weight} ${size}px ${p.fonts[family]}`
}

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/** 以 (cx, cy) 为轴心旋转后执行绘制，结束自动还原 */
export function withRotation(ctx: Ctx, cx: number, cy: number, deg: number, fn: () => void) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((deg * Math.PI) / 180)
  ctx.translate(-cx, -cy)
  fn()
  ctx.restore()
}

/** 暖棕色柔和投影（对应 shadow-card / shadow-float） */
export function setShadow(ctx: Ctx, level: 'card' | 'float') {
  ctx.shadowColor = level === 'float' ? 'rgba(74, 63, 53, 0.16)' : 'rgba(74, 63, 53, 0.09)'
  ctx.shadowBlur = level === 'float' ? 36 : 22
  ctx.shadowOffsetY = level === 'float' ? 14 : 8
}

export function truncateText(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  const chars = Array.from(text)
  let lo = 0
  let hi = chars.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (ctx.measureText(`${chars.slice(0, mid).join('')}…`).width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return `${chars.slice(0, lo).join('')}…`
}

const NO_LINE_START = /^[，。、；：！？）》」』”’,.;:!?)%]/

/** 折行的最小单位：连续的数字 / 拉丁字母不拆开，行首禁则标点并入前一个单位 */
function wrapUnits(text: string): string[] {
  const raw = text.match(/[A-Za-z0-9][A-Za-z0-9.,:%+\-–/]*|[\s\S]/gu) ?? []
  const units: string[] = []
  for (const u of raw) {
    if (units.length > 0 && NO_LINE_START.test(u)) units[units.length - 1] += u
    else units.push(u)
  }
  return units
}

/** 中英混排折行，超出 maxLines 时末行加省略号。调用前需先设好 ctx.font */
export function wrapLines(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const units = wrapUnits(text.replace(/\s+/g, ' ').trim())
  const lines: string[] = []
  let cur = ''
  for (let i = 0; i < units.length; i++) {
    const test = cur + units[i]!
    if (cur.length > 0 && ctx.measureText(test).width > maxWidth) {
      if (lines.length === maxLines - 1) {
        lines.push(truncateText(ctx, cur + units.slice(i).join(''), maxWidth))
        return lines
      }
      lines.push(cur.trimEnd())
      cur = units[i]!.trimStart()
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

export interface TextOpts {
  font: string
  color: string
  align?: CanvasTextAlign
  baseline?: CanvasTextBaseline
  /** 超出时截断加省略号 */
  maxWidth?: number
}

/** 画一行文字，返回实际宽度 */
export function drawText(ctx: Ctx, text: string, x: number, y: number, o: TextOpts): number {
  ctx.save()
  ctx.font = o.font
  ctx.fillStyle = o.color
  ctx.textAlign = o.align ?? 'left'
  ctx.textBaseline = o.baseline ?? 'top'
  const shown = o.maxWidth ? truncateText(ctx, text, o.maxWidth) : text
  ctx.fillText(shown, x, y)
  const w = ctx.measureText(shown).width
  ctx.restore()
  return w
}

export function measure(ctx: Ctx, text: string, fontSpec: string): number {
  ctx.save()
  ctx.font = fontSpec
  const w = ctx.measureText(text).width
  ctx.restore()
  return w
}

/** 画一段自动折行的文字，返回画了几行 */
export function drawParagraph(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  o: Omit<TextOpts, 'maxWidth'>,
): number {
  if (maxLines <= 0 || !text) return 0
  ctx.save()
  ctx.font = o.font
  ctx.fillStyle = o.color
  ctx.textAlign = o.align ?? 'left'
  ctx.textBaseline = o.baseline ?? 'top'
  const lines = wrapLines(ctx, text, maxWidth, maxLines)
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight))
  ctx.restore()
  return lines.length
}

/** 纸片 / 卡片：圆角实底 + 可选描边与投影 */
export function drawCard(
  ctx: Ctx,
  r: Rect,
  o: {
    fill: string
    radius?: number
    stroke?: string
    lineWidth?: number
    shadow?: 'card' | 'float'
  },
) {
  ctx.save()
  if (o.shadow) setShadow(ctx, o.shadow)
  roundRectPath(ctx, r.x, r.y, r.w, r.h, o.radius ?? 28)
  ctx.fillStyle = o.fill
  ctx.fill()
  ctx.restore()
  if (o.stroke) {
    ctx.save()
    roundRectPath(ctx, r.x, r.y, r.w, r.h, o.radius ?? 28)
    ctx.strokeStyle = o.stroke
    ctx.lineWidth = o.lineWidth ?? 2
    ctx.stroke()
    ctx.restore()
  }
}

export function drawPill(
  ctx: Ctx,
  x: number,
  y: number,
  text: string,
  o: {
    bg: string
    fg: string
    font: string
    padX?: number
    height?: number
    border?: string
    align?: 'left' | 'right' | 'center'
  },
): number {
  const padX = o.padX ?? 18
  const height = o.height ?? 40
  ctx.save()
  ctx.font = o.font
  const w = Math.ceil(ctx.measureText(text).width + padX * 2)
  const left = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x
  roundRectPath(ctx, left, y, w, height, height / 2)
  ctx.fillStyle = o.bg
  ctx.fill()
  if (o.border) {
    ctx.strokeStyle = o.border
    ctx.lineWidth = 2
    ctx.stroke()
  }
  ctx.fillStyle = o.fg
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(text, left + w / 2, y + height / 2 + 1)
  ctx.restore()
  return w
}

export function dashedLine(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 2,
  dash: [number, number] = [6, 6],
) {
  ctx.save()
  ctx.beginPath()
  ctx.setLineDash(dash)
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.restore()
}

/** 和纸胶带：半透明色条 + 斜纹 + 锯齿撕口，用来把纸片「贴」在手账上 */
export function drawTape(ctx: Ctx, cx: number, cy: number, w: number, deg: number, color: string) {
  const h = 38
  withRotation(ctx, cx, cy, deg, () => {
    const x = cx - w / 2
    const y = cy - h / 2
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y)
    const teeth = 5
    for (let i = 0; i < teeth; i++) {
      ctx.lineTo(x + w - (i % 2 === 0 ? 7 : 0), y + ((i + 1) * h) / teeth)
    }
    ctx.lineTo(x, y + h)
    for (let i = teeth - 1; i >= 0; i--) {
      ctx.lineTo(x + (i % 2 === 0 ? 7 : 0), y + (i * h) / teeth)
    }
    ctx.closePath()
    ctx.fillStyle = alpha(color, 0.55)
    ctx.fill()
    ctx.clip()
    ctx.strokeStyle = 'rgba(255, 253, 249, 0.5)'
    ctx.lineWidth = 6
    for (let sx = x - h; sx < x + w + h; sx += 22) {
      ctx.beginPath()
      ctx.moveTo(sx, y + h)
      ctx.lineTo(sx + h, y)
      ctx.stroke()
    }
    ctx.restore()
  })
}

/** 倾斜手账印章：双圈 + 主字 + 小字 */
export function drawStamp(
  p: Painter,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  deg = -12,
) {
  const { ctx, model } = p
  withRotation(ctx, cx, cy, deg, () => {
    ctx.save()
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = alpha(color, 0.07)
    ctx.fill()
    ctx.lineWidth = Math.max(3.5, radius * 0.055)
    ctx.strokeStyle = color
    ctx.stroke()
    ctx.beginPath()
    ctx.setLineDash([6, 5])
    ctx.arc(cx, cy, radius - radius * 0.13, 0, Math.PI * 2)
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = color
    for (const dx of [-1, 1]) {
      ctx.beginPath()
      ctx.arc(cx + dx * radius * 0.62, cy + radius * 0.02, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = font(p, 700, Math.round(radius * 0.36))
    ctx.fillText(model.status.stampMain, cx, cy - radius * 0.1)
    ctx.font = font(p, 700, Math.round(radius * 0.19))
    ctx.fillText(model.status.stampSub, cx, cy + radius * 0.36)
    ctx.font = font(p, 600, Math.round(radius * 0.15), 'display')
    ctx.fillText('DAYDAYON', cx, cy - radius * 0.52)
    ctx.restore()
  })
}

/** 标准可扫码二维码（白底安静区 + 暖棕墨块） */
export function drawQrCode(ctx: Ctx, url: string, x: number, y: number, size: number, ink: string) {
  const qr = encodeQr(url)
  const quiet = 2
  const cell = size / (qr.size + quiet * 2)
  ctx.save()
  roundRectPath(ctx, x, y, size, size, 12)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.fillStyle = ink
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r * qr.size + c] !== 1) continue
      // 微量 +0.25 消除子像素缝隙，保证扫码识别率
      ctx.fillRect(x + (c + quiet) * cell, y + (r + quiet) * cell, cell + 0.25, cell + 0.25)
    }
  }
  ctx.restore()
}

/** 圆形勾 / 提醒徽标 */
export function drawCheckBadge(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  ok: boolean,
  color: { soft: string; ink: string },
) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = color.soft
  ctx.fill()
  ctx.strokeStyle = color.ink
  ctx.fillStyle = color.ink
  ctx.lineWidth = r * 0.2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  if (ok) {
    ctx.moveTo(cx - r * 0.42, cy + r * 0.04)
    ctx.lineTo(cx - r * 0.1, cy + r * 0.36)
    ctx.lineTo(cx + r * 0.46, cy - r * 0.3)
    ctx.stroke()
  } else {
    ctx.moveTo(cx, cy - r * 0.46)
    ctx.lineTo(cx, cy + r * 0.1)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy + r * 0.44, r * 0.12, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawProgress(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  track: string,
  fill: string,
) {
  const clamped = Math.max(0, Math.min(1, ratio))
  roundRectPath(ctx, x, y, w, h, h / 2)
  ctx.fillStyle = track
  ctx.fill()
  if (clamped > 0) {
    roundRectPath(ctx, x, y, Math.max(h, w * clamped), h, h / 2)
    ctx.fillStyle = fill
    ctx.fill()
  }
}

/** 等比绘制陪伴宠物（没有传 SVG 时不画） */
export function drawMascot(p: Painter, x: number, y: number, size: number): boolean {
  if (!p.mascotImg) return false
  p.ctx.drawImage(p.mascotImg, x, y, size, size)
  return true
}

/** 确定性伪随机（同一张海报每次渲染的星星、纸屑位置一致） */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 四角星 */
export function drawSparkle(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.save()
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2
    const rr = i % 2 === 0 ? r : r * 0.32
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}
