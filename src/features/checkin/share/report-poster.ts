import { logoSvg } from '@/components/layout/logo-svg'
import type { PosterOrientation } from '@/components/ui/report-share-sheet'
import type { ModuleTone, Tone } from '@/components/ui/tone'
import { moduleMeta } from '@/components/ui/tone'
import type { MascotRegistryCharacter } from '@/features/me/schemas'
import { TIER_CONFIG } from '@/features/referee/rules/diet'
import type { RefereeTier, Verdict } from '@/features/referee/schemas'
import { encodeQr } from '@/lib/qr'
import type { CheckinGoal } from '../components/form-types'
import { collectDayDietMeals, type DietReportMeal } from '../modules/diet/report'
import type { Checkin, CreateCheckinInput } from '../schemas'

/*
 * 原生 Canvas 2D 打卡分析报告海报引擎（零第三方库依赖）：
 * - 默认 16:9 横版「摊开的手账跨页」双栏 Bento 构图（1920 × 1080），彻底摆脱系统长截屏感；
 * - 同时支持 9:16 竖版海报（1080 × 1920）供朋友圈/竖屏故事场景一键切换；
 * - 严格复用 DayDayOn 治愈手账色板、真实 BrandMark Logo、当前陪伴宠物 SVG、手账印章，
 *   并在底部嵌入可真实扫码的推广二维码（https://daydayon.husteread.com/）。
 */

export type { PosterOrientation }

export interface ReportPosterInput {
  module: ModuleTone
  goal: CheckinGoal
  verdict: Verdict
  subject: CreateCheckinInput
  todayCheckins?: readonly Checkin[]
  today: string
  period: { done: number; total: number }
  pet: { character: MascotRegistryCharacter; name: string }
  /** 由客户端将当前 <MascotSvg> 序列化并解析 CSS 变量后的 data URL */
  mascotDataUrl?: string | null
  orientation?: PosterOrientation
  promoUrl?: string
}

export const DEFAULT_PROMO_URL = 'https://daydayon.husteread.com/'
export const DEFAULT_PROMO_HOST = 'daydayon.husteread.com'

interface PaletteColor {
  base: string
  soft: string
  ink: string
}

interface PosterPalette {
  background: string
  surface: string
  surfaceSunken: string
  foreground: string
  muted: string
  subtle: string
  border: string
  borderStrong: string
  primary: PaletteColor
  tones: Record<Tone, PaletteColor>
}

const DEFAULT_PALETTE: PosterPalette = {
  background: '#fff8f0',
  surface: '#fffdf9',
  surfaceSunken: '#f8eee2',
  foreground: '#4a3f35',
  muted: '#7a6a5b',
  subtle: '#a8998a',
  border: '#eadccb',
  borderStrong: '#dcc8b2',
  primary: { base: '#93603f', soft: '#f3e2cf', ink: '#6b3f26' },
  tones: {
    primary: { base: '#93603f', soft: '#f3e2cf', ink: '#6b3f26' },
    exercise: { base: '#7cc9a6', soft: '#e1f4ea', ink: '#2c6a50' },
    diet: { base: '#f5c95e', soft: '#fdf2d2', ink: '#7a5608' },
    sleep: { base: '#a99de6', soft: '#ece8fb', ink: '#4a3f8c' },
    study: { base: '#86bde8', soft: '#e1eefa', ink: '#24578a' },
    custom: { base: '#f2a0b8', soft: '#fce6ed', ink: '#8c3553' },
    success: { base: '#4fae7f', soft: '#def3e7', ink: '#23663f' },
    warning: { base: '#e8a33d', soft: '#fcefd6', ink: '#7d5208' },
    danger: { base: '#e06464', soft: '#fde3e1', ink: '#9b2d2d' },
    neutral: { base: '#a8998a', soft: '#f8eee2', ink: '#7a6a5b' },
  },
}

function readPaletteFromDom(): PosterPalette {
  if (typeof window === 'undefined' || typeof document === 'undefined') return DEFAULT_PALETTE
  const cs = window.getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  const primary: PaletteColor = {
    base: v('--primary', DEFAULT_PALETTE.primary.base),
    soft: v('--primary-soft', DEFAULT_PALETTE.primary.soft),
    ink: v('--primary-ink', DEFAULT_PALETTE.primary.ink),
  }
  return {
    background: v('--background', DEFAULT_PALETTE.background),
    surface: v('--surface', DEFAULT_PALETTE.surface),
    surfaceSunken: v('--surface-sunken', DEFAULT_PALETTE.surfaceSunken),
    foreground: v('--foreground', DEFAULT_PALETTE.foreground),
    muted: v('--muted', DEFAULT_PALETTE.muted),
    subtle: v('--subtle', DEFAULT_PALETTE.subtle),
    border: v('--border', DEFAULT_PALETTE.border),
    borderStrong: v('--border-strong', DEFAULT_PALETTE.borderStrong),
    primary,
    tones: {
      ...DEFAULT_PALETTE.tones,
      primary,
    },
  }
}

