import { logoSvg } from '@/components/layout/logo-svg'
import { drawBackdrop, drawBrandBar, drawFooter, PROMO_HOST } from './poster/blocks'
import { buildPosterModel } from './poster/model'
import { getFontStacks, readPaletteFromDom } from './poster/palette'
import { POSTER_SCENES, skipScene } from './poster/scenes'
import type { Painter, PosterOrientation, ReportPosterInput } from './poster/types'

/*
 * 原生 Canvas 2D 打卡分享海报引擎（零第三方库依赖）。
 * - 16:9 横版（1920 × 1080）与 9:16 竖版（1080 × 1920）各有一套专属构图；
 * - 每个板块是一件和打卡内容有关的「手账实物」，版式互不相同（poster/scenes/）：
 *   饮食 = 小食堂小票 + 餐盘，运动 = 号码布 + 跑道，睡眠 = 夜空星图，
 *   学习 = 活页笔记 + 番茄钟，自定义 = 票根 + 集章卡，跳过打卡 = 请假条；
 * - 底纸、眉栏、宠物评语、裁判核验、扫码页脚是共用版块（poster/blocks.ts），
 *   颜色只读 globals.css 的 token（poster/palette.ts），数据整形在 poster/model.ts。
 */

export type { PosterOrientation, ReportPosterInput }

export const DEFAULT_PROMO_URL = 'https://daydayon.husteread.com/'
export const DEFAULT_PROMO_HOST = PROMO_HOST

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

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
  const logoSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg('full', 'rounded'))}`
  const [logoImg, mascotImg] = await Promise.all([
    loadImage(logoSrc),
    input.mascotDataUrl ? loadImage(input.mascotDataUrl) : Promise.resolve(null),
  ])
  const model = buildPosterModel(input)
  const painter: Painter = {
    ctx,
    W: width,
    H: height,
    portrait: orientation === 'portrait',
    input,
    model,
    palette,
    fonts: getFontStacks(),
    accent: palette.tones[input.module],
    logoImg,
    mascotImg,
    promoUrl: input.promoUrl ?? DEFAULT_PROMO_URL,
  }

  drawBackdrop(painter)
  drawBrandBar(painter)
  const scene = model.status.kind === 'skipped' ? skipScene : POSTER_SCENES[input.module]
  scene[orientation](painter)
  drawFooter(painter)

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('PNG 导出失败'))
    }, 'image/png')
  })
  return { blob, dataUrl, width, height }
}
