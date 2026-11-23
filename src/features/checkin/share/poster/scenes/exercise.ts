import { checksCardHeight, drawChecksCard, drawPetNote, drawTitleBlock } from '../blocks'
import {
  dashedLine,
  drawCard,
  drawCheckBadge,
  drawStamp,
  drawText,
  font,
  measure,
  roundRectPath,
  truncateText,
  withRotation,
} from '../draw'
import type { ExercisePosterModel } from '../model'
import { trimNumber } from '../model'
import { alpha } from '../palette'
import type { Painter, PosterScene, Rect } from '../types'

/*
 * 运动 ·「运动战报」：一块别着安全别针的比赛号码布（号码 = 今日消耗），
 * 旁边是一条俯视跑道——每项运动占一条赛道，跑得越久冲得越远，达标的赛道涂满板块色。
 */

const MAX_LANES = 5

function sceneOf(p: Painter): ExercisePosterModel {
  if (p.model.scene.module !== 'exercise') throw new Error('exercise scene 需要运动模型')
  return p.model.scene
}

function drawBib(p: Painter, r: Rect, deg: number) {
  const { ctx, palette, accent, model } = p
  const s = sceneOf(p)
  withRotation(ctx, r.x + r.w / 2, r.y + r.h / 2, deg, () => {
    drawCard(ctx, r, { fill: palette.surface, radius: 22, shadow: 'float' })
    // 顶部色带
    const bandH = Math.round(r.h * 0.2)
    ctx.save()
    roundRectPath(ctx, r.x, r.y, r.w, r.h, 22)
    ctx.clip()
    ctx.fillStyle = accent.ink
    ctx.fillRect(r.x, r.y, r.w, bandH)
    ctx.restore()
    roundRectPath(ctx, r.x, r.y, r.w, r.h, 22)
    ctx.strokeStyle = alpha(accent.ink, 0.5)
    ctx.lineWidth = 2.5
    ctx.stroke()

    drawText(ctx, 'DAYDAYON RUN CLUB', r.x + 76, r.y + bandH / 2 + 1, {
      font: font(p, 700, Math.round(bandH * 0.34), 'display'),
      color: palette.surface,
      baseline: 'middle',
    })
    drawText(ctx, model.dayText, r.x + r.w - 76, r.y + bandH / 2 + 1, {
      font: font(p, 700, Math.round(bandH * 0.34), 'display'),
      color: alpha(palette.surface, 0.85),
      align: 'right',
      baseline: 'middle',
    })

    // 号码 = 今日消耗
    const statH = Math.round(r.h * 0.26)
    const numSize = Math.round((r.h - bandH - statH) * 0.86)
    const numFont = font(p, 700, numSize, 'display')
    const unitFont = font(p, 700, Math.round(numSize * 0.2), 'display')
    const nw = measure(ctx, model.kpi.value, numFont)
    const uw = measure(ctx, 'KCAL', unitFont)
    const nx = r.x + (r.w - nw - uw - 16) / 2
    const baseY = r.y + bandH + (r.h - bandH - statH) / 2 + numSize * 0.36
    drawText(ctx, model.kpi.value, nx, baseY, {
      font: numFont,
      color: palette.foreground,
      baseline: 'alphabetic',
    })
    drawText(ctx, 'KCAL', nx + nw + 16, baseY, {
      font: unitFont,
      color: accent.ink,
      baseline: 'alphabetic',
    })

    // 底部三项成绩
    const sy = r.y + r.h - statH
    dashedLine(ctx, r.x + 40, sy, r.x + r.w - 40, sy, palette.borderStrong)
    // 右侧三分之一留给印章
    const stats: [string, string][] = [
      [trimNumber(s.minutes), '分钟'],
      [`${s.items.length}`, '项运动'],
    ]
    stats.forEach(([value, label], i) => {
      const cx = r.x + r.w * (0.24 + i * 0.26)
      drawText(ctx, value, cx, sy + statH * 0.14, {
        font: font(p, 700, Math.round(statH * 0.38), 'display'),
        color: accent.ink,
        align: 'center',
      })
      drawText(ctx, label, cx, sy + statH * 0.6, {
        font: font(p, 600, Math.max(19, Math.round(statH * 0.2))),
        color: palette.muted,
        align: 'center',
      })
    })

    // 四角别针孔
    for (const [hx, hy, onBand] of [
      [r.x + 34, r.y + 34, true],
      [r.x + r.w - 34, r.y + 34, true],
      [r.x + 34, r.y + r.h - 34, false],
      [r.x + r.w - 34, r.y + r.h - 34, false],
    ] as const) {
      ctx.beginPath()
      ctx.arc(hx, hy, 11, 0, Math.PI * 2)
      ctx.fillStyle = palette.background
      ctx.fill()
      ctx.strokeStyle = onBand ? alpha(palette.surface, 0.7) : palette.borderStrong
      ctx.lineWidth = 3
      ctx.stroke()
    }
  })
}

