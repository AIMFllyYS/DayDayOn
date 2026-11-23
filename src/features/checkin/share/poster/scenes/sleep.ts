import { checksCardHeight, drawChecksCard, drawKpi, drawPetNote, drawTitleBlock } from '../blocks'
import {
  dashedLine,
  drawCard,
  drawPill,
  drawSparkle,
  drawStamp,
  drawText,
  font,
  hashSeed,
  roundRectPath,
  seededRandom,
} from '../draw'
import type { SleepPosterModel } from '../model'
import { axisLabel } from '../model'
import { alpha } from '../palette'
import type { Painter, PosterScene, Rect } from '../types'

/*
 * 睡眠 ·「昨夜星图」：整张海报唯一的深色块是一片薰衣草夜空——
 * 地平线就是时间轴，月亮从入睡时刻升起、沿弧线划到起床时刻的日出，入睡红线是插在地平线上的小旗。
 */

function sceneOf(p: Painter): SleepPosterModel {
  if (p.model.scene.module !== 'sleep') throw new Error('sleep scene 需要睡眠模型')
  return p.model.scene
}

function drawMoon(p: Painter, cx: number, cy: number, R: number) {
  const { ctx, palette } = p
  ctx.save()
  ctx.shadowColor = alpha(palette.surface, 0.55)
  ctx.shadowBlur = R * 0.9
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.clip()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.arc(cx + R * 0.46, cy - R * 0.3, R * 0.86, 0, Math.PI * 2)
  ctx.fillStyle = palette.surface
  ctx.fill('evenodd')
  ctx.restore()
}