function getFontStacks(): { sans: string; display: string } {
  const fallbackSans =
    "'PingFang SC', 'HarmonyOS Sans SC', 'MiSans', 'Microsoft YaHei', system-ui, sans-serif"
  if (typeof window === 'undefined') {
    return { sans: fallbackSans, display: fallbackSans }
  }
  const cs = window.getComputedStyle(document.body)
  const rootCs = window.getComputedStyle(document.documentElement)
  const sans = cs.fontFamily || fallbackSans
  const display = rootCs.getPropertyValue('--font-display').trim() || sans
  return { sans, display }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function formatDateCn(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return isoDate
  return `${m[1]} 年 ${Number(m[2])} 月 ${Number(m[3])} 日`
}

function resolveTier(v: unknown): RefereeTier {
  if (v === 'strict-fat-loss' || v === 'balanced-glycemic' || v === 'gentle-gain') return v
  return 'balanced-glycemic'
}

// ---------------------------------------------------------------------------
// Canvas 2D 基础绘图原语
// ---------------------------------------------------------------------------

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function fillCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  opts: {
    fill: string
    stroke?: string
    lineWidth?: number
    shadow?: boolean
    topBarColor?: string
  },
) {
  ctx.save()
  if (opts.shadow) {
    ctx.shadowColor = 'rgba(74, 63, 53, 0.09)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 8
  }
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fillStyle = opts.fill
  ctx.fill()
  ctx.restore()

  if (opts.topBarColor) {
    ctx.save()
    roundRectPath(ctx, x, y, w, h, r)
    ctx.clip()
    ctx.fillStyle = opts.topBarColor
    ctx.fillRect(x, y, w, 9)
    ctx.restore()
  }

  if (opts.stroke) {
    ctx.save()
    roundRectPath(ctx, x, y, w, h, r)
    ctx.strokeStyle = opts.stroke
    ctx.lineWidth = opts.lineWidth ?? 1.5
    ctx.stroke()
    ctx.restore()
  }
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  opts: {
    bg: string
    fg: string
    font: string
    padX?: number
    height?: number
    border?: string
    alignRight?: boolean
  },
): number {
  const padX = opts.padX ?? 16
  const height = opts.height ?? 34
  ctx.save()
  ctx.font = opts.font
  const tw = ctx.measureText(text).width
  const w = Math.ceil(tw + padX * 2)
  const left = opts.alignRight ? x - w : x
  roundRectPath(ctx, left, y, w, height, height / 2)
  ctx.fillStyle = opts.bg
  ctx.fill()
  if (opts.border) {
    ctx.strokeStyle = opts.border
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
  ctx.fillStyle = opts.fg
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillText(text, left + w / 2, y + height / 2 + 0.5)
  ctx.restore()
  return w
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return `${text.slice(0, Math.max(0, lo))}…`
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const chars = Array.from(text.replace(/\s+/g, ' ').trim())
  const lines: string[] = []
  let cur = ''
  for (const ch of chars) {
    const test = cur + ch
    if (ctx.measureText(test).width > maxWidth && cur.length > 0) {
      lines.push(cur)
      cur = ch
      if (lines.length === maxLines) {
        lines[maxLines - 1] = truncateText(ctx, `${lines[maxLines - 1]}…`, maxWidth)
        return lines
      }
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines.slice(0, maxLines)
}

function drawProgressTrack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  trackColor: string,
  fillColor: string,
) {
  const clamped = Math.max(0, Math.min(1, ratio))
  roundRectPath(ctx, x, y, w, h, h / 2)
  ctx.fillStyle = trackColor
  ctx.fill()
  if (clamped > 0) {
    const fw = Math.max(h, w * clamped)
    roundRectPath(ctx, x, y, fw, h, h / 2)
    ctx.fillStyle = fillColor
    ctx.fill()
  }
}

/** 绘制倾斜手账印章 */
function drawJournalStamp(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  mainText: string,
  caption: string,
  color: string,
  fonts: { sans: string; display: string },
) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((-12 * Math.PI) / 180)
  ctx.globalAlpha = 0.88

  // 外实心双圈 + 淡色印泥底
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.fillStyle = `${color}14`
  ctx.fill()
  ctx.lineWidth = 3.2
  ctx.strokeStyle = color
  ctx.stroke()

  ctx.beginPath()
  ctx.setLineDash([5, 4])
  ctx.arc(0, 0, radius - 8, 0, Math.PI * 2)
  ctx.lineWidth = 1.6
  ctx.stroke()
  ctx.setLineDash([])

  // 顶部与底部装饰小点
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(0, -(radius - 16), 2.5, 0, Math.PI * 2)
  ctx.arc(0, radius - 16, 2.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(radius * 0.34)}px ${fonts.display}`
  ctx.fillText(mainText, 0, -5)

  ctx.font = `700 ${Math.round(radius * 0.2)}px ${fonts.sans}`
  ctx.fillText(caption, 0, radius * 0.32)
  ctx.restore()
}

/** 绘制标准可扫码二维码（含白边安静区与高对比暖棕墨块） */
function drawQrCode(
  ctx: CanvasRenderingContext2D,
  url: string,
  x: number,
  y: number,
  boxSize: number,
  inkColor: string,
) {
  const qr = encodeQr(url)
  const quiet = 2
  const totalModules = qr.size + quiet * 2
  const cell = boxSize / totalModules

  // 纯白高对比底卡
  ctx.save()
  roundRectPath(ctx, x, y, boxSize, boxSize, 12)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = '#eadccb'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.fillStyle = inkColor
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r * qr.size + c] !== 1) continue
      const mx = x + (c + quiet) * cell
      const my = y + (r + quiet) * cell
      // 微量 +0.25 消除子像素缝隙，保证扫码识别率 100%
      ctx.fillRect(mx, my, cell + 0.25, cell + 0.25)
    }
  }
  ctx.restore()
}

/** 绘制手账点阵奶油底纸 + 板块柔和光晕 + 装裱细框 */
function drawJournalBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: PosterPalette,
  accent: PaletteColor,
) {
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, w, h)

  // 角落柔和马卡龙水彩光晕
  const g1 = ctx.createRadialGradient(
    w * 0.12,
    h * 0.14,
    10,
    w * 0.12,
    h * 0.14,
    Math.max(w, h) * 0.42,
  )
  g1.addColorStop(0, `${accent.base}26`)
  g1.addColorStop(1, `${accent.base}00`)
  ctx.fillStyle = g1
  ctx.fillRect(0, 0, w, h)

  const g2 = ctx.createRadialGradient(
    w * 0.88,
    h * 0.86,
    10,
    w * 0.88,
    h * 0.86,
    Math.max(w, h) * 0.38,
  )
  g2.addColorStop(0, `${palette.primary.base}18`)
  g2.addColorStop(1, `${palette.primary.base}00`)
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, w, h)

  // 手账点阵底纹
  ctx.fillStyle = 'rgba(74, 63, 53, 0.08)'
  const step = 28
  for (let py = 24; py < h - 16; py += step) {
    for (let px = 24; px < w - 16; px += step) {
      ctx.beginPath()
      ctx.arc(px, py, 1.35, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 外层装裱手账边线
  roundRectPath(ctx, 20, 20, w - 40, h - 40, 32)
  ctx.strokeStyle = palette.border
  ctx.lineWidth = 2
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// 板块数据结构提取（饮食 / 运动 / 睡眠 / 学习 / 自定义）
// ---------------------------------------------------------------------------

interface HeroContent {
  moduleBadge: string
  statusBadge: { text: string; tone: Tone }
  stampMain: string
  stampSub: string
  stampTone: Tone
  kpiValue: string
  kpiUnit: string
  kpiSub: string
  highlightPills: string[]
}

function buildHeroContent(input: ReportPosterInput, dayMeals: DietReportMeal[]): HeroContent {
  const { module: mod, verdict, subject } = input
  const m = verdict.metrics
  const meta = moduleMeta[mod]
  const pending = verdict.settlement === 'pending'

  const statusBadge: { text: string; tone: Tone } = pending
    ? { text: `分餐进度 ${num(m.mealsLogged, 1)}/${num(m.mealsRequired, 3)}`, tone: 'diet' }
    : verdict.isValid
      ? { text: '已达标 · 计入连击', tone: 'success' }
      : { text: '诚实存档 · 复盘参考', tone: 'warning' }

  const stampMain = pending ? '分餐中' : verdict.isValid ? '已达标' : '已存档'
  const stampSub = pending ? '待三餐汇总' : verdict.isValid ? '有效卡' : '继续加油'
  const stampTone: Tone = pending ? 'diet' : verdict.isValid ? mod : 'warning'

  if (mod === 'diet') {
    if (pending) {
      const mealKcal = num(m.kcal, 0)
      return {
        moduleBadge: `${meta.label} · 单餐解析`,
        statusBadge,
        stampMain,
        stampSub,
        stampTone,
        kpiValue: `${mealKcal}`,
        kpiUnit: 'kcal',
        kpiSub: `今日已记 ${num(m.mealsLogged, 1)} / ${num(m.mealsRequired, 3)} 正餐`,
        highlightPills: [`蛋白 ${num(m.protein)}g`, `碳水 ${num(m.carb)}g`, `脂肪 ${num(m.fat)}g`],
      }
    }
    const dailyKcal = num(
      m.dailyKcal,
      dayMeals.reduce((s, item) => s + item.kcal, 0),
    )
    return {
      moduleBadge: `${meta.label} · 今日三餐总评`,
      statusBadge,
      stampMain,
      stampSub,
      stampTone,
      kpiValue: verdict.score !== null ? verdict.score.toFixed(1) : `${dailyKcal}`,
      kpiUnit: verdict.score !== null ? '/ 5.0 分' : 'kcal',
      kpiSub:
        verdict.score !== null
          ? `全天总热量 ${dailyKcal} kcal · 蛋白 ${num(m.dailyProtein)}g`
          : `今日三餐已完整记录`,
      highlightPills: [
        `综合 GI ${num(m.dailyGi)}`,
        `纤维 ${num(m.dailyFiber)}g`,
        `钠 ${num(m.dailySodium)}mg`,
      ],
    }
  }

  if (mod === 'exercise') {
    const kcal = num(m.kcal, 0)
    const minutes = num(m.minutes, 0)
    const load = num(m.load, 0)
    const loadText = load < 0.3 ? '负荷轻' : load < 0.7 ? '负荷适中' : '负荷较高'
    const itemCount = subject.module === 'exercise' ? (subject.items?.length ?? 1) : 1
    return {
      moduleBadge: `${meta.label} · 运动分析`,
      statusBadge,
      stampMain,
      stampSub,
      stampTone,
      kpiValue: `${kcal}`,
      kpiUnit: 'kcal',
      kpiSub: `总时长 ${minutes} 分钟 · ${loadText}`,
      highlightPills: [`${itemCount} 项运动`, `相对负荷 ${Math.round(load * 100)}%`],
    }
  }

  if (mod === 'sleep') {
    const hours = num(m.hours, 0)
    const bed = String(m.bedLocal ?? '—')
    const wake = String(m.wakeLocal ?? '—')
    const late = typeof m.lateByMinutes === 'number' ? m.lateByMinutes : null
    const lateText =
      late === null ? '' : late <= 0 ? `比红线早 ${-late} 分钟` : `比红线晚 ${late} 分钟`
    return {
      moduleBadge: `${meta.label} · 睡眠分析`,
      statusBadge,
      stampMain,
      stampSub,
      stampTone,
      kpiValue: `${hours}`,
      kpiUnit: '小时',
      kpiSub: `${bed} 入睡 → ${wake} 起床`,
      highlightPills: [
        ...(lateText ? [lateText] : []),
        `入睡红线 ${String(m.bedtimeBy ?? '23:30')}`,
      ],
    }
  }

  if (mod === 'study') {
    const totalMin = num(m.totalMinutes, num(m.minutes, 0))
    const thisMin = num(m.minutes, 0)
    const facts = verdict.facts?.module === 'study' ? verdict.facts : null
    return {
      moduleBadge: `${meta.label} · 学习分析`,
      statusBadge,
      stampMain,
      stampSub,
      stampTone,
      kpiValue: `${totalMin}`,
      kpiUnit: '分钟',
      kpiSub: `本次专注 ${thisMin} 分钟 · 今日累计`,
      highlightPills: [
        facts?.subject || '专注学习',
        facts?.substantive === false ? '要点待补充' : '要点有实质',
      ],
    }
  }

  // custom
  const passed = verdict.checks.filter((c) => c.ok).length
  const totalChecks = verdict.checks.length
  return {
    moduleBadge: `${meta.label} · 小目标分析`,
    statusBadge,
    stampMain,
    stampSub,
    stampTone,
    kpiValue: totalChecks > 0 ? `${passed}/${totalChecks}` : '已记',
    kpiUnit: totalChecks > 0 ? '条件达标' : '今日打卡',
    kpiSub: input.goal.title,
    highlightPills: [verdict.isValid ? '全部满足' : '诚实记录'],
  }
}

// ---------------------------------------------------------------------------
// 右栏/下方 模块专属面板绘制
// ---------------------------------------------------------------------------

function drawSectionHeader(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  title: string,
  dotColor: string,
  rightText: string | null,
  palette: PosterPalette,
  fonts: { sans: string; display: string },
  maxWidth: number,
) {
  ctx.save()
  ctx.fillStyle = dotColor
  roundRectPath(ctx, x, y + 3, 10, 22, 5)
  ctx.fill()

  ctx.font = `700 22px ${fonts.sans}`
  ctx.fillStyle = palette.foreground
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText(title, x + 20, y)

  if (rightText) {
    ctx.font = `600 16px ${fonts.sans}`
    ctx.fillStyle = palette.muted
    ctx.textAlign = 'right'
    ctx.fillText(rightText, x + maxWidth, y + 4)
  }
  ctx.restore()
}

/** 饮食上区：四宫格三餐热量与菜品分布（settled）或单餐菜品列表（pending） */
function drawDietTopPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  input: ReportPosterInput,
  dayMeals: DietReportMeal[],
  palette: PosterPalette,
  fonts: { sans: string; display: string },
) {
  fillCard(ctx, x, y, w, h, 28, {
    fill: palette.surface,
    stroke: palette.border,
    shadow: true,
  })
  const pad = 28
  const innerW = w - pad * 2
  const pending = input.verdict.settlement === 'pending'

  if (pending) {
    const facts = input.verdict.facts?.module === 'diet' ? input.verdict.facts : null
    const dishes = facts?.dishes ?? []
    drawSectionHeader(
      ctx,
      x + pad,
      y + pad,
      '本餐逐菜解析',
      palette.tones.diet.base,
      `共 ${dishes.length} 道 · GI ${num(input.verdict.metrics.gi)}`,
      palette,
      fonts,
      innerW,
    )
    const cols = 2
    const gap = 14
    const colW = (innerW - gap) / cols
    const maxItems = Math.min(6, dishes.length)
    for (let i = 0; i < maxItems; i++) {
      const d = dishes[i]!
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = x + pad + col * (colW + gap)
      const cy = y + pad + 44 + row * 82
      fillCard(ctx, cx, cy, colW, 70, 16, {
        fill: palette.surfaceSunken,
        stroke: palette.border,
      })
      ctx.save()
      ctx.font = `700 18px ${fonts.sans}`
      ctx.fillStyle = palette.foreground
      ctx.textBaseline = 'top'
      ctx.fillText(truncateText(ctx, d.name, colW - 120), cx + 16, cy + 12)
      ctx.font = `700 18px ${fonts.display}`
      ctx.fillStyle = palette.tones.diet.ink
      ctx.textAlign = 'right'
      ctx.fillText(`${d.kcal} kcal`, cx + colW - 16, cy + 12)
      ctx.textAlign = 'left'
      ctx.font = `500 14px ${fonts.sans}`
      ctx.fillStyle = palette.muted
      ctx.fillText(
        `蛋白 ${d.proteinG}g · 碳水 ${d.carbG}g · 脂肪 ${d.fatG}g · GI ${d.gi}`,
        cx + 16,
        cy + 40,
      )
      ctx.restore()
    }
    return
  }

  // settled：一日三餐（+加餐）四宫格展示
  const totalDishCount = dayMeals.reduce(
    (sum, item) => sum + (item.dishes.length || item.fallbackItems.length),
    0,
  )
  drawSectionHeader(
    ctx,
    x + pad,
    y + pad,
    '今日三餐与菜品分布',
    palette.tones.diet.base,
    `全天共 ${totalDishCount} 道菜 · 综合 GI ${num(input.verdict.metrics.dailyGi)}`,
    palette,
    fonts,
    innerW,
  )

  const mealSlots: Array<{
    key: 'breakfast' | 'lunch' | 'dinner' | 'snack'
    label: string
    accent: PaletteColor
  }> = [
    { key: 'breakfast', label: '早餐', accent: palette.tones.diet },
    { key: 'lunch', label: '午餐', accent: palette.tones.exercise },
    { key: 'dinner', label: '晚餐', accent: palette.tones.study },
    { key: 'snack', label: '加餐', accent: palette.tones.custom },
  ]
  const hasSnack = dayMeals.some((m) => m.mealType === 'snack')
  const visibleSlots = hasSnack ? mealSlots : mealSlots.slice(0, 3)

  const gap = 16
  const cardW = (innerW - gap * (visibleSlots.length - 1)) / visibleSlots.length
  const cardY = y + pad + 44
  const cardH = h - pad * 2 - 44

  visibleSlots.forEach((slot, idx) => {
    const meal = dayMeals.find((m) => m.mealType === slot.key) ?? null
    const sx = x + pad + idx * (cardW + gap)
    fillCard(ctx, sx, cardY, cardW, cardH, 20, {
      fill: palette.surfaceSunken,
      stroke: palette.border,
    })

    // 顶部餐次徽章 + 热量
    drawPill(ctx, sx + 16, cardY + 16, slot.label, {
      bg: slot.accent.soft,
      fg: slot.accent.ink,
      font: `700 15px ${fonts.sans}`,
      padX: 12,
      height: 28,
    })

    const metricKey = `${slot.key}Kcal`
    const metricKcal = input.verdict.metrics[metricKey]
    const kcal = typeof metricKcal === 'number' ? metricKcal : (meal?.kcal ?? 0)

    ctx.save()
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.font = `700 32px ${fonts.display}`
    ctx.fillStyle = palette.foreground
    const kcalText = meal?.isFasting ? '空腹' : `${kcal}`
    ctx.fillText(kcalText, sx + 16, cardY + 56)
    if (!meal?.isFasting) {
      const kw = ctx.measureText(kcalText).width
      ctx.font = `600 15px ${fonts.sans}`
      ctx.fillStyle = palette.muted
      ctx.fillText('kcal', sx + 22 + kw, cardY + 70)
    }

    // 分隔虚线
    ctx.beginPath()
    ctx.setLineDash([4, 4])
    ctx.moveTo(sx + 16, cardY + 104)
    ctx.lineTo(sx + cardW - 16, cardY + 104)
    ctx.strokeStyle = palette.borderStrong
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.setLineDash([])

    // 菜品列表（最多展示 4 行，超出显示「等 N 道」）
    const names: string[] = meal?.isFasting
      ? ['轻断食未进食']
      : meal && meal.dishes.length > 0
        ? meal.dishes.map((d) => `${d.name}${d.kcal > 0 ? ` (${d.kcal})` : ''}`)
        : meal && meal.fallbackItems.length > 0
          ? meal.fallbackItems.map((it) => it.name)
          : ['已记录']

    const maxLines = Math.max(2, Math.floor((cardH - 122) / 28))
    const shown = names.slice(0, maxLines)
    if (names.length > maxLines) {
      shown[maxLines - 1] = `等共 ${names.length} 道菜`
    }
    ctx.font = `600 15px ${fonts.sans}`
    shown.forEach((line, lineIdx) => {
      const ly = cardY + 116 + lineIdx * 28
      ctx.fillStyle = slot.accent.base
      ctx.beginPath()
      ctx.arc(sx + 21, ly + 9, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = palette.foreground
      ctx.fillText(truncateText(ctx, line, cardW - 44), sx + 32, ly)
    })
    ctx.restore()
  })
}

/** 运动上区：运动项目卡片网格 */
function drawExerciseTopPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  input: ReportPosterInput,
  palette: PosterPalette,
  fonts: { sans: string; display: string },
) {
  fillCard(ctx, x, y, w, h, 28, {
    fill: palette.surface,
    stroke: palette.border,
    shadow: true,
  })
  const pad = 28
  const innerW = w - pad * 2
  const items = input.subject.module === 'exercise' ? (input.subject.items ?? []) : []
  const facts = input.verdict.facts?.module === 'exercise' ? input.verdict.facts : null

  drawSectionHeader(
    ctx,
    x + pad,
    y + pad,
    '今日运动项目明细',
    palette.tones.exercise.base,
    `共 ${items.length || 1} 项 · 消耗 ${num(input.verdict.metrics.kcal)} kcal`,
    palette,
    fonts,
    innerW,
  )

  const list =
    items.length > 0
      ? items
      : [
          {
            name:
              input.subject.module === 'exercise' ? (input.subject.category ?? '运动') : '运动打卡',
            calc: 'distance' as const,
            minutes: num(input.verdict.metrics.minutes, 0),
            km: null,
            sets: null,
            heartRate: null,
            effort: null,
            feel: null,
          },
        ]

  const shown = list.slice(0, 3)
  const gap = 16
  const cardW = (innerW - gap * (shown.length - 1)) / shown.length
  const cardY = y + pad + 44
  const cardH = h - pad * 2 - 44

  shown.forEach((it, idx) => {
    const fact = facts?.items[idx]
    const check = input.verdict.checks[idx]
    const sx = x + pad + idx * (cardW + gap)
    fillCard(ctx, sx, cardY, cardW, cardH, 20, {
      fill: palette.surfaceSunken,
      stroke: palette.border,
    })

    ctx.save()
    ctx.textBaseline = 'top'
    ctx.font = `700 21px ${fonts.sans}`
    ctx.fillStyle = palette.foreground
    ctx.fillText(truncateText(ctx, it.name, cardW - 104), sx + 18, cardY + 18)

    const ok = check?.ok ?? input.verdict.isValid
    drawPill(ctx, sx + cardW - 16, cardY + 15, ok ? '达标' : '记录', {
      bg: ok ? palette.tones.success.soft : palette.tones.warning.soft,
      fg: ok ? palette.tones.success.ink : palette.tones.warning.ink,
      font: `700 13px ${fonts.sans}`,
      padX: 10,
      height: 26,
      alignRight: true,
    })

    ctx.font = `700 34px ${fonts.display}`
    ctx.fillStyle = palette.tones.exercise.ink
    const mainVal = fact ? `${fact.kcal}` : `${it.minutes}`
    const mainUnit = fact ? 'kcal' : '分钟'
    ctx.fillText(mainVal, sx + 18, cardY + 58)
    const vw = ctx.measureText(mainVal).width
    ctx.font = `600 15px ${fonts.sans}`
    ctx.fillStyle = palette.muted
    ctx.fillText(mainUnit, sx + 24 + vw, cardY + 74)

    const details: string[] = [
      `时长：${it.minutes} 分钟`,
      it.calc === 'count'
        ? `组数：${it.sets ?? 0} 组`
        : it.km
          ? `距离：${it.km} 公里`
          : '有氧 / 综合运动',
      ...(fact ? [`代谢当量：MET ${fact.met}`] : []),
      ...(it.calc === 'distance' && it.km
        ? [`配速：${(it.minutes / it.km).toFixed(1)} 分/公里`]
        : []),
    ]
    ctx.font = `500 15px ${fonts.sans}`
    ctx.fillStyle = palette.muted
    details.slice(0, 4).forEach((line, li) => {
      ctx.fillText(truncateText(ctx, line, cardW - 36), sx + 18, cardY + 114 + li * 28)
    })
    ctx.restore()
  })
}

function hhmmToSleepAxis(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const raw = Number(m[1]) * 60 + Number(m[2])
  // 以 20:00 (1200) 为 0 点，次日 12:00 为 960 分钟
  return raw >= 18 * 60 ? raw - 20 * 60 : raw + 4 * 60
}

/** 睡眠上区：可视化夜间睡眠时间轴 + 入睡红线标记 */
function drawSleepTopPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  input: ReportPosterInput,
  palette: PosterPalette,
  fonts: { sans: string; display: string },
) {
  fillCard(ctx, x, y, w, h, 28, {
    fill: palette.surface,
    stroke: palette.border,
    shadow: true,
  })
  const pad = 28
  const innerW = w - pad * 2
  const m = input.verdict.metrics
  const bed = String(m.bedLocal ?? '23:00')
  const wake = String(m.wakeLocal ?? '07:00')
  const redline = String(m.bedtimeBy ?? '23:30')

  drawSectionHeader(
    ctx,
    x + pad,
    y + pad,
    '夜间作息时间轴',
    palette.tones.sleep.base,
    `入睡红线 ${redline}`,
    palette,
    fonts,
    innerW,
  )

  // 时间轴槽：20:00 (0) → 次日 12:00 (960 min)
  const axisX = x + pad + 12
  const axisW = innerW - 24
  const axisY = y + pad + 92
  const axisH = 38
  const spanMin = 16 * 60 // 20:00 -> 次日 12:00

  roundRectPath(ctx, axisX, axisY, axisW, axisH, 19)
  ctx.fillStyle = palette.surfaceSunken
  ctx.fill()

  const toX = (minFrom20: number) =>
    axisX + (Math.max(0, Math.min(spanMin, minFrom20)) / spanMin) * axisW

  const bedPos = hhmmToSleepAxis(bed) ?? 180
  const wakePos = Math.max(bedPos + 60, hhmmToSleepAxis(wake) ?? bedPos + num(m.minutes, 480))
  const redPos = hhmmToSleepAxis(redline) ?? 210

  // 睡眠时长高亮条
  const barX1 = toX(bedPos)
  const barX2 = toX(wakePos)
  roundRectPath(ctx, barX1, axisY + 4, Math.max(24, barX2 - barX1), axisH - 8, 15)
  ctx.fillStyle = palette.tones.sleep.base
  ctx.fill()

  // 入睡红线虚线标尺
  const rx = toX(redPos)
  ctx.save()
  ctx.beginPath()
  ctx.setLineDash([5, 4])
  ctx.moveTo(rx, axisY - 22)
  ctx.lineTo(rx, axisY + axisH + 14)
  ctx.strokeStyle = palette.tones.warning.base
  ctx.lineWidth = 2.4
  ctx.stroke()
  ctx.setLineDash([])
  ctx.font = `700 13px ${fonts.sans}`
  ctx.fillStyle = palette.tones.warning.ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(`红线 ${redline}`, rx, axisY - 26)
  ctx.restore()

  // 刻度标签
  const ticks = [
    { label: '20:00', min: 0 },
    { label: '22:00', min: 120 },
    { label: '00:00', min: 240 },
    { label: '02:00', min: 360 },
    { label: '04:00', min: 480 },
    { label: '06:00', min: 600 },
    { label: '08:00', min: 720 },
    { label: '10:00', min: 840 },
    { label: '12:00', min: 960 },
  ]
  ctx.save()
  ctx.font = `600 13px ${fonts.display}`
  ctx.fillStyle = palette.subtle
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  for (const t of ticks) {
    ctx.fillText(t.label, toX(t.min), axisY + axisH + 16)
  }
  ctx.restore()

  // 下方 3 张睡眠关键指标卡
  const stats = [
    { label: '入睡时刻', value: bed, tone: palette.tones.sleep },
    { label: '起床时刻', value: wake, tone: palette.tones.study },
    {
      label: '作息规律度',
      value: m.regularityMinutes == null ? '待满两晚' : `偏差 ${m.regularityMinutes} 分`,
      tone: palette.tones.primary,
    },
  ]
  const cardGap = 16
  const cw = (innerW - cardGap * 2) / 3
  const cy = y + h - pad - 96
  stats.forEach((st, idx) => {
    const cx = x + pad + idx * (cw + cardGap)
    fillCard(ctx, cx, cy, cw, 96, 18, { fill: palette.surfaceSunken, stroke: palette.border })
    ctx.save()
    ctx.textBaseline = 'top'
    ctx.font = `600 15px ${fonts.sans}`
    ctx.fillStyle = palette.muted
    ctx.fillText(st.label, cx + 18, cy + 16)
    ctx.font = `700 28px ${fonts.display}`
    ctx.fillStyle = st.tone.ink
    ctx.fillText(st.value, cx + 18, cy + 44)
    ctx.restore()
  })
}

/** 学习上区：学习摘要与核心要点卡片 */
function drawStudyTopPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  input: ReportPosterInput,
  palette: PosterPalette,
  fonts: { sans: string; display: string },
) {
  fillCard(ctx, x, y, w, h, 28, {
    fill: palette.surface,
    stroke: palette.border,
    shadow: true,
  })
  const pad = 28
  const innerW = w - pad * 2
  const facts = input.verdict.facts?.module === 'study' ? input.verdict.facts : null
  const inputPoints = input.subject.module === 'study' ? (input.subject.points ?? []) : []
  const topic = input.subject.module === 'study' ? input.subject.what : input.goal.title

  drawSectionHeader(
    ctx,
    x + pad,
    y + pad,
    '今日学习内容与要点',
    palette.tones.study.base,
    facts?.subject || '专注学习',
    palette,
    fonts,
    innerW,
  )

  ctx.save()
  ctx.textBaseline = 'top'
  ctx.font = `700 20px ${fonts.sans}`
  ctx.fillStyle = palette.foreground
  const summary = facts?.summary ? `${topic} · ${facts.summary}` : topic
  ctx.fillText(truncateText(ctx, summary, innerW), x + pad, y + pad + 44)
  ctx.restore()

  const points = (facts?.keyPoints.length ? facts.keyPoints : inputPoints).slice(0, 3)
  const listY = y + pad + 84
  if (points.length === 0) {
    fillCard(ctx, x + pad, listY, innerW, h - pad * 2 - 90, 18, {
      fill: palette.surfaceSunken,
      stroke: palette.border,
    })
    ctx.save()
    ctx.font = `500 17px ${fonts.sans}`
    ctx.fillStyle = palette.muted
    ctx.textBaseline = 'middle'
    ctx.fillText('已完成本次专注记录，坚持每天进步一点点～', x + pad + 20, listY + 48)
    ctx.restore()
    return
  }

  const rowH = Math.min(
    72,
    Math.floor((h - pad * 2 - 96 - (points.length - 1) * 12) / points.length),
  )
  points.forEach((pt, idx) => {
    const ry = listY + idx * (rowH + 12)
    fillCard(ctx, x + pad, ry, innerW, rowH, 16, {
      fill: palette.surfaceSunken,
      stroke: palette.border,
    })
    drawPill(ctx, x + pad + 14, ry + Math.round((rowH - 28) / 2), `要点 ${idx + 1}`, {
      bg: palette.tones.study.soft,
      fg: palette.tones.study.ink,
      font: `700 13px ${fonts.sans}`,
      padX: 10,
      height: 28,
    })
    ctx.save()
    ctx.font = `600 16px ${fonts.sans}`
    ctx.fillStyle = palette.foreground
    ctx.textBaseline = 'middle'
    ctx.fillText(truncateText(ctx, pt, innerW - 118), x + pad + 98, ry + rowH / 2)
    ctx.restore()
  })
}

/** 小目标上区：自定义字段网格 */
function drawCustomTopPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  input: ReportPosterInput,
  palette: PosterPalette,
  fonts: { sans: string; display: string },
) {
  fillCard(ctx, x, y, w, h, 28, {
    fill: palette.surface,
    stroke: palette.border,
    shadow: true,
  })
  const pad = 28
  const innerW = w - pad * 2
  const values = input.subject.module === 'custom' ? input.subject.values : {}
  const fieldMap = new Map((input.goal.fields ?? []).map((f) => [f.key, f]))
  const entries = Object.entries(values)

  drawSectionHeader(
    ctx,
    x + pad,
    y + pad,
    '今日小目标记录明细',
    palette.tones.custom.base,
    `共填 ${entries.length} 项`,
    palette,
    fonts,
    innerW,
  )

  const cols = 2
  const gap = 14
  const colW = (innerW - gap) / cols
  const shown = entries.slice(0, 6)
  shown.forEach(([k, val], i) => {
    const f = fieldMap.get(k)
    const label = f?.label ?? k
    const displayVal = Array.isArray(val)
      ? val.join('、')
      : typeof val === 'boolean'
        ? val
          ? '是'
          : '否'
        : f?.type === 'duration' && typeof val === 'number'
          ? `${Math.round(val / 60)} 分钟`
          : f?.type === 'rating'
            ? `${String(val)} 星`
            : `${String(val)}${f?.type === 'number' && f.unit ? ` ${f.unit}` : ''}`
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = x + pad + col * (colW + gap)
    const cy = y + pad + 48 + row * 82
    fillCard(ctx, cx, cy, colW, 70, 16, { fill: palette.surfaceSunken, stroke: palette.border })
    ctx.save()
    ctx.textBaseline = 'middle'
    ctx.font = `600 16px ${fonts.sans}`
    ctx.fillStyle = palette.muted
    ctx.fillText(truncateText(ctx, label, colW * 0.45), cx + 16, cy + 35)
    ctx.font = `700 20px ${fonts.display}`
    ctx.fillStyle = palette.foreground
    ctx.textAlign = 'right'
    ctx.fillText(truncateText(ctx, displayVal, colW * 0.48), cx + colW - 16, cy + 35)
    ctx.restore()
  })
}

/** 下左卡：营养素总计 / 运动负荷 / 睡眠分期 / 学习累计 / 小目标 AI 评语 */
function drawBottomLeftMetricsCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  input: ReportPosterInput,
  palette: PosterPalette,
  fonts: { sans: string; display: string },
) {
  fillCard(ctx, x, y, w, h, 28, {
    fill: palette.surface,
    stroke: palette.border,
    shadow: true,
  })
  const pad = 26
  const innerW = w - pad * 2
  const m = input.verdict.metrics
  const mod = input.module

  if (mod === 'diet') {
    const pending = input.verdict.settlement === 'pending'
    const tier = resolveTier(m.tier)
    const cfg = TIER_CONFIG[tier]
    const fatCap = Number.isFinite(cfg.fatCapDaily) ? cfg.fatCapDaily : 90
    const sodiumCap = tier === 'gentle-gain' ? 5000 : 4500

    const protein = pending ? num(m.protein) : num(m.dailyProtein, num(m.protein))
    const carb = pending ? num(m.carb) : num(m.dailyCarb, num(m.carb))
    const fat = pending ? num(m.fat) : num(m.dailyFat, num(m.fat))
    const fiber = pending ? num(m.fiber) : num(m.dailyFiber, num(m.fiber))
    const sodium = pending ? num(m.sodium) : num(m.dailySodium, num(m.sodium))

    drawSectionHeader(
      ctx,
      x + pad,
      y + pad,
      pending ? '本餐营养素' : '今日全天营养素',
      palette.tones.diet.base,
      pending ? '单餐估算' : '全天合计',
      palette,
      fonts,
      innerW,
    )

    const bars = [
      {
        label: '蛋白质',
        value: `${protein} g`,
        ratio: protein / (pending ? 25 : 65),
        color: palette.tones.success.base,
      },
      {
        label: '碳水化合物',
        value: `${carb} g`,
        ratio: carb / (pending ? 80 : 220),
        color: palette.tones.study.base,
      },
      {
        label: '脂肪',
        value: `${fat} g`,
        ratio: fat / (pending ? 25 : fatCap),
        color: palette.tones.diet.base,
      },
      {
        label: '膳食纤维',
        value: `${fiber} g`,
        ratio: fiber / (pending ? 8 : 18),
        color: palette.tones.exercise.base,
      },
      {
        label: '钠',
        value: `${sodium} mg`,
        ratio: sodium / (pending ? 1500 : sodiumCap),
        color: palette.tones.primary.base,
      },
    ]
    const startY = y + pad + 48
    const rowStep = Math.floor((h - pad * 2 - 48) / bars.length)
    bars.forEach((b, i) => {
      const ry = startY + i * rowStep
      ctx.save()
      ctx.textBaseline = 'top'
      ctx.font = `600 16px ${fonts.sans}`
      ctx.fillStyle = palette.muted
      ctx.fillText(b.label, x + pad, ry)
      ctx.font = `700 17px ${fonts.display}`
      ctx.fillStyle = palette.foreground
      ctx.textAlign = 'right'
      ctx.fillText(b.value, x + pad + innerW, ry - 1)
      ctx.restore()
      drawProgressTrack(ctx, x + pad, ry + 26, innerW, 12, b.ratio, palette.surfaceSunken, b.color)
    })
    return
  }

  if (mod === 'exercise') {
    const load = num(m.load, 0)
    const kcal = num(m.kcal, 0)
    const minutes = num(m.minutes, 0)
    drawSectionHeader(
      ctx,
      x + pad,
      y + pad,
      '整体训练负荷',
      palette.tones.exercise.base,
      `相对负荷 ${Math.round(load * 100)}%`,
      palette,
      fonts,
      innerW,
    )
    const rows = [
      {
        label: '总运动时长',
        value: `${minutes} 分钟`,
        ratio: minutes / 45,
        color: palette.tones.exercise.base,
      },
      {
        label: '总估算消耗',
        value: `${kcal} kcal`,
        ratio: kcal / 400,
        color: palette.tones.diet.base,
      },
      {
        label: '相对训练负荷',
        value: `${Math.round(load * 100)}%`,
        ratio: load,
        color: load >= 0.7 ? palette.tones.warning.base : palette.tones.success.base,
      },
    ]
    rows.forEach((r, i) => {
      const ry = y + pad + 56 + i * 86
      ctx.save()
      ctx.textBaseline = 'top'
      ctx.font = `600 17px ${fonts.sans}`
      ctx.fillStyle = palette.muted
      ctx.fillText(r.label, x + pad, ry)
      ctx.font = `700 20px ${fonts.display}`
      ctx.fillStyle = palette.foreground
      ctx.textAlign = 'right'
      ctx.fillText(r.value, x + pad + innerW, ry - 2)
      ctx.restore()
      drawProgressTrack(ctx, x + pad, ry + 32, innerW, 14, r.ratio, palette.surfaceSunken, r.color)
    })
    return
  }

  if (mod === 'sleep') {
    const adv = input.subject.module === 'sleep' ? input.subject.advanced : undefined
    const minutes = num(m.minutes, 0)
    drawSectionHeader(
      ctx,
      x + pad,
      y + pad,
      '睡眠质量与分期',
      palette.tones.sleep.base,
      adv ? '手环估算' : '基础指标',
      palette,
      fonts,
      innerW,
    )
    const tiles = [
      { label: '总睡眠时长', value: `${num(m.hours)} 小时` },
      { label: '深睡时长', value: adv?.deepMin != null ? `${adv.deepMin} 分钟` : '未填写' },
      {
        label: '浅睡 / REM',
        value:
          adv?.remPct != null
            ? `REM ${adv.remPct}%`
            : adv?.lightMin != null
              ? `${adv.lightMin} 分钟`
              : '未填写',
      },
      { label: 'HRV 心率变异', value: adv?.hrvMs != null ? `${adv.hrvMs} ms` : `${minutes} 分钟` },
    ]
    const gap = 14
    const tw = (innerW - gap) / 2
    const th = 112
    tiles.forEach((t, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const tx = x + pad + col * (tw + gap)
      const ty = y + pad + 54 + row * (th + gap)
      fillCard(ctx, tx, ty, tw, th, 18, { fill: palette.surfaceSunken, stroke: palette.border })
      ctx.save()
      ctx.textBaseline = 'top'
      ctx.font = `600 15px ${fonts.sans}`
      ctx.fillStyle = palette.muted
      ctx.fillText(t.label, tx + 16, ty + 18)
      ctx.font = `700 24px ${fonts.display}`
      ctx.fillStyle = palette.foreground
      ctx.fillText(t.value, tx + 16, ty + 52)
      ctx.restore()
    })
    return
  }

  if (mod === 'study') {
    const before = num(m.todayMinutesBefore, 0)
    const cur = num(m.minutes, 0)
    const total = num(m.totalMinutes, before + cur)
    drawSectionHeader(
      ctx,
      x + pad,
      y + pad,
      '番茄钟累计进度',
      palette.tones.study.base,
      `累计 ${total} 分钟`,
      palette,
      fonts,
      innerW,
    )
    const rows = [
      {
        label: '今日之前累计',
        value: `${before} 分钟`,
        ratio: before / 60,
        color: palette.tones.primary.base,
      },
      {
        label: '本次专注时长',
        value: `${cur} 分钟`,
        ratio: cur / 45,
        color: palette.tones.study.base,
      },
      {
        label: '今日总专注',
        value: `${total} 分钟`,
        ratio: total / 25,
        color: palette.tones.success.base,
      },
    ]
    rows.forEach((r, i) => {
      const ry = y + pad + 56 + i * 86
      ctx.save()
      ctx.textBaseline = 'top'
      ctx.font = `600 17px ${fonts.sans}`
      ctx.fillStyle = palette.muted
      ctx.fillText(r.label, x + pad, ry)
      ctx.font = `700 20px ${fonts.display}`
      ctx.fillStyle = palette.foreground
      ctx.textAlign = 'right'
      ctx.fillText(r.value, x + pad + innerW, ry - 2)
      ctx.restore()
      drawProgressTrack(ctx, x + pad, ry + 32, innerW, 14, r.ratio, palette.surfaceSunken, r.color)
    })
    return
  }

  // custom
  const facts = input.verdict.facts?.module === 'custom' ? input.verdict.facts : null
  drawSectionHeader(
    ctx,
    x + pad,
    y + pad,
    '裁判点评与备注',
    palette.tones.custom.base,
    null,
    palette,
    fonts,
    innerW,
  )
  const copy =
    facts?.aiComment || (input.subject.note ? `备注：${input.subject.note}` : input.verdict.detail)
  ctx.save()
  ctx.font = `500 18px ${fonts.sans}`
  ctx.fillStyle = palette.foreground
  ctx.textBaseline = 'top'
  const lines = wrapTextLines(ctx, copy, innerW, 6)
  lines.forEach((line, idx) => {
    ctx.fillText(line, x + pad, y + pad + 58 + idx * 34)
  })
  ctx.restore()
}

/** 下右卡：所有板块统一的裁判核验清单 */
function drawChecksCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  input: ReportPosterInput,
  palette: PosterPalette,
  fonts: { sans: string; display: string },
) {
  fillCard(ctx, x, y, w, h, 28, {
    fill: palette.surface,
    stroke: palette.border,
    shadow: true,
  })
  const pad = 26
  const innerW = w - pad * 2
  const checks = input.verdict.checks
  const okCount = checks.filter((c) => c.ok).length

  drawSectionHeader(
    ctx,
    x + pad,
    y + pad,
    '裁判核验清单',
    palette.tones.success.base,
    `${okCount} / ${checks.length} 项通过`,
    palette,
    fonts,
    innerW,
  )

  const maxVisible = Math.min(checks.length, 5)
  const startY = y + pad + 48
  const slotH = Math.floor((h - pad * 2 - 48) / Math.max(1, maxVisible))

  for (let i = 0; i < maxVisible; i++) {
    const c = checks[i]!
    const cy = startY + i * slotH
    const badgeColor = c.ok ? palette.tones.success : palette.tones.warning

    ctx.save()
    // 圆形勾选/提醒徽标
    ctx.beginPath()
    ctx.arc(x + pad + 13, cy + 16, 13, 0, Math.PI * 2)
    ctx.fillStyle = badgeColor.soft
    ctx.fill()
    ctx.strokeStyle = badgeColor.ink
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (c.ok) {
      ctx.beginPath()
      ctx.moveTo(x + pad + 7.5, cy + 16.5)
      ctx.lineTo(x + pad + 11.5, cy + 20.5)
      ctx.lineTo(x + pad + 19, cy + 12)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.moveTo(x + pad + 13, cy + 10)
      ctx.lineTo(x + pad + 13, cy + 17.5)
      ctx.stroke()
      ctx.fillStyle = badgeColor.ink
      ctx.beginPath()
      ctx.arc(x + pad + 13, cy + 21.5, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.font = `600 16px ${fonts.sans}`
    ctx.fillStyle = palette.foreground
    ctx.textBaseline = 'top'
    const lines = wrapTextLines(ctx, c.text, innerW - 40, 2)
    lines.forEach((line, li) => {
      ctx.fillText(line, x + pad + 38, cy + 4 + li * 22)
    })
    ctx.restore()
  }
}

// ---------------------------------------------------------------------------
// 主入口：渲染 16:9 横版（1920×1080）或 9:16 竖版（1080×1920）PNG 海报
// ---------------------------------------------------------------------------

export async function renderReportPosterPng(input: ReportPosterInput): Promise<{
  blob: Blob
  dataUrl: string
  width: number
  height: number
}> {
  if (typeof document === 'undefined') {
    throw new Error('海报渲染仅支持在浏览器环境执行')
  }
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => undefined)
  }

  const orientation: PosterOrientation = input.orientation ?? 'landscape'
  const width = orientation === 'landscape' ? 1920 : 1080
  const height = orientation === 'landscape' ? 1080 : 1920

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持 Canvas 2D 渲染')

  const palette = readPaletteFromDom()
  const fonts = getFontStacks()
  const accent = palette.tones[input.module]
  const promoUrl = input.promoUrl ?? DEFAULT_PROMO_URL
  const dayMeals =
    input.module === 'diet'
      ? collectDayDietMeals(input.verdict, input.subject, input.todayCheckins)
      : []
  const hero = buildHeroContent(input, dayMeals)

  const logoSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg('full', 'rounded'))}`
  const [logoImg, mascotImg] = await Promise.all([
    loadImage(logoSrc),
    input.mascotDataUrl ? loadImage(input.mascotDataUrl) : Promise.resolve(null),
  ])

  drawJournalBackground(ctx, width, height, palette, accent)

  if (orientation === 'landscape') {
    renderLandscapeSpread(ctx, {
      width,
      height,
      input,
      palette,
      fonts,
      accent,
      hero,
      dayMeals,
      logoImg,
      mascotImg,
      promoUrl,
    })
  } else {
    renderPortraitPoster(ctx, {
      width,
      height,
      input,
      palette,
      fonts,
      accent,
      hero,
      dayMeals,
      logoImg,
      mascotImg,
      promoUrl,
    })
  }

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('PNG 导出失败'))
    }, 'image/png')
  })
  return { blob, dataUrl, width, height }
}