function drawTrack(p: Painter, r: Rect) {
  const { ctx, palette, accent } = p
  const s = sceneOf(p)
  drawCard(ctx, r, {
    fill: accent.soft,
    radius: 34,
    stroke: alpha(accent.base, 0.7),
    shadow: 'card',
  })

  const shownItems = s.items.slice(0, MAX_LANES)
  const hidden = s.items.length - shownItems.length
  drawText(ctx, '今日赛道', r.x + 34, r.y + 26, { font: font(p, 700, 24), color: accent.ink })
  drawText(
    ctx,
    hidden > 0 ? `共 ${s.items.length} 项 · 另有 ${hidden} 项未展示` : '跑得越久 冲得越远',
    r.x + r.w - 34,
    r.y + 30,
    { font: font(p, 600, 20), color: alpha(accent.ink, 0.75), align: 'right' },
  )

  const top = r.y + 78
  const lanes = Math.max(3, shownItems.length)
  const laneH = (r.y + r.h - 24 - top) / lanes
  const x0 = r.x + 96
  const x1 = r.x + r.w - 76
  const maxMin = Math.max(1, ...shownItems.map((it) => it.minutes))

  // 方格终点线
  const cell = Math.min(15, laneH / 4)
  ctx.save()
  ctx.beginPath()
  ctx.rect(x1, top, cell * 2, laneH * lanes)
  ctx.clip()
  for (let row = 0; row * cell < laneH * lanes; row++) {
    for (let col = 0; col < 2; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? accent.ink : palette.surface
      ctx.fillRect(x1 + col * cell, top + row * cell, cell, cell)
    }
  }
  ctx.restore()

  for (let i = 0; i < lanes; i++) {
    const ly = top + i * laneH
    ctx.fillStyle = palette.surface
    ctx.fillRect(r.x + 24, ly - 2, r.w - 48, 4)
    drawText(ctx, `${i + 1}`, r.x + 58, ly + laneH / 2 + 2, {
      font: font(p, 700, Math.min(40, Math.round(laneH * 0.46)), 'display'),
      color: alpha(accent.ink, 0.38),
      align: 'center',
      baseline: 'middle',
    })
    const it = shownItems[i]
    if (!it) continue

    const barH = Math.min(64, laneH * 0.62)
    const by = ly + (laneH - barH) / 2
    const share = (it.ok ? 0.55 : 0.45) + (it.ok ? 0.45 : 0.35) * (it.minutes / maxMin)
    const barW = (x1 - x0 - 14) * Math.min(1, share)
    roundRectPath(ctx, x0, by, barW, barH, barH / 2)
    ctx.fillStyle = it.ok ? accent.base : palette.surface
    ctx.fill()
    if (!it.ok) {
      ctx.save()
      ctx.setLineDash([8, 7])
      ctx.strokeStyle = accent.base
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.restore()
    }

    const kcalText = it.kcal === null ? '' : `${it.kcal} kcal`
    const kcalFont = font(p, 700, 22, 'display')
    const kcalW = kcalText ? measure(ctx, kcalText, kcalFont) + 26 : 0
    const nameFont = font(p, 700, Math.min(26, Math.round(barH * 0.42)))
    const metaFont = font(p, 600, Math.min(21, Math.round(barH * 0.34)))
    const inner = barW - 34 - barH - kcalW
    ctx.save()
    ctx.font = nameFont
    const name = truncateText(ctx, it.name, Math.max(60, inner * 0.55))
    const nameW = ctx.measureText(name).width
    ctx.restore()
    drawText(ctx, name, x0 + 28, by + barH / 2 + 1, {
      font: nameFont,
      color: accent.ink,
      baseline: 'middle',
    })
    const meta = [`${trimNumber(it.minutes)} 分钟`, it.detail].filter(Boolean).join(' · ')
    if (inner - nameW - 16 > 70) {
      drawText(ctx, meta, x0 + 28 + nameW + 16, by + barH / 2 + 1, {
        font: metaFont,
        color: alpha(accent.ink, 0.8),
        baseline: 'middle',
        maxWidth: inner - nameW - 16,
      })
    }
    if (kcalText) {
      drawText(ctx, kcalText, x0 + barW - barH - 8, by + barH / 2 + 1, {
        font: kcalFont,
        color: accent.ink,
        align: 'right',
        baseline: 'middle',
      })
    }
    // 赛道尽头的达标 / 记录徽标
    drawCheckBadge(
      ctx,
      x0 + barW - barH / 2,
      by + barH / 2,
      barH * 0.34,
      it.ok,
      it.ok ? { soft: palette.surface, ink: accent.ink } : palette.tones.warning,
    )
  }
}

