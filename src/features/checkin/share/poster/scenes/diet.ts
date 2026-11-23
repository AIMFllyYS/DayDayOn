import { checksCardHeight, drawChecksCard, drawPetNote, drawTitleBlock } from '../blocks'
import {
  dashedLine,
  drawParagraph,
  drawPill,
  drawStamp,
  drawTape,
  drawText,
  font,
  hashSeed,
  measure,
  seededRandom,
  setShadow,
  withRotation,
} from '../draw'
import type { DietPosterMeal, DietPosterModel } from '../model'
import { alpha } from '../palette'
import type { Painter, PosterScene, Rect } from '../types'

/*
 * 饮食 ·「今日食单」：左边是一张小食堂的热敏小票（逐餐逐菜 + 合计 + 条形码），
 * 中间是一只餐盘——盘沿一圈按蛋白 / 碳水 / 脂肪的供能占比分段，盘心是全天总分。
 */

function sceneOf(p: Painter): DietPosterModel {
  if (p.model.scene.module !== 'diet') throw new Error('diet scene 需要饮食模型')
  return p.model.scene
}

/** 把有限的行数公平分给各餐：先保证每餐一行，再轮流加行 */
function allocateLines(meals: DietPosterMeal[], budget: number): number[] {
  const want = meals.map((m) => (m.fasting ? 1 : Math.max(1, m.lines.length)))
  const got = want.map(() => 0)
  let left = budget
  for (let round = 0; left > 0 && got.some((g, i) => g < want[i]!); round++) {
    for (let i = 0; i < meals.length && left > 0; i++) {
      if (got[i]! < want[i]!) {
        got[i]! += 1
        left -= 1
      }
    }
  }
  return got
}