interface LayoutRenderArgs {
  width: number
  height: number
  input: ReportPosterInput
  palette: PosterPalette
  fonts: { sans: string; display: string }
  accent: PaletteColor
  hero: HeroContent
  dayMeals: DietReportMeal[]
  logoImg: HTMLImageElement | null
  mascotImg: HTMLImageElement | null
  promoUrl: string
}

/** 16:9 横屏「摊开的手账跨页」构图（1920 × 1080） */
function renderLandscapeSpread(ctx: CanvasRenderingContext2D, args: LayoutRenderArgs) {
  const { width, input, palette, fonts, accent, hero, dayMeals, logoImg, mascotImg, promoUrl } =
    args

  // 1. 顶部眉栏 (y: 44..108)
  if (logoImg) {
    ctx.drawImage(logoImg, 52, 46, 52, 52)
  }
  ctx.save()
  ctx.textBaseline = 'middle'
  ctx.font = `700 30px ${fonts.display}`
  ctx.fillStyle = palette.foreground
  ctx.fillText('DayDayOn', 118, 72)
  const brandW = ctx.measureText('DayDayOn').width

  // 竖分隔线
  ctx.fillStyle = palette.borderStrong
  ctx.fillRect(134 + brandW, 56, 2, 32)
  ctx.restore()

  drawPill(ctx, 154 + brandW, 53, hero.moduleBadge, {
    bg: accent.soft,
    fg: accent.ink,
    font: `700 18px ${fonts.sans}`,
    padX: 18,
    height: 38,
  })

  // 右上日期与周期徽章
  const periodW = drawPill(
    ctx,
    width - 52,
    53,
    `坚持进度 DAY ${input.period.done} / ${input.period.total}`,
    {
      bg: palette.primary.soft,
      fg: palette.primary.ink,
      font: `700 17px ${fonts.display}`,
      padX: 18,
      height: 38,
      alignRight: true,
    },
  )
  drawPill(ctx, width - 52 - periodW - 12, 53, formatDateCn(input.today), {
    bg: palette.surface,
    fg: palette.muted,
    font: `600 17px ${fonts.sans}`,
    padX: 18,
    height: 38,
    border: palette.border,
    alignRight: true,
  })

  // 2. 左栏：仪式与核心结论英雄卡 (x: 52, y: 124, w: 632, h: 774)
  const lx = 52
  const ly = 124
  const lw = 632
  const lh = 774
  fillCard(ctx, lx, ly, lw, lh, 32, {
    fill: palette.surface,
    stroke: palette.border,
    shadow: true,
    topBarColor: accent.base,
  })

  // 标题 + 状态徽章
  ctx.save()
  ctx.textBaseline = 'top'
  ctx.font = `700 34px ${fonts.sans}`
  ctx.fillStyle = palette.foreground
  ctx.fillText(truncateText(ctx, input.goal.title, lw - 210), lx + 34, ly + 36)
  ctx.restore()

  const statusTone = palette.tones[hero.statusBadge.tone]
  drawPill(ctx, lx + 34, ly + 86, hero.statusBadge.text, {
    bg: statusTone.soft,
    fg: statusTone.ink,
    font: `700 16px ${fonts.sans}`,
    padX: 16,
    height: 34,
  })

  // 右上倾斜手账印章
  drawJournalStamp(
    ctx,
    lx + lw - 96,
    ly + 100,
    64,
    hero.stampMain,
    hero.stampSub,
    palette.tones[hero.stampTone].ink,
    fonts,
  )

  // 中央超大主指标舞台
  const stageX = lx + 32
  const stageY = ly + 154
  const stageW = lw - 64
  const stageH = 296
  fillCard(ctx, stageX, stageY, stageW, stageH, 26, {
    fill: accent.soft,
    stroke: `${accent.base}88`,
    lineWidth: 2,
  })

  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 96px ${fonts.display}`
  ctx.fillStyle = accent.ink
  ctx.fillText(hero.kpiValue, stageX + 34, stageY + 132)
  const kpiW = ctx.measureText(hero.kpiValue).width
  ctx.font = `700 28px ${fonts.sans}`
  ctx.fillStyle = palette.muted
  ctx.fillText(hero.kpiUnit, stageX + 46 + kpiW, stageY + 126)

  ctx.textBaseline = 'top'
  ctx.font = `700 22px ${fonts.sans}`
  ctx.fillStyle = palette.foreground
  ctx.fillText(truncateText(ctx, hero.kpiSub, stageW - 68), stageX + 34, stageY + 162)
  ctx.restore()

  // 核心亮点小胶囊排布
  let pillCursor = stageX + 34
  for (const text of hero.highlightPills.slice(0, 3)) {
    const pw = drawPill(ctx, pillCursor, stageY + 220, text, {
      bg: palette.surface,
      fg: palette.foreground,
      font: `600 15px ${fonts.sans}`,
      padX: 14,
      height: 34,
      border: `${accent.base}55`,
    })
    pillCursor += pw + 10
    if (pillCursor > stageX + stageW - 80) break
  }

  // 左下：陪伴宠物 + 评语对话气泡
  const petZoneY = ly + 486
  if (mascotImg) {
    ctx.drawImage(mascotImg, lx + 26, petZoneY + 26, 154, 154)
  }

  const bubbleX = mascotImg ? lx + 190 : lx + 32
  const bubbleW = mascotImg ? lw - 222 : lw - 64
  const bubbleH = 250
  fillCard(ctx, bubbleX, petZoneY, bubbleW, bubbleH, 24, {
    fill: palette.surfaceSunken,
    stroke: palette.border,
  })

  ctx.save()
  ctx.textBaseline = 'top'
  ctx.font = `700 18px ${fonts.sans}`
  ctx.fillStyle = palette.primary.ink
  ctx.fillText(`${input.pet.name}的裁判评语`, bubbleX + 22, petZoneY + 20)

  ctx.font = `600 17px ${fonts.sans}`
  ctx.fillStyle = palette.foreground
  const detailLines = wrapTextLines(ctx, input.verdict.detail, bubbleW - 44, 3)
  detailLines.forEach((line, idx) => {
    ctx.fillText(line, bubbleX + 22, petZoneY + 54 + idx * 28)
  })

  if (input.verdict.advice.length > 0) {
    const advY = petZoneY + 54 + detailLines.length * 28 + 14
    ctx.beginPath()
    ctx.setLineDash([4, 4])
    ctx.moveTo(bubbleX + 22, advY - 6)
    ctx.lineTo(bubbleX + bubbleW - 22, advY - 6)
    ctx.strokeStyle = palette.borderStrong
    ctx.lineWidth = 1.2
    ctx.stroke()
    ctx.setLineDash([])

    ctx.font = `500 15px ${fonts.sans}`
    ctx.fillStyle = palette.muted
    const advLines = wrapTextLines(ctx, `小建议：${input.verdict.advice[0]}`, bubbleW - 44, 3)
    advLines.forEach((line, idx) => {
      ctx.fillText(line, bubbleX + 22, advY + 4 + idx * 24)
    })
  }
  ctx.restore()

  // 3. 右栏 Bento 区 (x: 708, y: 124, w: 1160, h: 774)
  const rx = 708
  const rw = width - rx - 52 // 1160
  const topH = 368
  const gap = 24
  const botY = ly + topH + gap
  const botH = lh - topH - gap // 382

  if (input.module === 'diet') {
    drawDietTopPanel(ctx, rx, ly, rw, topH, input, dayMeals, palette, fonts)
  } else if (input.module === 'exercise') {
    drawExerciseTopPanel(ctx, rx, ly, rw, topH, input, palette, fonts)
  } else if (input.module === 'sleep') {
    drawSleepTopPanel(ctx, rx, ly, rw, topH, input, palette, fonts)
  } else if (input.module === 'study') {
    drawStudyTopPanel(ctx, rx, ly, rw, topH, input, palette, fonts)
  } else {
    drawCustomTopPanel(ctx, rx, ly, rw, topH, input, palette, fonts)
  }

  const halfW = (rw - gap) / 2
  drawBottomLeftMetricsCard(ctx, rx, botY, halfW, botH, input, palette, fonts)
  drawChecksCard(ctx, rx + halfW + gap, botY, halfW, botH, input, palette, fonts)

  // 4. 底部手账签名与扫码推广条 (x: 52, y: 922, w: 1816, h: 112)
  const fx = 52
  const fy = 922
  const fw = width - 104
  const fh = 112
  fillCard(ctx, fx, fy, fw, fh, 26, {
    fill: palette.surface,
    stroke: palette.border,
    shadow: false,
  })

  ctx.save()
  ctx.textBaseline = 'top'
  ctx.font = `700 22px ${fonts.sans}`
  ctx.fillStyle = palette.foreground
  ctx.fillText(`和「${input.pet.name}」一起，把每天的坚持写成一本治愈手账`, fx + 32, fy + 26)
  ctx.font = `500 15px ${fonts.sans}`
  ctx.fillStyle = palette.muted
  ctx.fillText(
    'DayDayOn 多人互动打卡 · 科学裁判与习惯复盘（估算结果仅供参考，非医疗建议）',
    fx + 32,
    fy + 64,
  )

  // 右侧推广文案 + 真二维码
  const qrSize = 92
  const qrX = fx + fw - qrSize - 18
  const qrY = fy + Math.round((fh - qrSize) / 2)
  drawQrCode(ctx, promoUrl, qrX, qrY, qrSize, palette.foreground)

  ctx.textAlign = 'right'
  ctx.font = `700 21px ${fonts.sans}`
  ctx.fillStyle = palette.primary.ink
  ctx.fillText('扫码体验 DayDayOn', qrX - 20, fy + 27)
  ctx.font = `600 15px ${fonts.display}`
  ctx.fillStyle = palette.muted
  ctx.fillText(`长按识别或扫码打卡 · ${DEFAULT_PROMO_HOST}`, qrX - 20, fy + 62)
  ctx.restore()
}

/** 9:16 竖屏手账海报构图（1080 × 1920） */
function renderPortraitPoster(ctx: CanvasRenderingContext2D, args: LayoutRenderArgs) {
  const {
    width,
    height,
    input,
    palette,
    fonts,
    accent,
    hero,
    dayMeals,
    logoImg,
    mascotImg,
    promoUrl,
  } = args
  const padX = 48
  const contentW = width - padX * 2 // 984

  // 1. 顶部品牌与日期眉栏
  if (logoImg) {
    ctx.drawImage(logoImg, padX, 46, 50, 50)
  }
  ctx.save()
  ctx.textBaseline = 'middle'
  ctx.font = `700 28px ${fonts.display}`
  ctx.fillStyle = palette.foreground
  ctx.fillText('DayDayOn', padX + 64, 71)
  ctx.restore()

  drawPill(
    ctx,
    width - padX,
    52,
    `${formatDateCn(input.today)} · DAY ${input.period.done}/${input.period.total}`,
    {
      bg: palette.surface,
      fg: palette.muted,
      font: `600 16px ${fonts.sans}`,
      padX: 16,
      height: 36,
      border: palette.border,
      alignRight: true,
    },
  )

  // 2. 英雄大卡 (y: 120, h: 468)
  const heroY = 120
  const heroH = 468
  fillCard(ctx, padX, heroY, contentW, heroH, 32, {
    fill: palette.surface,
    stroke: palette.border,
    shadow: true,
    topBarColor: accent.base,
  })

  drawPill(ctx, padX + 32, heroY + 32, hero.moduleBadge, {
    bg: accent.soft,
    fg: accent.ink,
    font: `700 16px ${fonts.sans}`,
    padX: 14,
    height: 34,
  })

  ctx.save()
  ctx.textBaseline = 'top'
  ctx.font = `700 36px ${fonts.sans}`
  ctx.fillStyle = palette.foreground
  ctx.fillText(truncateText(ctx, input.goal.title, contentW - 220), padX + 32, heroY + 82)
  ctx.restore()

  drawJournalStamp(
    ctx,
    padX + contentW - 92,
    heroY + 96,
    62,
    hero.stampMain,
    hero.stampSub,
    palette.tones[hero.stampTone].ink,
    fonts,
  )

  // 中央主数字 + 宠物并排
  const stageY = heroY + 146
  fillCard(ctx, padX + 32, stageY, contentW - 64, 184, 24, {
    fill: accent.soft,
    stroke: `${accent.base}88`,
    lineWidth: 2,
  })
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 84px ${fonts.display}`
  ctx.fillStyle = accent.ink
  ctx.fillText(hero.kpiValue, padX + 64, stageY + 112)
  const kw = ctx.measureText(hero.kpiValue).width
  ctx.font = `700 26px ${fonts.sans}`
  ctx.fillStyle = palette.muted
  ctx.fillText(hero.kpiUnit, padX + 76 + kw, stageY + 106)
  ctx.textBaseline = 'top'
  ctx.font = `700 20px ${fonts.sans}`
  ctx.fillStyle = palette.foreground
  ctx.fillText(truncateText(ctx, hero.kpiSub, contentW - 260), padX + 64, stageY + 132)
  ctx.restore()
  if (mascotImg) {
    ctx.drawImage(mascotImg, padX + contentW - 188, stageY + 18, 146, 146)
  }

  // 一句话评语条
  fillCard(ctx, padX + 32, heroY + 350, contentW - 64, 92, 20, {
    fill: palette.surfaceSunken,
    stroke: palette.border,
  })
  ctx.save()
  ctx.textBaseline = 'top'
  ctx.font = `600 17px ${fonts.sans}`
  ctx.fillStyle = palette.foreground
  const detailLines = wrapTextLines(
    ctx,
    `${input.pet.name}：${input.verdict.detail}`,
    contentW - 104,
    2,
  )
  detailLines.forEach((line, idx) => {
    ctx.fillText(line, padX + 52, heroY + 370 + idx * 28)
  })
  ctx.restore()

  // 3. 板块专属结构化面板 (y: 612, h: 420)
  const topY = 612
  const topH = 420
  if (input.module === 'diet') {
    drawDietTopPanel(ctx, padX, topY, contentW, topH, input, dayMeals, palette, fonts)
  } else if (input.module === 'exercise') {
    drawExerciseTopPanel(ctx, padX, topY, contentW, topH, input, palette, fonts)
  } else if (input.module === 'sleep') {
    drawSleepTopPanel(ctx, padX, topY, contentW, topH, input, palette, fonts)
  } else if (input.module === 'study') {
    drawStudyTopPanel(ctx, padX, topY, contentW, topH, input, palette, fonts)
  } else {
    drawCustomTopPanel(ctx, padX, topY, contentW, topH, input, palette, fonts)
  }

  // 4. 中下双列 Bento 区 (y: 1056, h: 636) — 依然保持双栏海报质感，非单列长截屏！
  const botY = 1056
  const botH = 636
  const gap = 22
  const halfW = (contentW - gap) / 2
  drawBottomLeftMetricsCard(ctx, padX, botY, halfW, botH, input, palette, fonts)
  drawChecksCard(ctx, padX + halfW + gap, botY, halfW, botH, input, palette, fonts)

  // 5. 底部扫码推广卡 (y: 1716, h: 156)
  const fy = height - 204
  const fh = 156
  fillCard(ctx, padX, fy, contentW, fh, 28, {
    fill: palette.surface,
    stroke: palette.border,
  })
  const qrSize = 124
  const qrX = padX + contentW - qrSize - 20
  const qrY = fy + Math.round((fh - qrSize) / 2)
  drawQrCode(ctx, promoUrl, qrX, qrY, qrSize, palette.foreground)

  ctx.save()
  ctx.textBaseline = 'top'
  ctx.font = `700 26px ${fonts.sans}`
  ctx.fillStyle = palette.primary.ink
  ctx.fillText('扫码体验 DayDayOn', padX + 30, fy + 30)
  ctx.font = `600 18px ${fonts.sans}`
  ctx.fillStyle = palette.foreground
  ctx.fillText(`和「${input.pet.name}」一起把坚持写成治愈手账`, padX + 30, fy + 70)
  ctx.font = `500 15px ${fonts.display}`
  ctx.fillStyle = palette.muted
  ctx.fillText(`${DEFAULT_PROMO_HOST} · 估算结果仅供参考`, padX + 30, fy + 106)
  ctx.restore()
}
