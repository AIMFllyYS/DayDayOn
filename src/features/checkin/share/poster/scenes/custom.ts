import { checksCardHeight, drawChecksCard, drawKpi, drawPetNote, drawTitleBlock } from '../blocks'
import {
  dashedLine,
  drawCard,
  drawParagraph,
  drawSparkle,
  drawStamp,
  drawText,
  font,
  setShadow,
} from '../draw'
import type { CustomPosterModel } from '../model'
import { alpha } from '../palette'
import type { Painter, PosterScene, Rect } from '../types'

/*
 * 自定义 ·「小目标票根」：今天的记录印在一张打了齿孔的入场券上，左边票根写着坚持到第几天；
 * 旁边是一张集章卡，周期里的每一天一个圈，达标一天盖一枚章。
 */

function sceneOf(p: Painter): CustomPosterModel {
  if (p.model.scene.module !== 'custom') throw new Error('custom scene 需要自定义模型')
  return p.model.scene
}

function drawTicket(p: Painter, r: Rect, stubW: number) {
  const { ctx, palette, accent, input, model } = p
  const s = sceneOf(p)
  const nx = r.x + stubW
  const rad = 30
  const notch = 24
  const path = () => {
    ctx.beginPath()
    ctx.moveTo(r.x + rad, r.y)
    ctx.lineTo(nx - notch, r.y)
    ctx.arc(nx, r.y, notch, Math.PI, 0, true)
    ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad)
    ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad)
    ctx.lineTo(nx + notch, r.y + r.h)
    ctx.arc(nx, r.y + r.h, notch, 0, Math.PI, true)
    ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad)
    ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad)
    ctx.closePath()
  }
  ctx.save()
  setShadow(ctx, 'float')
  path()
  ctx.fillStyle = accent.soft
  ctx.fill()
  ctx.restore()
  path()
  ctx.strokeStyle = accent.base
  ctx.lineWidth = 3
  ctx.stroke()
  dashedLine(ctx, nx, r.y + notch + 14, nx, r.y + r.h - notch - 14, accent.base, 4, [2, 14])

  // 票根：坚持到第几天
  const sc = r.x + stubW / 2
  drawText(ctx, 'DAY', sc, r.y + r.h / 2 - 104, {
    font: font(p, 700, 28, 'display'),
    color: alpha(accent.ink, 0.7),
    align: 'center',
  })
  drawText(ctx, `${input.period.done}`, sc, r.y + r.h / 2 + 44, {
    font: font(p, 700, input.period.done > 99 ? 92 : 120, 'display'),
    color: accent.ink,
    align: 'center',
    baseline: 'alphabetic',
  })
  drawText(ctx, `共 ${input.period.total} 天`, sc, r.y + r.h / 2 + 66, {
    font: font(p, 600, 22),
    color: alpha(accent.ink, 0.8),
    align: 'center',
  })

  // 正券：今天的记录
  const x0 = nx + 48
  const right = r.x + r.w - 44
  const w = right - x0
  drawText(ctx, '今日记录', x0, r.y + 34, { font: font(p, 700, 24), color: accent.ink })
  drawText(ctx, `ADMIT ONE · ${model.dateText}`, right, r.y + 38, {
    font: font(p, 600, 19, 'display'),
    color: alpha(accent.ink, 0.65),
    align: 'right',
  })
  const top = r.y + 92
  const commentH = s.comment ? 46 : 0
  const availH = r.y + r.h - 30 - commentH - top
  if (s.entries.length === 0) {
    drawParagraph(ctx, s.comment ?? '今天的小目标，认真完成了。', x0, top + 8, w, 44, 3, {
      font: font(p, 600, 30),
      color: palette.foreground,
    })
    return
  }
  const cols = w > 600 && s.entries.length > 2 ? 2 : 1
  const rowH = 66
  const rows = Math.max(1, Math.min(Math.ceil(s.entries.length / cols), Math.floor(availH / rowH)))
  const cap = cols * rows
  const colGap = 36
  const cw = (w - colGap * (cols - 1)) / cols
  s.entries.slice(0, cap).forEach((e, i) => {
    const ex = x0 + (i % cols) * (cw + colGap)
    const ey = top + Math.floor(i / cols) * rowH
    const folded = i === cap - 1 && s.entries.length > cap
    drawText(ctx, folded ? '更多记录' : e.label, ex, ey, {
      font: font(p, 600, 20),
      color: alpha(accent.ink, 0.75),
      maxWidth: cw,
    })
    drawText(ctx, folded ? `… 共 ${s.entries.length} 项` : e.value, ex, ey + 25, {
      font: font(p, 700, 29),
      color: palette.foreground,
      maxWidth: cw,
    })
    dashedLine(ctx, ex, ey + rowH - 4, ex + cw, ey + rowH - 4, alpha(accent.base, 0.8), 2, [2, 8])
  })
  if (s.comment && top + rows * rowH + 40 <= r.y + r.h - 20) {
    drawText(ctx, `备注：${s.comment}`, x0, top + rows * rowH + 12, {
      font: font(p, 500, 21),
      color: palette.muted,
      maxWidth: w,
    })
  }
}

