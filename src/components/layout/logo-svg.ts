/*
 * DayDayOn 的 Logo（ADR-0022）：全站唯一的图标源，标签页图标、App 图标、PWA 图标、界面里的 BrandMark 都从这里生成。
 * 纯字符串、不依赖 React，Route Handler（PNG / SVG 输出）和组件都能用。
 *
 * 两种构图：
 * - full：团团和墩墩肩并肩，中间一颗小爱心 —— "和朋友一起"。用于 ≥ 96px 的 App 图标。
 * - mark：只放团团的大头 —— 16–48px 也认得出。用于标签页图标和界面里的品牌标识。
 * 三种外形：
 * - rounded：圆角方块（浏览器、PWA 的 purpose: any）
 * - square：满版方块，留白放大（iOS 自己切圆角、PWA 的 maskable）
 * - foreground：透明底、内容缩进到中间 66%（Android 自适应图标的前景层，背景层用 LOGO_BG）
 *
 * 颜色写死是插画专用色（同 mascot-svg.tsx）：底色取默认主题奶茶焦糖的 primary，不随用户主题变，
 * 图标是项目身份，桌面上不能今天棕明天绿。团子的颜色与 mascot-svg.tsx 一致。
 * 只用纯色、不用渐变：小尺寸更清楚，同一页面放多个也不会有重复的渐变 id。
 */

/** 图标底色：奶茶焦糖 primary（globals.css 的 --primary 默认值） */
export const LOGO_BG = '#93603f'
/** 底色上的点阵：手账纸的点 */
const DOT = '#fffaf3'
const INK = '#4a3f35'
const SKIN = '#fff6ea'
const SKIN_LINE = '#e1c6a8'
const BLUSH = '#f4a091'
const LEAF = '#7cc9a6'
const LEAF_DARK = '#3f8a69'
const RIBBON = '#f2a0b8'
const RIBBON_LINE = '#d97c97'
const CAP = '#86bde8'
const CAP_LINE = '#4f78a3'
const STAR = '#f5c95e'
const HEART = '#f2a0b8'

export type LogoVariant = 'full' | 'mark'
export type LogoShape = 'rounded' | 'square' | 'foreground'

/* 以下坐标都在吉祥物自己的 160×160 画布里（与 mascot-svg.tsx 相同），外面再 transform 缩放 */

const BODY = 'M80 30c31 0 54 25 54 58 0 28-23 46-54 46S26 116 26 88c0-33 23-58 54-58Z'

function face(): string {
  return [
    // 腮红
    `<ellipse cx="47" cy="94" rx="10" ry="6.5" fill="${BLUSH}" opacity="0.75"/>`,
    `<ellipse cx="113" cy="94" rx="10" ry="6.5" fill="${BLUSH}" opacity="0.75"/>`,
    // 眼睛 + 高光
    `<ellipse cx="60" cy="80" rx="7" ry="8.6" fill="${INK}"/>`,
    `<ellipse cx="100" cy="80" rx="7" ry="8.6" fill="${INK}"/>`,
    `<circle cx="62.4" cy="76.8" r="2.6" fill="#fff"/>`,
    `<circle cx="102.4" cy="76.8" r="2.6" fill="#fff"/>`,
    // 猫猫嘴
    `<path d="M72 95q4 4.5 8 0 4 4.5 8 0" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`,
  ].join('')
}

function body(): string {
  return [
    `<path d="${BODY}" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="3"/>`,
    // 左上的一抹高光，糯米团子的光泽
    `<ellipse cx="57" cy="52" rx="13" ry="7" fill="#fff" opacity="0.9" transform="rotate(-28 57 52)"/>`,
  ].join('')
}

/** 团团：头顶两片圆叶小芽 + 右上的樱花粉蝴蝶结 */
function tuanHead(): string {
  return [
    `<path d="M78 31c-.4-5 .4-9 2.6-12" fill="none" stroke="${LEAF_DARK}" stroke-width="3.4" stroke-linecap="round"/>`,
    `<path d="M80.6 19c1-6.5 7.5-10 13.5-8.5-.6 6.5-7.5 10.5-13.5 8.5Z" fill="${LEAF}" stroke="${LEAF_DARK}" stroke-width="1.4"/>`,
    `<path d="M79.6 20.5c-3.2-5.6-9.8-7.2-14.6-4.4 2.6 5.4 9.4 7.6 14.6 4.4Z" fill="${LEAF}" stroke="${LEAF_DARK}" stroke-width="1.4"/>`,
    `<g transform="translate(104 35) rotate(16)" fill="${RIBBON}" stroke="${RIBBON_LINE}" stroke-width="1.8" stroke-linejoin="round">`,
    `<path d="M0 0C-4-9-16-13-19.5-5.5-21.5-.5-16 7 0 2.5Z"/>`,
    `<path d="M0 0C4-9 16-13 19.5-5.5 21.5-.5 16 7 0 2.5Z"/>`,
    `<ellipse cx="0" cy="1.2" rx="3.8" ry="4.4" fill="#e889a4"/>`,
    `</g>`,
  ].join('')
}