function drawReceipt(p: Painter, r: Rect, deg: number, o: { reserveRight?: number } = {}) {
  const { ctx, palette, accent, model, input } = p
  const s = sceneOf(p)
  const pad = 36
  const left = r.x + pad
  const right = r.x + r.w - pad
  withRotation(ctx, r.x + r.w / 2, r.y + r.h / 2, deg, () => {
    // 纸身：上边平直，下边锯齿撕口
    ctx.save()
    setShadow(ctx, 'float')
    ctx.beginPath()
    ctx.moveTo(r.x, r.y)
    ctx.lineTo(r.x + r.w, r.y)
    ctx.lineTo(r.x + r.w, r.y + r.h - 14)
    const teeth = Math.round(r.w / 22)
    const tw = r.w / teeth
    for (let i = 0; i < teeth; i++) {
      ctx.lineTo(r.x + r.w - (i + 0.5) * tw, r.y + r.h)
      ctx.lineTo(r.x + r.w - (i + 1) * tw, r.y + r.h - 14)
    }
    ctx.closePath()
    ctx.fillStyle = palette.surface
    ctx.fill()
    ctx.restore()

    drawText(ctx, '今日食单', r.x + r.w / 2, r.y + 44, {
      font: font(p, 700, 38),
      color: palette.foreground,
      align: 'center',
    })
    drawText(ctx, `DayDayOn 小食堂 · ${model.dateText}`, r.x + r.w / 2, r.y + 98, {
      font: font(p, 600, 19, 'display'),
      color: palette.muted,
      align: 'center',
    })
    dashedLine(ctx, left, r.y + 134, right, r.y + 134, palette.borderStrong)

    // 逐餐逐菜：放得下就一菜一行带热量，放不下就把菜名连成一段
    const footH = 214
    const headH = 44
    const lineH = 34
    const gap = 12
    const top = r.y + 152
    // 未记的餐次各占一块「餐名 + 一条空行」的占位高度
    const avail = r.y + r.h - footH - top - s.missingMeals.length * (headH + lineH + gap)
    const budget = Math.max(
      s.meals.length,
      Math.floor((avail - s.meals.length * (headH + gap)) / lineH),
    )
    const alloc = allocateLines(s.meals, budget)
    const nameFont = font(p, 500, 21)
    const kcalFont = font(p, 600, 21, 'display')
    let y = top
    s.meals.forEach((meal, mi) => {
      drawText(ctx, meal.label, left, y, { font: font(p, 700, 25), color: palette.foreground })
      const kcalText = meal.fasting ? '空腹' : meal.kcal === null ? '已记录' : `${meal.kcal} kcal`
      drawText(ctx, kcalText, right, y + 2, {
        font: font(p, 700, 24, 'display'),
        color: meal.kcal === null && !meal.fasting ? palette.subtle : accent.ink,
        align: 'right',
      })
      y += headH
      const rows: { name: string; kcal: string }[] = meal.fasting
        ? [{ name: '轻断食 · 未进食', kcal: '' }]
        : meal.lines.length === 0
          ? [{ name: '已记录', kcal: '' }]
          : meal.lines.map((l) => ({ name: l.name, kcal: l.kcal === null ? '' : `${l.kcal}` }))
      const n = alloc[mi]!
      if (rows.length > n) {
        const joined = rows.map((row) => row.name).join('、')
        y +=
          lineH *
          drawParagraph(ctx, joined, left + 6, y, right - left - 6, lineH, n, {
            font: nameFont,
            color: palette.muted,
          })
      } else {
        for (const row of rows) {
          const kw = row.kcal ? measure(ctx, row.kcal, kcalFont) : 0
          const nameW = drawText(ctx, row.name, left + 6, y, {
            font: nameFont,
            color: palette.muted,
            maxWidth: right - left - kw - 60,
          })
          if (row.kcal) {
            drawText(ctx, row.kcal, right, y, {
              font: kcalFont,
              color: palette.muted,
              align: 'right',
            })
            const lx = left + nameW + 18
            dashedLine(ctx, lx, y + 17, right - kw - 12, y + 17, palette.borderStrong, 2, [2, 8])
          }
          y += lineH
        }
      }
      y += gap
    })
    // 还没记的餐次：灰字餐名 + 一条虚线空行，像小票上留着的空位
    s.missingMeals.forEach((label) => {
      drawText(ctx, label, left, y, { font: font(p, 700, 25), color: palette.subtle })
      drawText(ctx, s.pending ? '待记录' : '未记录', right, y + 2, {
        font: font(p, 700, 24, 'display'),
        color: palette.subtle,
        align: 'right',
      })
      y += headH
      dashedLine(ctx, left + 6, y + 15, right, y + 15, palette.borderStrong, 2, [3, 9])
      y += lineH + gap
    })

    // 合计 + 条形码
    const fy = r.y + r.h - footH
    dashedLine(ctx, left, fy, right, fy, palette.borderStrong)
    drawText(
      ctx,
      s.pending ? `已记 ${s.mealsLogged}/${s.mealsRequired} 餐` : '全天合计',
      left,
      fy + 30,
      {
        font: font(p, 700, 25),
        color: palette.foreground,
      },
    )
    if (s.totalKcal === null) {
      drawText(ctx, '已记录', right, fy + 28, {
        font: font(p, 700, 34, 'display'),
        color: palette.muted,
        align: 'right',
      })
    } else {
      const unitW = drawText(ctx, 'kcal', right, fy + 38, {
        font: font(p, 600, 20, 'display'),
        color: palette.muted,
        align: 'right',
      })
      drawText(ctx, `${s.totalKcal}`, right - unitW - 10, fy + 14, {
        font: font(p, 700, 46, 'display'),
        color: palette.foreground,
        align: 'right',
      })
    }
    const rand = seededRandom(hashSeed(`${input.today}:${input.goal.id}`))
    const barW = r.w - pad * 2 - 60 - (o.reserveRight ?? 0)
    let bx = r.x + (r.w - barW) / 2
    const bEnd = bx + barW
    ctx.fillStyle = alpha(palette.foreground, 0.82)
    while (bx < bEnd) {
      const w = 2 + Math.floor(rand() * 3) * 2
      ctx.fillRect(bx, fy + 90, Math.min(w, bEnd - bx), 46)
      bx += w + 3 + Math.floor(rand() * 2) * 3
    }
    drawText(ctx, '谢谢惠顾，明天也要好好吃饭', r.x + r.w / 2, fy + 152, {
      font: font(p, 500, 19),
      color: palette.subtle,
      align: 'center',
    })
  })
  // 顶部用和纸胶带贴住
  withRotation(ctx, r.x + r.w / 2, r.y + r.h / 2, deg, () => {
    drawTape(ctx, r.x + r.w / 2, r.y + 2, 170, -3, accent.base)
  })
}

