import { drawPetNote, drawTitleBlock } from '../blocks'
import {
  drawCard,
  drawParagraph,
  drawStamp,
  drawTape,
  drawText,
  font,
  roundRectPath,
  withRotation,
} from '../draw'
import { alpha } from '../palette'
import type { Painter, PosterScene, Rect } from '../types'

/*
 * 跳过本次打卡 ·「请假条」：理由核验通过时，所有板块共用一张盖了「已准假」章的请假条，
 * 事由是用户写的理由，批复是裁判的核验结论。
 */

function drawLeaveSlip(p: Painter, r: Rect, deg: number) {
  const { ctx, palette, accent, model, input } = p
  const cx = r.x + r.w / 2
  withRotation(ctx, cx, r.y + r.h / 2, deg, () => {
    drawCard(ctx, r, { fill: palette.surface, radius: 16, shadow: 'float' })
    roundRectPath(ctx, r.x + 18, r.y + 18, r.w - 36, r.h - 36, 10)
    ctx.strokeStyle = alpha(accent.base, 0.8)
    ctx.lineWidth = 2.5
    ctx.stroke()

    const pad = 64
    const x0 = r.x + pad
    const w = r.w - pad * 2
    drawText(ctx, '请 假 条', cx, r.y + 70, {
      font: font(p, 700, 56),
      color: palette.foreground,
      align: 'center',
    })
    drawText(ctx, `${model.title} · ${model.dateText}`, cx, r.y + 150, {
      font: font(p, 600, 22),
      color: palette.muted,
      align: 'center',
      maxWidth: w,
    })

    const bodyTop = r.y + 220
    const bodyH = r.y + r.h - 150 - bodyTop
    const half = bodyH / 2
    const sections: [string, string, number][] = [
      ['事由', model.skipReason || '今天需要休息一下', 34],
      ['批复', model.detail, 28],
    ]
    sections.forEach(([label, text, size], i) => {
      const sy = bodyTop + i * half
      drawText(ctx, label, x0, sy, { font: font(p, 700, 24), color: accent.ink })
      const lineH = Math.round(size * 1.5)
      const maxLines = Math.max(1, Math.floor((half - 60) / lineH))
      drawParagraph(ctx, text, x0, sy + 46, w, lineH, Math.min(4, maxLines), {
        font: font(p, 600, size),
        color: palette.foreground,
      })
    })

    drawText(ctx, `批假人：${input.pet.name}`, x0, r.y + r.h - 104, {
      font: font(p, 600, 24),
      color: palette.muted,
    })
    drawStamp(p, r.x + r.w - 170, r.y + r.h - 150, 100, palette.tones[model.status.tone].ink)
  })
  withRotation(ctx, cx, r.y + r.h / 2, deg, () => {
    drawTape(ctx, cx, r.y + 2, 190, -3, accent.base)
  })
}

function landscape(p: Painter) {
  const { ctx, palette } = p
  const bottom = drawTitleBlock(p, 64, 132, 640)
  drawParagraph(
    ctx,
    '休息也是坚持的一部分。今天的打卡已经豁免，连击不会断。',
    64,
    bottom + 24,
    620,
    46,
    3,
    {
      font: font(p, 600, 31),
      color: palette.muted,
    },
  )
  drawPetNote(
    p,
    { x: 64, y: 600, w: 640, h: 328 },
    { text: p.model.advice ?? '好好休息，准备好了再继续。', advice: null },
  )
  drawLeaveSlip(p, { x: 800, y: 142, w: 1010, h: 764 }, 1.2)
}

function portrait(p: Painter) {
  const { ctx, palette } = p
  const bottom = drawTitleBlock(p, 56, 150, 968)
  drawParagraph(
    ctx,
    '休息也是坚持的一部分。今天的打卡已经豁免，连击不会断。',
    56,
    bottom + 16,
    968,
    46,
    2,
    {
      font: font(p, 600, 30),
      color: palette.muted,
    },
  )
  drawLeaveSlip(p, { x: 82, y: 440, w: 916, h: 900 }, -1.2)
  drawPetNote(
    p,
    { x: 56, y: 1400, w: 968, h: 316 },
    { text: p.model.advice ?? '好好休息，准备好了再继续。', advice: null },
  )
}

export const skipScene: PosterScene = { landscape, portrait }
