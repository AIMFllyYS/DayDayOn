import { drawCheckRows, drawKpi, drawPetNote, drawTitleBlock } from '../blocks'
import {
  dashedLine,
  drawCard,
  drawStamp,
  drawTape,
  drawText,
  font,
  measure,
  roundRectPath,
  truncateText,
  withRotation,
  wrapLines,
} from '../draw'
import type { StudyPosterModel } from '../model'
import { alpha } from '../palette'
import type { Painter, PosterScene, Rect } from '../types'

/*
 * 学习 ·「学习笔记」：一页用胶带贴住的活页横线纸——主题用荧光笔划过，要点一条条落在横线上，
 * 页脚是裁判的批注；旁边一排番茄钟，每 25 分钟专注攒一个番茄。
 */

function sceneOf(p: Painter): StudyPosterModel {
  if (p.model.scene.module !== 'study') throw new Error('study scene 需要学习模型')
  return p.model.scene
}

function drawNotebook(p: Painter, r: Rect, deg: number) {
  const { ctx, palette, accent, model } = p
  const s = sceneOf(p)
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  withRotation(ctx, cx, cy, deg, () => {
    drawCard(ctx, r, { fill: palette.surface, radius: 18, shadow: 'float' })

    const x0 = r.x + 112
    const right = r.x + r.w - 48
    const w = right - x0
    const gap = 56
    const firstRule = r.y + 212
    const checkCount = Math.min(3, model.checks.length)
    const notesH = checkCount > 0 ? 74 + checkCount * 52 : 30
    const notesTop = r.y + r.h - notesH - 30

    // 横线 + 页边竖线 + 活页孔
    ctx.save()
    ctx.strokeStyle = alpha(accent.base, 0.42)
    ctx.lineWidth = 2
    for (let y = firstRule; y < notesTop - 16; y += gap) {
      ctx.beginPath()
      ctx.moveTo(r.x + 72, y)
      ctx.lineTo(r.x + r.w - 28, y)
      ctx.stroke()
    }
    ctx.strokeStyle = alpha(palette.primary.base, 0.4)
    ctx.beginPath()
    ctx.moveTo(r.x + 88, r.y + 18)
    ctx.lineTo(r.x + 88, r.y + r.h - 18)
    ctx.stroke()
    const holes = Math.max(4, Math.round(r.h / 110))
    for (let i = 0; i < holes; i++) {
      ctx.beginPath()
      ctx.arc(r.x + 42, r.y + ((i + 0.5) * r.h) / holes, 13, 0, Math.PI * 2)
      ctx.fillStyle = palette.surfaceSunken
      ctx.fill()
      ctx.strokeStyle = palette.borderStrong
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.restore()

    // 页眉 + 荧光笔主题
    drawText(ctx, `学习笔记 · ${s.subjectLabel}`, x0, r.y + 40, {
      font: font(p, 700, 22),
      color: accent.ink,
      maxWidth: w - 240,
    })
    drawText(ctx, model.dateText, right, r.y + 42, {
      font: font(p, 600, 20, 'display'),
      color: palette.subtle,
      align: 'right',
    })
    const topicFont = font(p, 700, 44)
    ctx.save()
    ctx.font = topicFont
    const topic = truncateText(ctx, s.topic, w)
    const topicW = ctx.measureText(topic).width
    ctx.restore()
    roundRectPath(ctx, x0 - 8, r.y + 120, topicW + 16, 30, 8)
    ctx.fillStyle = alpha(accent.base, 0.45)
    ctx.fill()
    drawText(ctx, topic, x0, r.y + 92, { font: topicFont, color: palette.foreground })

    // 正文：每行文字都坐在横线上
    const rules: number[] = []
    for (let y = firstRule; y < notesTop - 16; y += gap) rules.push(y)
    let row = 0
    const write = (
      text: string,
      x: number,
      o: { font: string; color: string; maxWidth: number },
    ) => {
      if (row >= rules.length) return
      drawText(ctx, text, x, rules[row]! - 13, { ...o, baseline: 'alphabetic' })
      row += 1
    }
    if (s.summary) {
      ctx.save()
      ctx.font = font(p, 500, 24)
      const lines = wrapLines(ctx, s.summary, w, 2)
      ctx.restore()
      for (const line of lines) {
        write(line, x0, { font: font(p, 500, 24), color: palette.muted, maxWidth: w })
      }
    }
    if (s.points.length === 0) {
      write('今天的专注已经记下，要点留给明天的自己补充。', x0, {
        font: font(p, 500, 25),
        color: palette.muted,
        maxWidth: w,
      })
    }
    s.points.forEach((pt, i) => {
      if (row >= rules.length) return
      const remainingPoints = s.points.length - i
      const maxLines = rules.length - row >= remainingPoints * 2 ? 2 : 1
      ctx.save()
      ctx.font = font(p, 600, 27)
      const lines = wrapLines(ctx, pt, w - 56, maxLines)
      ctx.restore()
      const by = rules[row]! - 23
      ctx.beginPath()
      ctx.arc(x0 + 18, by, 18, 0, Math.PI * 2)
      ctx.fillStyle = accent.base
      ctx.fill()
      drawText(ctx, `${i + 1}`, x0 + 18, by + 1, {
        font: font(p, 700, 21, 'display'),
        color: accent.ink,
        align: 'center',
        baseline: 'middle',
      })
      for (const line of lines) {
        write(line, x0 + 56, {
          font: font(p, 600, 27),
          color: palette.foreground,
          maxWidth: w - 56,
        })
      }
    })

    // 页脚：裁判批注
    if (checkCount > 0) {
      dashedLine(ctx, x0, notesTop, right, notesTop, palette.borderStrong)
      drawText(ctx, '裁判批注', x0, notesTop + 18, {
        font: font(p, 700, 22),
        color: palette.primary.ink,
      })
      drawCheckRows(p, model.checks, x0, notesTop + 62, w - 200, notesH - 52)
    }
    drawStamp(p, right - 74, r.y + r.h - 124, 86, palette.tones[model.status.tone].ink)
  })
  withRotation(ctx, cx, cy, deg, () => {
    drawTape(ctx, r.x + 150, r.y + 4, 160, -6, accent.base)
    drawTape(ctx, r.x + r.w - 130, r.y + 2, 150, 5, palette.primary.base)
  })
}

/** 番茄钟：每个番茄 = 25 分钟，最后一个按比例填充 */
function drawTomatoes(p: Painter, x: number, y: number, size: number) {
  const { ctx, palette, accent } = p
  const s = sceneOf(p)
  const R = size / 2
  const step = size + 12
  s.tomatoes.forEach((ratio, i) => {
    const cx = x + R + i * step
    const cy = y + R + 8
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fillStyle = palette.surfaceSunken
    ctx.fill()
    if (ratio > 0) {
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio)
      ctx.closePath()
      ctx.fillStyle = accent.base
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.strokeStyle = alpha(accent.ink, 0.55)
    ctx.lineWidth = 2.5
    ctx.stroke()
    // 番茄蒂
    ctx.fillStyle = accent.ink
    for (const rot of [-0.9, 0, 0.9]) {
      ctx.beginPath()
      ctx.ellipse(
        cx + Math.sin(rot) * R * 0.2,
        cy - R + 1 - Math.cos(rot) * R * 0.02,
        R * 0.11,
        R * 0.3,
        rot,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
    ctx.restore()
  })
  const endX = x + s.tomatoes.length * step
  if (s.moreTomatoes > 0) {
    drawText(ctx, `+${s.moreTomatoes}`, endX + 4, y + R + 8, {
      font: font(p, 700, 28, 'display'),
      color: accent.ink,
      baseline: 'middle',
    })
  }
  const caption =
    s.beforeMin > 0
      ? `一个番茄 = 25 分钟 · 此前已攒 ${Math.round(s.beforeMin)} 分钟`
      : '一个番茄 = 25 分钟专注'
  drawText(ctx, caption, x, y + size + 26, { font: font(p, 500, 21), color: palette.muted })
  return measure(ctx, caption, font(p, 500, 21))
}

function landscape(p: Painter) {
  const bottom = drawTitleBlock(p, 64, 132, 640)
  const kpiBottom = drawKpi(p, 64, bottom + 16, { size: 168, maxWidth: 640 })
  drawTomatoes(p, 64, kpiBottom + 14, 60)
  drawPetNote(p, { x: 64, y: 660, w: 640, h: 268 }, { anchor: 'bottom' })
  drawNotebook(p, { x: 776, y: 134, w: 1064, h: 780 }, 0.8)
}

function portrait(p: Painter) {
  const bottom = drawTitleBlock(p, 56, 150, 968)
  drawKpi(p, 56, bottom + 10, { size: 150, maxWidth: 470 })
  drawTomatoes(p, 560, bottom + 48, 46)
  drawNotebook(p, { x: 72, y: 572, w: 936, h: 808 }, -0.8)
  drawPetNote(p, { x: 56, y: 1420, w: 968, h: 296 }, { anchor: 'bottom' })
}

export const studyScene: PosterScene = { landscape, portrait }