/** 墩墩：雾蓝棒球帽（帽檐朝右）+ 黄色小星星 + 短粗眉毛 */
function dunHead(): string {
  return [
    `<path d="M102 45.5c13-3.6 26-2.2 34 3.4-6.6 6.2-20.4 7.4-33 4Z" fill="#6f9bc8" stroke="${CAP_LINE}" stroke-width="2.2" stroke-linejoin="round"/>`,
    `<path d="M45 50c-1-17 14-29 35-29s36 12 35 29c-21-6.6-49-6.6-70 0Z" fill="${CAP}" stroke="${CAP_LINE}" stroke-width="2.4" stroke-linejoin="round"/>`,
    `<circle cx="80" cy="21.6" r="3" fill="${CAP_LINE}"/>`,
    `<path d="m64 37.5 1.3 2.7 3 .4-2.2 2 .6 3-2.7-1.4-2.7 1.4.6-3-2.2-2 3-.4z" fill="${STAR}" stroke="#d9a93a" stroke-width="0.9"/>`,
    `<path d="M53 66.5q6-3 12.5-1.2M94.5 65.3q6.5-1.8 12.5 1.2" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`,
  ].join('')
}

function mochi(head: string, transform: string): string {
  return `<g transform="${transform}">${body()}${head}${face()}</g>`
}

/** 两只肩并肩，内容框约 x 98–414、y 150–376（512 画布），视觉居中 */
function fullArt(): string {
  return [
    `<ellipse cx="256" cy="362" rx="150" ry="14" fill="${INK}" opacity="0.18"/>`,
    mochi(dunHead(), 'translate(60 166) scale(1.45)'),
    mochi(tuanHead(), 'translate(220 166) scale(1.45)'),
    // 两颗头之间的小爱心
    `<path d="M256 184s-17-9.6-17-21.4a9 9 0 0 1 17-4.6 9 9 0 0 1 17 4.6c0 11.8-17 21.4-17 21.4Z" fill="${HEART}" stroke="#fffaf3" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/>`,
  ].join('')
}

/** 团团的大头，内容框约 x 94–418、y 60–432（512 画布） */
function markArt(): string {
  return mochi(tuanHead(), 'translate(16 34) scale(3)')
}

/** 内容在 512 画布里的居中缩放比例：maskable 安全区是中间 80% 的圆，自适应图标前景是中间 66% */
const contentScale: Record<LogoShape, number> = { rounded: 1, square: 0.86, foreground: 0.66 }

function dots(): string {
  // 手账点阵：6×6 个小点，避开中心，只在四周隐约可见
  const out: string[] = []
  for (let i = 0; i < 6; i += 1) {
    for (let j = 0; j < 6; j += 1) {
      out.push(`<circle cx="${56 + i * 80}" cy="${56 + j * 80}" r="5"/>`)
    }
  }
  return `<g fill="${DOT}" opacity="0.14">${out.join('')}</g>`
}

/** 生成完整的 SVG 文档（viewBox 512×512，不带宽高，由使用方决定尺寸） */
export function logoSvg(variant: LogoVariant, shape: LogoShape = 'rounded'): string {
  const s = contentScale[shape]
  const art = variant === 'full' ? fullArt() : markArt()
  const bg =
    shape === 'foreground'
      ? ''
      : shape === 'square'
        ? `<rect width="512" height="512" fill="${LOGO_BG}"/>${dots()}`
        : `<rect width="512" height="512" rx="116" fill="${LOGO_BG}"/>${dots()}`
  const offset = 256 * (1 - s)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    bg +
    `<g transform="translate(${offset} ${offset}) scale(${s})">${art}</g>` +
    `</svg>`
  )
}

/** data URI，给 ImageResponse 的 <img> 用（SVG 全是 ASCII，btoa 前后端都能用） */
export function logoDataUri(variant: LogoVariant, shape: LogoShape = 'rounded'): string {
  return `data:image/svg+xml;base64,${btoa(logoSvg(variant, shape))}`
}