function drawNightSky(p: Painter, r: Rect, o: { arcH: number; kpiSize: number; titleW: number }) {
  const { ctx, palette, accent, input } = p
  const s = sceneOf(p)
  const cream = palette.surface
  drawCard(ctx, r, { fill: accent.ink, radius: 42, shadow: 'float' })

  ctx.save()
  roundRectPath(ctx, r.x, r.y, r.w, r.h, 42)
  ctx.clip()
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h)
  g.addColorStop(0, 'rgba(22, 16, 58, 0.5)')
  g.addColorStop(0.75, 'rgba(22, 16, 58, 0)')
  ctx.fillStyle = g
  ctx.fillRect(r.x, r.y, r.w, r.h)

  // 星星：按日期播种，同一天的星图永远一样
  const rand = seededRandom(hashSeed(`${input.today}:${s.bed}:${s.wake}`))
  const horizon = r.y + r.h - 104
  const starCount = Math.round((r.w * r.h) / 9000)
  for (let i = 0; i < starCount; i++) {
    const sx = r.x + 30 + rand() * (r.w - 60)
    const sy = r.y + 24 + rand() * (horizon - r.y - 70)
    ctx.beginPath()
    ctx.arc(sx, sy, 1 + rand() * 2, 0, Math.PI * 2)
    ctx.fillStyle = alpha(accent.soft, 0.25 + rand() * 0.6)
    ctx.fill()
  }
  // 四角星避开标题与印章
  for (let i = 0, placed = 0; i < 40 && placed < 7; i++) {
    const sx = r.x + 60 + rand() * (r.w - 120)
    const sy = r.y + 50 + rand() * (horizon - r.y - 190)
    const size = 7 + rand() * 9
    const onTitle = sx < r.x + o.titleW + 110 && sy < r.y + 210
    const onStamp = sx > r.x + r.w - 290 && sy < r.y + 270
    if (onTitle || onStamp) continue
    drawSparkle(ctx, sx, sy, size, alpha(cream, 0.75))
    placed += 1
  }

  // 地平线 = 时间轴
  const ax0 = r.x + 76
  const ax1 = r.x + r.w - 76
  const toX = (min: number) =>
    ax0 +
    ((Math.max(s.axis.start, Math.min(s.axis.end, min)) - s.axis.start) /
      (s.axis.end - s.axis.start)) *
      (ax1 - ax0)
  ctx.fillStyle = 'rgba(22, 16, 58, 0.28)'
  ctx.fillRect(r.x, horizon, r.w, r.h)
  ctx.fillStyle = alpha(accent.soft, 0.7)
  ctx.fillRect(r.x, horizon - 1.5, r.w, 3)
  const hours = (s.axis.end - s.axis.start) / 60
  const labelEvery = hours > 12 ? 3 : hours > 9 ? 2 : 1
  for (let h = 0; h <= hours; h++) {
    const tx = toX(s.axis.start + h * 60)
    const major = h % labelEvery === 0
    ctx.fillStyle = alpha(accent.soft, major ? 0.9 : 0.45)
    ctx.fillRect(tx - 1.5, horizon, 3, major ? 14 : 8)
    if (major) {
      drawText(ctx, axisLabel(s.axis.start + h * 60), tx, horizon + 26, {
        font: font(p, 600, 21, 'display'),
        color: alpha(accent.soft, 0.9),
        align: 'center',
      })
    }
  }

  // 睡眠弧线：从入睡到起床
  const xb = toX(s.axis.bed)
  const xw = toX(s.axis.wake)
  const mid = (xb + xw) / 2
  const rx = Math.max(40, (xw - xb) / 2)
  const ry = Math.min(o.arcH, Math.max(rx * 1.1, o.arcH * 0.7))
  const fill = ctx.createLinearGradient(0, horizon - ry, 0, horizon)
  fill.addColorStop(0, alpha(accent.base, 0.34))
  fill.addColorStop(1, alpha(accent.base, 0.04))
  ctx.beginPath()
  ctx.ellipse(mid, horizon, rx, ry, 0, Math.PI, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.beginPath()
  ctx.setLineDash([3, 13])
  ctx.lineCap = 'round'
  ctx.ellipse(mid, horizon, rx, ry, 0, Math.PI, Math.PI * 2)
  ctx.strokeStyle = alpha(cream, 0.85)
  ctx.lineWidth = 5
  ctx.stroke()
  ctx.setLineDash([])

  // 日出：起床时刻半个太阳探出地平线
  ctx.save()
  ctx.beginPath()
  ctx.rect(r.x, r.y, r.w, horizon - r.y)
  ctx.clip()
  ctx.shadowColor = alpha(cream, 0.6)
  ctx.shadowBlur = 40
  ctx.beginPath()
  ctx.arc(xw, horizon, 30, 0, Math.PI * 2)
  ctx.fillStyle = cream
  ctx.fill()
  ctx.restore()
  // 入睡点
  ctx.beginPath()
  ctx.arc(xb, horizon, 10, 0, Math.PI * 2)
  ctx.fillStyle = cream
  ctx.fill()
  ctx.restore()

  // 月亮挂在弧线左上段
  const ma = Math.PI * 1.27
  drawMoon(p, mid + Math.cos(ma) * rx, horizon + Math.sin(ma) * ry, 34)

  // 入睡红线小旗
  const xr = toX(s.axis.red)
  const late = s.lateBy !== null && s.lateBy > 0
  const flagTop = horizon - Math.min(150, ry * 0.62)
  dashedLine(ctx, xr, flagTop, xr, horizon, palette.tones.warning.base, 3, [7, 7])
  drawPill(ctx, xr, flagTop - 42, `红线 ${s.redline}`, {
    bg: late ? palette.tones.warning.base : alpha(cream, 0.16),
    fg: late ? palette.foreground : cream,
    font: font(p, 700, 19),
    height: 36,
    padX: 14,
    align: xr - r.x < 140 ? 'left' : 'center',
  })

  // 两端时刻
  const tagY = horizon - 62
  drawText(ctx, '入睡', xb - 18, tagY - 28, {
    font: font(p, 600, 19),
    color: alpha(cream, 0.75),
    align: 'right',
  })
  drawText(ctx, s.bed, xb - 18, tagY, {
    font: font(p, 700, 30, 'display'),
    color: cream,
    align: 'right',
  })
  drawText(ctx, '起床', xw + 40, tagY - 28, { font: font(p, 600, 19), color: alpha(cream, 0.75) })
  drawText(ctx, s.wake, xw + 40, tagY, { font: font(p, 700, 30, 'display'), color: cream })

  // 主数字：弧线够宽就放在弧线下，否则悬在弧顶上方
  const inside = xw - xb > o.kpiSize * 4.4
  const kpiY = inside ? horizon - o.kpiSize * 1.08 - 24 : horizon - ry - o.kpiSize * 1.2
  drawKpi(p, inside ? mid : r.x + r.w / 2, kpiY, {
    size: o.kpiSize,
    onDark: true,
    align: 'center',
    sub: false,
  })

  drawTitleBlock(p, r.x + 48, r.y + 44, o.titleW, { onDark: true, titleSize: p.portrait ? 56 : 48 })
  drawStamp(p, r.x + r.w - 136, r.y + 132, p.portrait ? 92 : 84, cream, 10)
}

