import {
  dashedLine,
  drawCard,
  drawCheckBadge,
  drawMascot,
  drawParagraph,
  drawPill,
  drawQrCode,
  drawText,
  font,
  measure,
  roundRectPath,
  wrapLines,
} from './draw'
import type { Check } from '@/features/referee/schemas'
import { alpha } from './palette'
import type { Painter, Rect } from './types'

/*
 * 各板块共用的版块：手账底纸、品牌眉栏、标题组、主数字、宠物评语气泡、裁判核验、扫码页脚。
 * 版块只管「在给定矩形里画好自己」，摆在哪由 scenes/<module>.ts 决定。
 */

export const PROMO_HOST = 'daydayon.husteread.com'

/** 页边距 */
export function margin(p: Painter): number {
  return p.portrait ? 56 : 64
}

/** 眉栏与页脚之间留给场景的内容区 */
export function contentRect(p: Painter): Rect {
  const m = margin(p)
  return p.portrait
    ? { x: m, y: 136, w: p.W - m * 2, h: 1716 - 136 }
    : { x: m, y: 120, w: p.W - m * 2, h: 928 - 120 }
}

/** 奶油点阵纸 + 板块色水彩晕染 + 装裱细框 */
export function drawBackdrop(p: Painter) {
  const { ctx, W, H, palette, accent } = p
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, W, H)

  const blobs: [number, number, number, string, number][] = [
    [0.08, 0.1, 0.46, accent.base, 0.2],
    [0.94, 0.9, 0.4, palette.primary.base, 0.1],
    [0.9, 0.06, 0.26, accent.base, 0.1],
  ]
  for (const [fx, fy, fr, color, a] of blobs) {
    const g = ctx.createRadialGradient(W * fx, H * fy, 10, W * fx, H * fy, Math.max(W, H) * fr)
    g.addColorStop(0, alpha(color, a))
    g.addColorStop(1, alpha(color, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  ctx.fillStyle = 'rgba(74, 63, 53, 0.085)'
  for (let py = 26; py < H - 16; py += 30) {
    for (let px = 26; px < W - 16; px += 30) {
      ctx.beginPath()
      ctx.arc(px, py, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  roundRectPath(ctx, 20, 20, W - 40, H - 40, 34)
  ctx.strokeStyle = palette.border
  ctx.lineWidth = 2
  ctx.stroke()
}

/** 品牌眉栏：左 Logo + DayDayOn，右 日期 + DAY 进度 */
export function drawBrandBar(p: Painter) {
  const { ctx, palette, model } = p
  const m = margin(p)
  const cy = p.portrait ? 84 : 72
  const logo = p.portrait ? 52 : 48
  if (p.logoImg) ctx.drawImage(p.logoImg, m, cy - logo / 2, logo, logo)
  drawText(ctx, 'DayDayOn', m + logo + 14, cy + 1, {
    font: font(p, 700, p.portrait ? 32 : 30, 'display'),
    color: palette.foreground,
    baseline: 'middle',
  })
  const pillH = p.portrait ? 44 : 40
  const pillW = drawPill(ctx, p.W - m, cy - pillH / 2, model.dayText, {
    bg: palette.primary.soft,
    fg: palette.primary.ink,
    font: font(p, 700, p.portrait ? 22 : 20, 'display'),
    height: pillH,
    align: 'right',
  })
  drawText(ctx, model.dateText, p.W - m - pillW - 18, cy + 1, {
    font: font(p, 600, p.portrait ? 22 : 20, 'display'),
    color: palette.muted,
    align: 'right',
    baseline: 'middle',
  })
}

/** 标题组：板块徽章 + 状态徽章一行，目标标题一行。返回底边 y */
export function drawTitleBlock(
  p: Painter,
  x: number,
  y: number,
  maxWidth: number,
  o: { onDark?: boolean; titleSize?: number } = {},
): number {
  const { ctx, palette, accent, model } = p
  const size = o.titleSize ?? (p.portrait ? 60 : 54)
  const statusTone = palette.tones[model.status.tone]
  const pillFont = font(p, 700, 21)
  const w1 = drawPill(ctx, x, y, model.moduleBadge, {
    bg: o.onDark ? alpha(palette.surface, 0.16) : accent.soft,
    fg: o.onDark ? palette.surface : accent.ink,
    font: pillFont,
    height: 42,
  })
  if (w1 + 12 + measure(ctx, model.status.badge, pillFont) + 36 <= maxWidth) {
    drawPill(ctx, x + w1 + 12, y, model.status.badge, {
      bg: o.onDark ? alpha(palette.surface, 0.16) : statusTone.soft,
      fg: o.onDark ? palette.surface : statusTone.ink,
      font: pillFont,
      height: 42,
    })
  }
  drawText(ctx, model.title, x, y + 60, {
    font: font(p, 700, size),
    color: o.onDark ? palette.surface : palette.foreground,
    maxWidth,
  })
  return y + 60 + Math.round(size * 1.25)
}

/** 主数字：超大 Fredoka 数值 + 单位 + 一行说明。返回底边 y */
export function drawKpi(
  p: Painter,
  x: number,
  y: number,
  o: {
    size: number
    onDark?: boolean
    align?: 'left' | 'center'
    sub?: boolean
    maxWidth?: number
  },
): number {
  const { ctx, palette, accent, model } = p
  const valueFont = font(p, 700, o.size, 'display')
  const unitFont = font(p, 700, Math.round(o.size * 0.26))
  const vw = measure(ctx, model.kpi.value, valueFont)
  const uw = measure(ctx, model.kpi.unit, unitFont)
  const gap = Math.round(o.size * 0.1)
  const left = o.align === 'center' ? x - (vw + gap + uw) / 2 : x
  const baseY = y + Math.round(o.size * 0.86)
  drawText(ctx, model.kpi.value, left, baseY, {
    font: valueFont,
    color: o.onDark ? palette.surface : accent.ink,
    baseline: 'alphabetic',
  })
  drawText(ctx, model.kpi.unit, left + vw + gap, baseY, {
    font: unitFont,
    color: o.onDark ? alpha(palette.surface, 0.78) : palette.muted,
    baseline: 'alphabetic',
  })
  if (o.sub === false) return baseY + Math.round(o.size * 0.12)
  const subSize = Math.max(22, Math.round(o.size * 0.19))
  drawText(ctx, model.kpi.sub, o.align === 'center' ? x : left, baseY + Math.round(o.size * 0.2), {
    font: font(p, 600, subSize),
    color: o.onDark ? alpha(palette.surface, 0.86) : palette.foreground,
    align: o.align === 'center' ? 'center' : 'left',
    maxWidth: o.maxWidth,
  })
  return baseY + Math.round(o.size * 0.2) + Math.round(subSize * 1.4)
}

/**
 * 宠物 + 评语气泡：气泡里是裁判评语与一条小建议，高度跟着文字走，不留大片空白。
 * 宽矩形里宠物站在左、气泡在右；窄矩形（竖版半栏）里气泡在上、宠物在下方探头。
 */
export function drawPetNote(
  p: Painter,
  r: Rect,
  o: { text?: string; advice?: string | null; anchor?: 'top' | 'bottom' } = {},
) {
  const { ctx, palette, model, input } = p
  const text = o.text ?? model.detail
  const advice = o.advice === undefined ? model.advice : o.advice
  const hasPet = p.mascotImg !== null
  const stacked = hasPet && r.w < 540
  const petSize = !hasPet
    ? 0
    : stacked
      ? Math.min(150, Math.round(r.h * 0.4))
      : Math.min(176, Math.round(r.h * 0.8), Math.round(r.w * 0.3))
  const petBelow = stacked ? Math.round(petSize * 0.78) : 0
  const bubbleX = hasPet && !stacked ? r.x + petSize + 22 : r.x
  const bubbleW = r.x + r.w - bubbleX
  const maxH = r.h - petBelow

  const pad = 28
  const tw = bubbleW - pad * 2
  const headH = 36
  const lineH = 36
  const advLineH = 31
  const bodyMax = maxH - pad * 2 - headH
  const wantAdvice = advice !== null && bodyMax >= lineH * 2 + 24 + advLineH
  ctx.save()
  ctx.font = font(p, 600, 25)
  const detailLines = wrapLines(
    ctx,
    text,
    tw,
    Math.max(1, Math.min(5, Math.floor((bodyMax - (wantAdvice ? 24 + advLineH : 0)) / lineH))),
  )
  ctx.font = font(p, 500, 21)
  const advLines =
    wantAdvice && advice !== null
      ? wrapLines(
          ctx,
          `小建议：${advice}`,
          tw,
          Math.max(
            1,
            Math.min(3, Math.floor((bodyMax - detailLines.length * lineH - 24) / advLineH)),
          ),
        )
      : []
  ctx.restore()
  const needH =
    pad * 2 +
    headH +
    detailLines.length * lineH +
    (advLines.length ? 22 + advLines.length * advLineH : 0)
  const bubbleH = Math.min(maxH, Math.max(needH, stacked ? 0 : Math.min(maxH, petSize * 0.86)))
  const blockH = stacked ? bubbleH + petBelow : Math.max(bubbleH, petSize)
  const top = o.anchor === 'bottom' ? r.y + r.h - blockH : r.y
  const bubble: Rect = { x: bubbleX, y: top, w: bubbleW, h: bubbleH }

  drawCard(ctx, bubble, {
    fill: palette.surface,
    stroke: palette.borderStrong,
    radius: 30,
    shadow: 'card',
  })
  if (hasPet) {
    const petY = top + blockH - petSize
    // 气泡尾巴：先用底色盖住边线，再描两条斜边
    const midY = Math.min(bubble.y + bubble.h - 46, Math.max(bubble.y + 46, petY + petSize * 0.4))
    const tail: [number, number][] = stacked
      ? [
          [r.x + petSize * 0.62, bubble.y + bubble.h],
          [r.x + petSize * 0.8, bubble.y + bubble.h + 22],
          [r.x + petSize * 0.62 + 36, bubble.y + bubble.h],
        ]
      : [
          [bubble.x, midY - 17],
          [bubble.x - 22, midY + 3],
          [bubble.x, midY + 17],
        ]
    const inset = stacked ? [0, -3] : [3, 0]
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(tail[0]![0] + inset[0]!, tail[0]![1] + inset[1]!)
    ctx.lineTo(tail[1]![0], tail[1]![1])
    ctx.lineTo(tail[2]![0] + inset[0]!, tail[2]![1] + inset[1]!)
    ctx.closePath()
    ctx.fillStyle = palette.surface
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(tail[0]![0], tail[0]![1])
    ctx.lineTo(tail[1]![0], tail[1]![1])
    ctx.lineTo(tail[2]![0], tail[2]![1])
    ctx.strokeStyle = palette.borderStrong
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.stroke()
    ctx.restore()
    drawMascot(p, r.x, petY, petSize)
  }

  const tx = bubble.x + pad
  drawText(ctx, `${input.pet.name}说`, tx, bubble.y + pad - 4, {
    font: font(p, 700, 22),
    color: palette.primary.ink,
  })
  const bodyTop = bubble.y + pad + headH
  detailLines.forEach((line, i) =>
    drawText(ctx, line, tx, bodyTop + i * lineH, {
      font: font(p, 600, 25),
      color: palette.foreground,
    }),
  )
  if (advLines.length === 0) return
  const advY = bodyTop + detailLines.length * lineH + 10
  dashedLine(ctx, tx, advY, bubble.x + bubble.w - pad, advY, palette.borderStrong)
  advLines.forEach((line, i) =>
    drawText(ctx, line, tx, advY + 12 + i * advLineH, {
      font: font(p, 500, 21),
      color: palette.muted,
    }),
  )
}

/**
 * 逐条核验行（不带卡片底）：能放几条放几条，放不下的折叠成「还有 N 项」。返回画到的底边 y。
 * 卡片版与笔记本「批注」共用。
 */
export function drawCheckRows(
  p: Painter,
  checks: readonly Check[],
  x: number,
  y: number,
  w: number,
  maxH: number,
  o: { size?: number } = {},
): number {
  const { ctx, palette } = p
  const size = o.size ?? 23
  const lineH = Math.round(size * 1.4)
  const gap = 14
  const badgeR = Math.round(size * 0.62)
  const textX = x + badgeR * 2 + 14
  ctx.save()
  ctx.font = font(p, 600, size)
  const wrapped = checks.map((c) => wrapLines(ctx, c.text, w - badgeR * 2 - 14, 2))
  ctx.restore()

  // 贪心：前 k 条的高度 +（有折叠时）一行提示 ≤ maxH
  let fit = 0
  let used = 0
  for (let i = 0; i < wrapped.length; i++) {
    const h = wrapped[i]!.length * lineH + gap
    const tail = i < wrapped.length - 1 ? lineH : -gap
    if (used + h + tail > maxH) break
    used += h
    fit = i + 1
  }
  let cy = y
  for (let i = 0; i < fit; i++) {
    const c = checks[i]!
    drawCheckBadge(
      ctx,
      x + badgeR,
      cy + lineH / 2,
      badgeR,
      c.ok,
      c.ok ? palette.tones.success : palette.tones.warning,
    )
    wrapped[i]!.forEach((line, li) =>
      drawText(ctx, line, textX, cy + li * lineH, {
        font: font(p, 600, size),
        color: palette.foreground,
      }),
    )
    cy += wrapped[i]!.length * lineH + gap
  }
  if (fit < checks.length) {
    drawText(ctx, `… 还有 ${checks.length - fit} 项核验`, textX, cy, {
      font: font(p, 600, size - 2),
      color: palette.muted,
    })
    cy += lineH
  }
  return cy
}

/**
 * 估算核验卡实际需要的高度（不超过 allotted）：核验项少时把卡片收紧，
 * 由场景决定省下的空间留在卡片上方还是下方，而不是让一大块空白留在卡片里。
 */
export function checksCardHeight(p: Painter, w: number, allotted: number): number {
  const { ctx, model } = p
  const pad = 28
  const size = 23
  const lineH = Math.round(size * 1.4)
  const gap = 14
  const badgeR = Math.round(size * 0.62)
  if (model.checks.length === 0) {
    ctx.save()
    ctx.font = font(p, 500, 22)
    const lines = wrapLines(ctx, '今天没有需要核验的条件，记下来就很棒。', w - pad * 2, 3)
    ctx.restore()
    return Math.min(allotted, pad * 2 + 46 + lines.length * 32)
  }
  const twoCol = w > 800 && model.checks.length > 1
  const cw = twoCol ? (w - pad * 2 - 36) / 2 : w - pad * 2
  ctx.save()
  ctx.font = font(p, 600, size)
  const wrapped = model.checks.map((c) => wrapLines(ctx, c.text, cw - badgeR * 2 - 14, 2))
  ctx.restore()
  const colH = (rows: string[][]) => rows.reduce((s, ws) => s + ws.length * lineH + gap, -gap)
  const half = Math.ceil(wrapped.length / 2)
  const bodyH = twoCol
    ? Math.max(colH(wrapped.slice(0, half)), colH(wrapped.slice(half)))
    : colH(wrapped)
  return Math.min(allotted, pad * 2 + 46 + bodyH)
}

/** 裁判核验卡：够宽时分两栏 */
export function drawChecksCard(p: Painter, r: Rect, o: { title?: string } = {}) {
  const { ctx, palette, model } = p
  drawCard(ctx, r, { fill: palette.surface, stroke: palette.border, radius: 30, shadow: 'card' })
  const pad = 28
  const ok = model.checks.filter((c) => c.ok).length
  drawText(ctx, o.title ?? '裁判核验', r.x + pad, r.y + pad - 2, {
    font: font(p, 700, 24),
    color: palette.foreground,
  })
  if (model.checks.length > 0) {
    drawText(ctx, `${ok}/${model.checks.length} 通过`, r.x + r.w - pad, r.y + pad, {
      font: font(p, 700, 21, 'display'),
      color: palette.muted,
      align: 'right',
    })
  }
  const top = r.y + pad + 46
  const maxH = r.y + r.h - pad - top + 6
  if (model.checks.length === 0) {
    drawParagraph(
      ctx,
      '今天没有需要核验的条件，记下来就很棒。',
      r.x + pad,
      top,
      r.w - pad * 2,
      32,
      3,
      {
        font: font(p, 500, 22),
        color: palette.muted,
      },
    )
    return
  }
  if (r.w > 800 && model.checks.length > 1) {
    const half = Math.ceil(model.checks.length / 2)
    const cw = (r.w - pad * 2 - 36) / 2
    drawCheckRows(p, model.checks.slice(0, half), r.x + pad, top, cw, maxH)
    drawCheckRows(p, model.checks.slice(half), r.x + pad + cw + 36, top, cw, maxH)
    return
  }
  drawCheckRows(p, model.checks, r.x + pad, top, r.w - pad * 2, maxH)
}

/** 页脚：一句手账签名 + 可扫码的推广二维码 */
export function drawFooter(p: Painter) {
  const { ctx, palette, input } = p
  const m = margin(p)
  const top = p.portrait ? 1740 : 948
  const qr = p.portrait ? 124 : 92
  const qrX = p.W - m - qr
  const qrY = p.portrait ? top + 10 : top + 6
  dashedLine(ctx, m, top - 6, p.W - m, top - 6, palette.borderStrong, 2, [2, 10])
  drawQrCode(ctx, p.promoUrl, qrX, qrY, qr, palette.foreground)

  const textW = qrX - m - 28
  if (p.portrait) {
    drawText(ctx, `和「${input.pet.name}」一起，把坚持写成手账`, m, top + 18, {
      font: font(p, 700, 30),
      color: palette.foreground,
      maxWidth: textW,
    })
    drawText(ctx, '扫码加入 DayDayOn，和朋友一起打卡', m, top + 66, {
      font: font(p, 600, 23),
      color: palette.primary.ink,
      maxWidth: textW,
    })
    drawText(ctx, `${PROMO_HOST} · 估算结果仅供参考，非医疗建议`, m, top + 106, {
      font: font(p, 500, 19),
      color: palette.muted,
      maxWidth: textW,
    })
    return
  }
  drawText(ctx, `和「${input.pet.name}」一起，把每天的坚持写成一本治愈手账`, m, top + 14, {
    font: font(p, 700, 26),
    color: palette.foreground,
    maxWidth: textW - 320,
  })
  drawText(ctx, 'DayDayOn · 和朋友一起打卡 · 估算结果仅供参考，非医疗建议', m, top + 56, {
    font: font(p, 500, 19),
    color: palette.muted,
    maxWidth: textW - 320,
  })
  drawText(ctx, '扫码一起打卡', qrX - 22, top + 16, {
    font: font(p, 700, 24),
    color: palette.primary.ink,
    align: 'right',
  })
  drawText(ctx, PROMO_HOST, qrX - 22, top + 56, {
    font: font(p, 600, 19, 'display'),
    color: palette.muted,
    align: 'right',
  })
}
