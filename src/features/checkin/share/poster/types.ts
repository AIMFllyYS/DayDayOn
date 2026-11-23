import type { PosterOrientation } from '@/components/ui/report-share-sheet'
import type { ModuleTone, Tone } from '@/components/ui/tone'
import type { MascotRegistryCharacter } from '@/features/me/schemas'
import type { Verdict } from '@/features/referee/schemas'
import type { CheckinGoal } from '../../components/form-types'
import type { Checkin, CreateCheckinInput } from '../../schemas'
import type { PosterModel } from './model'

/* 分享海报引擎的公共类型：入参、调色板与各场景共用的画笔上下文。 */

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

export interface PaletteColor {
  base: string
  soft: string
  ink: string
}

export interface PosterPalette {
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

export interface PosterFonts {
  sans: string
  display: string
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 一次渲染的全部上下文：场景函数只读它，不自己取 DOM */
export interface Painter {
  ctx: CanvasRenderingContext2D
  W: number
  H: number
  portrait: boolean
  input: ReportPosterInput
  model: PosterModel
  palette: PosterPalette
  fonts: PosterFonts
  /** 当前板块色 */
  accent: PaletteColor
  logoImg: HTMLImageElement | null
  mascotImg: HTMLImageElement | null
  promoUrl: string
}

/** 板块场景：横版与竖版各一套专属构图 */
export interface PosterScene {
  landscape: (p: Painter) => void
  portrait: (p: Painter) => void
}