/** 睡眠小结：距红线 / 规律度 / 手环分期，标题右侧五枚小月亮表示自评质量 */
function drawSleepStats(p: Painter, r: Rect) {
  const { ctx, palette, accent } = p
  const s = sceneOf(p)
  drawCard(ctx, r, { fill: palette.surface, radius: 30, stroke: palette.border, shadow: 'card' })
  const pad = 28
  drawText(ctx, '睡眠小结', r.x + pad, r.y + pad - 2, {
    font: font(p, 700, 24),
    color: palette.foreground,
  })
  if (s.quality !== null) {
    for (let i = 0; i < 5; i++) {
      ctx.beginPath()
      ctx.arc(r.x + r.w - pad - 12 - (4 - i) * 32, r.y + pad + 12, 11, 0, Math.PI * 2)
      ctx.fillStyle = i < s.quality ? accent.base : palette.surfaceSunken
      ctx.fill()
    }
  }
  const tiles = [
    {
      label: '距入睡红线',
      value:
        s.lateBy === null ? '—' : s.lateBy <= 0 ? `早 ${-s.lateBy} 分钟` : `晚 ${s.lateBy} 分钟`,
      warn: s.lateBy !== null && s.lateBy > 0,
    },
    {
      label: '作息规律度',
      value: s.regularity === null ? '待满两晚' : `±${Math.round(s.regularity)} 分钟`,
      warn: false,
    },
    ...s.stages.map((st) => ({ ...st, warn: false })),
  ]
  const cols = Math.min(tiles.length, r.w > 800 ? 3 : 2)
  const top = r.y + pad + 50
  const rows = Math.max(
    1,
    Math.min(Math.ceil(tiles.length / cols), Math.floor((r.y + r.h - pad - top + 12) / 72)),
  )
  const gap = 12
  const tw = (r.w - pad * 2 - gap * (cols - 1)) / cols
  const th = (r.y + r.h - pad - top - gap * (rows - 1)) / rows
  tiles.slice(0, cols * rows).forEach((t, i) => {
    const tx = r.x + pad + (i % cols) * (tw + gap)
    const ty = top + Math.floor(i / cols) * (th + gap)
    roundRectPath(ctx, tx, ty, tw, th, 18)
    ctx.fillStyle = palette.surfaceSunken
    ctx.fill()
    const stacked = th >= 84
    drawText(ctx, t.label, tx + 18, stacked ? ty + th / 2 - 34 : ty + th / 2, {
      font: font(p, 600, 19),
      color: palette.muted,
      baseline: stacked ? 'top' : 'middle',
    })
    drawText(
      ctx,
      t.value,
      stacked ? tx + 18 : tx + tw - 18,
      stacked ? ty + th / 2 - 4 : ty + th / 2,
      {
        font: font(p, 700, stacked ? 28 : 24, 'display'),
        color: t.warn ? palette.tones.warning.ink : accent.ink,
        align: stacked ? 'left' : 'right',
        baseline: stacked ? 'top' : 'middle',
        maxWidth: stacked ? tw - 36 : tw * 0.56,
      },
    )
  })
}

function landscape(p: Painter) {
  drawNightSky(p, { x: 64, y: 120, w: 1792, h: 504 }, { arcH: 216, kpiSize: 132, titleW: 560 })
  drawSleepStats(p, { x: 64, y: 650, w: 572, h: 278 })
  const ch = checksCardHeight(p, 560, 278)
  drawChecksCard(p, { x: 660, y: 928 - ch, w: 560, h: ch })
  drawPetNote(p, { x: 1244, y: 650, w: 612, h: 278 }, { anchor: 'bottom' })
}

function portrait(p: Painter) {
  drawNightSky(p, { x: 56, y: 136, w: 968, h: 900 }, { arcH: 330, kpiSize: 170, titleW: 640 })
  drawSleepStats(p, { x: 56, y: 1060, w: 968, h: 250 })
  drawChecksCard(p, { x: 56, y: 1334, w: 968, h: checksCardHeight(p, 968, 180) })
  drawPetNote(p, { x: 56, y: 1538, w: 968, h: 178 }, { anchor: 'bottom' })
}

export const sleepScene: PosterScene = { landscape, portrait }