/** 集章卡：周期里每天一个圈，已达标的盖章，今天这枚带星光 */
function drawStampCard(p: Painter, r: Rect) {
  const { ctx, palette, accent, input } = p
  const { done, total } = input.period
  drawCard(ctx, r, { fill: palette.surface, radius: 30, stroke: palette.border, shadow: 'card' })
  const pad = 30
  drawText(ctx, '集章卡', r.x + pad, r.y + pad - 2, {
    font: font(p, 700, 24),
    color: palette.foreground,
  })
  const top = r.y + pad + 52
  const gridW = r.w - pad * 2
  const gridH = r.y + r.h - pad - top
  const count = Math.max(1, total)
  // 先找能把整个周期排进去、且圆圈最大的列数；圈太小就改成只展示一段
  let cols = 1
  let cell = 0
  for (let c = 3; c <= 14; c++) {
    const size = Math.min(gridW / c, gridH / Math.ceil(count / c), 116)
    if (size > cell) {
      cell = size
      cols = c
    }
  }
  if (cell < 58) {
    cell = 66
    cols = Math.floor(gridW / cell)
  }
  const rows = Math.max(1, Math.min(Math.ceil(count / cols), Math.floor(gridH / cell)))
  const cap = cols * rows
  // 周期太长时只展示包含「今天」的一段
  const start = count <= cap ? 0 : Math.max(0, Math.min(count - cap, done - Math.ceil(cap * 0.7)))
  const shown = Math.min(cap, count - start)
  drawText(
    ctx,
    start > 0 || shown < count
      ? `第 ${start + 1}–${start + shown} 天 · 已盖 ${done} 枚`
      : `已盖 ${done}/${total} 枚`,
    r.x + r.w - pad,
    r.y + pad + 2,
    { font: font(p, 700, 21, 'display'), color: palette.muted, align: 'right' },
  )
  const offY = top + (gridH - rows * cell) / 2
  const R = cell * 0.38
  for (let i = 0; i < shown; i++) {
    const day = start + i
    const cx = r.x + pad + (gridW - cols * cell) / 2 + (i % cols) * cell + cell / 2
    const cy = offY + Math.floor(i / cols) * cell + cell / 2
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    if (day < done) {
      const today = day === done - 1
      ctx.fillStyle = today ? accent.ink : accent.base
      ctx.fill()
      ctx.strokeStyle = today ? palette.surface : accent.ink
      ctx.lineWidth = R * 0.16
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(cx - R * 0.4, cy + R * 0.04)
      ctx.lineTo(cx - R * 0.1, cy + R * 0.34)
      ctx.lineTo(cx + R * 0.44, cy - R * 0.28)
      ctx.stroke()
      if (today) drawSparkle(ctx, cx + R * 0.9, cy - R * 0.9, R * 0.42, accent.base)
    } else {
      ctx.setLineDash([5, 6])
      ctx.strokeStyle = palette.borderStrong
      ctx.lineWidth = 2
      ctx.stroke()
      drawText(ctx, `${day + 1}`, cx, cy + 1, {
        font: font(p, 600, Math.max(15, Math.round(R * 0.62)), 'display'),
        color: palette.subtle,
        align: 'center',
        baseline: 'middle',
      })
    }
    ctx.restore()
  }
}

function landscape(p: Painter) {
  const { palette, model } = p
  drawTitleBlock(p, 64, 132, 760)
  drawTicket(p, { x: 64, y: 296, w: 1166, h: 370 }, 250)
  const ch = checksCardHeight(p, 571, 234)
  drawChecksCard(p, { x: 64, y: 928 - ch, w: 571, h: ch })
  drawPetNote(p, { x: 659, y: 694, w: 571, h: 234 }, { anchor: 'bottom' })

  drawKpi(p, 1290, 118, { size: 150, maxWidth: 380 })
  drawStamp(p, 1764, 218, 84, palette.tones[model.status.tone].ink, 12)
  drawStampCard(p, { x: 1282, y: 350, w: 574, h: 578 })
}

function portrait(p: Painter) {
  const { palette, model } = p
  const bottom = drawTitleBlock(p, 56, 150, 700)
  drawKpi(p, 56, bottom + 8, { size: 150, maxWidth: 700 })
  drawStamp(p, 900, 380, 98, palette.tones[model.status.tone].ink)
  drawTicket(p, { x: 56, y: 556, w: 968, h: 400 }, 230)
  drawStampCard(p, { x: 56, y: 984, w: 968, h: 300 })
  drawChecksCard(p, { x: 56, y: 1308, w: 968, h: checksCardHeight(p, 968, 180) })
  drawPetNote(p, { x: 56, y: 1512, w: 968, h: 204 }, { anchor: 'bottom' })
}

export const customScene: PosterScene = { landscape, portrait }