/** 训练负荷：十格体力条 */
function drawLoadMeter(p: Painter, r: Rect) {
  const { ctx, palette, accent } = p
  const s = sceneOf(p)
  drawCard(ctx, r, { fill: palette.surface, radius: 30, stroke: palette.border, shadow: 'card' })
  const pad = 28
  const high = s.loadPct >= 70
  drawText(ctx, '训练负荷', r.x + pad, r.y + pad - 2, {
    font: font(p, 700, 24),
    color: palette.foreground,
  })
  drawText(ctx, `${s.loadPct}%`, r.x + r.w - pad, r.y + pad - 8, {
    font: font(p, 700, 34, 'display'),
    color: high ? palette.tones.warning.ink : accent.ink,
    align: 'right',
  })
  const segs = 10
  const gap = 8
  const sw = (r.w - pad * 2 - gap * (segs - 1)) / segs
  const sh = Math.min(34, r.h - pad * 2 - 86)
  const sy = r.y + pad + 50
  const filled = Math.max(s.loadPct > 0 ? 1 : 0, Math.min(segs, Math.round(s.loadPct / 10)))
  for (let i = 0; i < segs; i++) {
    roundRectPath(ctx, r.x + pad + i * (sw + gap), sy, sw, sh, 9)
    ctx.fillStyle =
      i < filled
        ? high && i >= 7
          ? palette.tones.warning.base
          : accent.base
        : palette.surfaceSunken
    ctx.fill()
  }
  drawText(
    ctx,
    s.loadPct < 30
      ? '轻松活动，身体热起来就好'
      : high
        ? '强度不低，今晚早点休息'
        : '强度适中，刚刚好的一天',
    r.x + pad,
    sy + sh + 16,
    { font: font(p, 500, 21), color: palette.muted, maxWidth: r.w - pad * 2 },
  )
}

function landscape(p: Painter) {
  const { palette, model } = p
  drawTitleBlock(p, 64, 132, 610)
  drawBib(p, { x: 76, y: 292, w: 596, h: 372 }, -2)
  drawLoadMeter(p, { x: 64, y: 744, w: 620, h: 184 })
  drawStamp(p, 584, 606, 76, palette.tones[model.status.tone].ink)

  drawTrack(p, { x: 740, y: 124, w: 1116, h: 468 })
  const ch = checksCardHeight(p, 540, 310)
  drawChecksCard(p, { x: 740, y: 928 - ch, w: 540, h: ch })
  drawPetNote(p, { x: 1304, y: 618, w: 552, h: 310 }, { anchor: 'bottom' })
}

function portrait(p: Painter) {
  const { palette, model } = p
  drawTitleBlock(p, 56, 150, 968)
  drawBib(p, { x: 82, y: 318, w: 916, h: 430 }, -1.5)
  drawStamp(p, 872, 684, 88, palette.tones[model.status.tone].ink)

  drawTrack(p, { x: 56, y: 800, w: 968, h: 420 })
  drawChecksCard(p, { x: 56, y: 1244, w: 968, h: checksCardHeight(p, 968, 230) })
  drawLoadMeter(p, { x: 56, y: 1498, w: 400, h: 218 })
  drawPetNote(p, { x: 480, y: 1498, w: 544, h: 218 }, { anchor: 'bottom' })
}

export const exerciseScene: PosterScene = { landscape, portrait }