/** 餐盘：盘沿营养素供能环 + 盘心主数字 + 左右刀叉 */
function drawPlate(p: Painter, cx: number, cy: number, R: number, cutlery: boolean) {
  const { ctx, palette, accent, model } = p
  const s = sceneOf(p)
  ctx.save()
  setShadow(ctx, 'float')
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fillStyle = palette.surface
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.strokeStyle = palette.border
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, R * 0.56, 0, Math.PI * 2)
  ctx.fillStyle = alpha(accent.soft, 0.7)
  ctx.fill()

  const ringR = R * 0.75
  const ringW = R * 0.17
  ctx.lineWidth = ringW
  ctx.lineCap = 'round'
  const parts: [number, string][] = [
    [s.share.protein, accent.ink],
    [s.share.carb, accent.base],
    [s.share.fat, palette.borderStrong],
  ]
  const total = parts.reduce((a, [v]) => a + v, 0)
  if (total <= 0) {
    ctx.beginPath()
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2)
    ctx.strokeStyle = palette.surfaceSunken
    ctx.stroke()
  } else {
    const gapA = 0.16
    let a = -Math.PI / 2
    for (const [v, color] of parts) {
      const span = (v / total) * Math.PI * 2
      if (span > gapA + 0.02) {
        ctx.beginPath()
        ctx.arc(cx, cy, ringR, a + gapA / 2, a + span - gapA / 2)
        ctx.strokeStyle = color
        ctx.stroke()
      }
      a += span
    }
  }
  ctx.restore()

  const valueSize = Math.round(R * (model.kpi.value.length > 3 ? 0.4 : 0.5))
  drawText(ctx, model.kpi.value, cx, cy + R * 0.04, {
    font: font(p, 700, valueSize, 'display'),
    color: accent.ink,
    align: 'center',
    baseline: 'alphabetic',
  })
  drawText(ctx, model.kpi.unit, cx, cy + R * 0.12, {
    font: font(p, 700, Math.max(22, Math.round(R * 0.12))),
    color: palette.muted,
    align: 'center',
  })

  if (!cutlery) return
  ctx.save()
  ctx.strokeStyle = palette.borderStrong
  ctx.fillStyle = palette.borderStrong
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 11
  // 叉
  const fx = cx - R - 58
  ctx.beginPath()
  ctx.moveTo(fx, cy - R * 0.2)
  ctx.lineTo(fx, cy + R * 0.62)
  ctx.stroke()
  ctx.lineWidth = 7
  for (const dx of [-17, 0, 17]) {
    ctx.beginPath()
    ctx.moveTo(fx + dx, cy - R * 0.62)
    ctx.lineTo(fx + dx, cy - R * 0.3)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(fx - 17, cy - R * 0.3)
  ctx.quadraticCurveTo(fx, cy - R * 0.14, fx + 17, cy - R * 0.3)
  ctx.stroke()
  // 刀
  const kx = cx + R + 58
  ctx.lineWidth = 11
  ctx.beginPath()
  ctx.moveTo(kx, cy + R * 0.1)
  ctx.lineTo(kx, cy + R * 0.62)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(kx - 5, cy + R * 0.1)
  ctx.lineTo(kx - 5, cy - R * 0.62)
  ctx.quadraticCurveTo(kx + 26, cy - R * 0.4, kx + 20, cy + R * 0.1)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** 营养素图例：一行三枚色点胶囊，以 cx 居中 */
function drawMacroLegend(p: Painter, cx: number, y: number) {
  const { ctx, palette, accent } = p
  const s = sceneOf(p)
  const items: [string, string][] = [
    [`蛋白 ${s.macros.protein}g`, accent.ink],
    [`碳水 ${s.macros.carb}g`, accent.base],
    [`脂肪 ${s.macros.fat}g`, palette.borderStrong],
  ]
  const f = font(p, 700, 22)
  const widths = items.map(([t]) => measure(ctx, t, f) + 62)
  let x = cx - (widths.reduce((a, b) => a + b, 0) + 12 * (items.length - 1)) / 2
  items.forEach(([text, color], i) => {
    const w = widths[i]!
    drawPill(ctx, x, y, `   ${text}`, {
      bg: palette.surface,
      fg: palette.foreground,
      font: f,
      height: 44,
      padX: 20,
      border: palette.border,
    })
    ctx.beginPath()
    ctx.arc(x + 24, y + 22, 8, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    x += w + 12
  })
}

function extrasText(s: DietPosterModel): string {
  return s.extras.map((e) => `${e.label} ${e.value}`).join(' · ')
}

function landscape(p: Painter) {
  const { ctx, palette, model, accent } = p
  const s = sceneOf(p)
  drawReceipt(p, { x: 88, y: 138, w: 468, h: 772 }, -1.5, { reserveRight: 96 })
  // 印章斜盖在小票右下角：一半在票面上、一半落在手账底纸，避开条形码与落款
  drawStamp(p, 564, 852, 80, palette.tones[model.status.tone].ink)

  const bottom = drawTitleBlock(p, 624, 132, 620)
  drawText(ctx, model.kpi.sub, 624, bottom + 2, {
    font: font(p, 600, 26),
    color: palette.muted,
    maxWidth: 620,
  })
  drawPlate(p, 934, 598, 206, true)
  if (s.hasNutrition) {
    drawMacroLegend(p, 934, 836)
    drawText(ctx, extrasText(s), 934, 894, {
      font: font(p, 600, 21),
      color: accent.ink,
      align: 'center',
      maxWidth: 640,
    })
  } else {
    drawText(ctx, '餐食已记录 · 营养数据未解析', 934, 852, {
      font: font(p, 600, 22),
      color: palette.subtle,
      align: 'center',
      maxWidth: 640,
    })
  }

  drawPetNote(p, { x: 1312, y: 132, w: 544, h: 300 })
  const ch = checksCardHeight(p, 544, 470)
  drawChecksCard(p, { x: 1312, y: 928 - ch, w: 544, h: ch })
}

function portrait(p: Painter) {
  const { ctx, palette, model, accent } = p
  const s = sceneOf(p)
  const bottom = drawTitleBlock(p, 56, 150, 700)
  drawText(ctx, model.kpi.sub, 56, bottom + 4, {
    font: font(p, 600, 28),
    color: palette.muted,
    maxWidth: 700,
  })
  drawStamp(p, 918, 262, 92, palette.tones[model.status.tone].ink)

  drawPlate(p, 540, 640, 232, true)
  if (s.hasNutrition) {
    drawMacroLegend(p, 540, 896)
    drawText(ctx, extrasText(s), 540, 956, {
      font: font(p, 600, 23),
      color: accent.ink,
      align: 'center',
      maxWidth: 940,
    })
  } else {
    drawText(ctx, '餐食已记录 · 营养数据未解析', 540, 916, {
      font: font(p, 600, 23),
      color: palette.subtle,
      align: 'center',
      maxWidth: 940,
    })
  }

  drawReceipt(p, { x: 74, y: 1016, w: 452, h: 686 }, -1.5)
  drawPetNote(p, { x: 562, y: 1008, w: 462, h: 330 })
  const ch = checksCardHeight(p, 462, 356)
  drawChecksCard(p, { x: 562, y: 1716 - ch, w: 462, h: ch })
}

export const dietScene: PosterScene = { landscape, portrait }
