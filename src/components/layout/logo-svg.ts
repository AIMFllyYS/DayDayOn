/*
 * DayDayOn 的 Logo（ADR-0022）：全站唯一的图标源，标签页图标、App 图标、PWA 图标、界面里的 BrandMark 都从这里生成。
 * 纯字符串、不依赖 React，Route Handler（PNG / SVG 输出）和组件都能用。
 *
 * 核心方案：【05 连击热力·五彩织锦 (Streak Heatmap & Mosaic)】
 * - 寓意：运动、饮食、睡眠、学习四大板块环抱，中心汇聚成持续点亮的连击火种（Streak Core），
 *   象征日日平衡、丰盈生长。
 *
 * 两种构图：
 * - full：四色板块圆角积木 + 内部象形印 + 中心双层连击火种 + 晨星微尘。用于 ≥ 96px 的 App 图标 / PWA 图标 / APK 壳。
 * - mark：强化色块对比与线条厚度，去除边缘细微杂点，放大中心火核。用于 16–48px 标签页图标（Favicon）和 BrandMark。
 * 三种外形：
 * - rounded：圆角方块（浏览器、PWA 的 purpose: any）
 * - square：满版方块，内容留白放大（iOS 自己切圆角、PWA 的 maskable）
 * - foreground：透明底、内容缩进到中间 66%（Android 自适应图标的前景层，背景层用 LOGO_BG）
 *
 * 备用方案：【08 信笺、纸飞机与朋友的回音 (Paper Plane & Resonance)】
 * - paperPlaneSvg() 导出给 Playbook 及社交动态/打卡分享等场景备用。
 */

/** 图标底色：温润奶油手账纸色（globals.css 的 --background 默认值） */
export const LOGO_BG = '#fff8f0'
/** 晨阳奶油深层过渡与描边色 */
const BORDER_WARM = '#eadccb'
const BORDER_STRONG = '#dcc8b2'

/** 五大板块专用品牌色与高光色 */
const EXERCISE_BASE = '#7cc9a6'
const EXERCISE_LIGHT = '#a5f0c8'
const DIET_BASE = '#f5c95e'
const DIET_LIGHT = '#ffea9f'
const STUDY_BASE = '#86bde8'
const STUDY_LIGHT = '#bde0fa'
const SLEEP_BASE = '#a99de6'
const SLEEP_LIGHT = '#d2cbf7'

/** 中心连击火核色彩 */
const FLAME_ORANGE = '#f26829'
const FLAME_GOLD = '#ffa238'
const FLAME_WHITE = '#ffffff'

/** 手账底纸点阵与暖墨色 */
const INK_SHADOW = '#553c2a'

export type LogoVariant = 'full' | 'mark'
export type LogoShape = 'rounded' | 'square' | 'foreground'

/** 内容在 512 画布里的居中缩放比例：maskable 安全区是中间 80% 的圆，自适应图标前景是中间 66% */
const contentScale: Record<LogoShape, number> = { rounded: 1, square: 0.86, foreground: 0.66 }

/** 手账点阵装饰（4个角落优雅退后） */
function dots(): string {
  const pts = [
    [76, 76],
    [126, 76],
    [76, 126],
    [436, 76],
    [386, 76],
    [436, 126],
    [76, 436],
    [126, 436],
    [76, 386],
    [436, 436],
    [386, 436],
    [436, 386],
  ]
  return `<g fill="${BORDER_STRONG}" opacity="0.3">${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5"/>`).join('')}</g>`
}

/** 05 方案：四色板块积木与中心火核 */
function mosaicArt(isMark: boolean): string {
  // mark 模式在极小尺寸（16/32px）下更紧凑、轮廓更醒目
  const scale = isMark ? 1.14 : 1
  const offset = 256 * (1 - scale)

  // 内部象形印：运动小叶/跑动弧、饮食微笑、学习对开书页、睡眠月牙
  const glyphs = isMark
    ? ''
    : [
        // 运动小跑动弧
        `<path d="M 152 186 C 160 166, 185 166, 198 186 C 185 193, 160 193, 152 186 Z" fill="#ffffff" opacity="0.8"/>`,
        // 饮食美味微笑
        `<path d="M 322 178 Q 337 192 352 178" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.85"/>`,
        // 学习展翅书页
        `<path d="M 154 344 Q 175 334 175 350 Q 175 334 196 344" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.85"/>`,
        // 睡眠安睡月牙
        `<path d="M 330 326 A 18 18 0 1 0 348 348 A 14 14 0 0 1 330 326 Z" fill="#ffffff" opacity="0.85"/>`,
      ].join('')

  // 外部微尘星屑（仅在 full 模式展示）
  const stardust = isMark
    ? ''
    : [
        `<circle cx="92" cy="74" r="5" fill="${EXERCISE_BASE}" opacity="0.75"/>`,
        `<circle cx="430" cy="86" r="7" fill="${DIET_BASE}" opacity="0.85"/>`,
        `<circle cx="436" cy="420" r="5.5" fill="${SLEEP_BASE}" opacity="0.75"/>`,
        `<circle cx="82" cy="426" r="6" fill="${STUDY_BASE}" opacity="0.75"/>`,
      ].join('')

  return [
    stardust,
    `<g transform="translate(${offset} ${offset}) scale(${scale})">`,
    // 整体微倾斜 -6 度，保持手账贴纸的活泼手作感
    `<g transform="rotate(-6 256 256)">`,
    // 柔和深色投影层（纯矢量，兼容 Satori ImageResponse）
    `<g fill="${INK_SHADOW}" opacity="0.12">`,
    `<rect x="110" y="120" width="130" height="130" rx="36"/>`,
    `<rect x="272" y="120" width="130" height="130" rx="36"/>`,
    `<rect x="110" y="282" width="130" height="130" rx="36"/>`,
    `<rect x="272" y="282" width="130" height="130" rx="36"/>`,
    `<circle cx="256" cy="266" r="62"/>`,
    `</g>`,

    // 1. 左上：运动（薄荷绿）
    `<rect x="110" y="110" width="130" height="130" rx="36" fill="${EXERCISE_BASE}"/>`,
    `<rect x="112" y="112" width="126" height="126" rx="34" fill="none" stroke="${EXERCISE_LIGHT}" stroke-width="3" stroke-opacity="0.6"/>`,

    // 2. 右上：饮食（黄油金）
    `<rect x="272" y="110" width="130" height="130" rx="36" fill="${DIET_BASE}"/>`,
    `<rect x="274" y="112" width="126" height="126" rx="34" fill="none" stroke="${DIET_LIGHT}" stroke-width="3" stroke-opacity="0.6"/>`,

    // 3. 左下：学习（天空蓝）
    `<rect x="110" y="272" width="130" height="130" rx="36" fill="${STUDY_BASE}"/>`,
    `<rect x="112" y="274" width="126" height="126" rx="34" fill="none" stroke="${STUDY_LIGHT}" stroke-width="3" stroke-opacity="0.6"/>`,

    // 4. 右下：睡眠（薰衣草紫）
    `<rect x="272" y="272" width="130" height="130" rx="36" fill="${SLEEP_BASE}"/>`,
    `<rect x="274" y="274" width="126" height="126" rx="34" fill="none" stroke="${SLEEP_LIGHT}" stroke-width="3" stroke-opacity="0.6"/>`,

    glyphs,

    // 5. 中心连击火核底盘
    `<circle cx="256" cy="256" r="62" fill="#fffdf9" stroke="${BORDER_WARM}" stroke-width="3.5"/>`,
    // 金黄火核外环
    `<circle cx="256" cy="256" r="48" fill="${FLAME_GOLD}"/>`,
    // 暖橙跳动主火苗
    `<circle cx="256" cy="256" r="38" fill="${FLAME_ORANGE}"/>`,
    // 核心耀眼白星芒
    `<polygon points="256,224 263,246 286,256 263,266 256,288 249,266 226,256 249,246" fill="${FLAME_WHITE}"/>`,
    `<circle cx="256" cy="256" r="5" fill="#ffeaa7"/>`,

    `</g>`,
    `</g>`,
  ].join('')
}

/** 官方完整 Logo SVG（viewBox 512×512，自适应容器） */
export function logoSvg(variant: LogoVariant, shape: LogoShape = 'rounded'): string {
  const s = contentScale[shape]
  const isMark = variant === 'mark'
  const art = mosaicArt(isMark)

  const bg =
    shape === 'foreground'
      ? ''
      : shape === 'square'
        ? `<rect width="512" height="512" fill="${LOGO_BG}"/>${dots()}`
        : [
            `<rect width="512" height="512" rx="116" fill="${LOGO_BG}"/>`,
            `<rect width="504" height="504" x="4" y="4" rx="112" fill="none" stroke="#ffffff" stroke-width="4" stroke-opacity="0.9"/>`,
            `<rect width="512" height="512" rx="116" fill="none" stroke="${BORDER_WARM}" stroke-width="2" stroke-opacity="0.6"/>`,
            dots(),
          ].join('')

  const offset = 256 * (1 - s)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    bg +
    `<g transform="translate(${offset} ${offset}) scale(${s})">${art}</g>` +
    `</svg>`
  )
}

/** data URI，给 ImageResponse 的 <img> 及 HTML 图标用 */
export function logoDataUri(variant: LogoVariant, shape: LogoShape = 'rounded'): string {
  return `data:image/svg+xml;base64,${btoa(logoSvg(variant, shape))}`
}

/**
 * 备选视觉资产：【08 信笺、纸飞机与朋友的回音 (Paper Plane & Resonance)】
 * 可用于 Playbook 演示、朋友动态投递、打卡分享或彩蛋徽章。
 */
export function paperPlaneSvg(size = 512): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">` +
    `<rect width="512" height="512" rx="116" fill="#e8f4fd"/>` +
    `<rect width="504" height="504" x="4" y="4" rx="112" fill="none" stroke="#ffffff" stroke-width="4" stroke-opacity="0.9"/>` +
    `<rect width="512" height="512" rx="116" fill="none" stroke="#bcd7eb" stroke-width="2" stroke-opacity="0.6"/>` +
    // 彩虹共振航线
    `<path d="M 80 430 Q 150 400 210 320 T 320 190" fill="none" stroke="${EXERCISE_BASE}" stroke-width="6" stroke-linecap="round" stroke-dasharray="10 14" opacity="0.8"/>` +
    `<path d="M 95 440 Q 165 410 225 330 T 335 200" fill="none" stroke="${DIET_BASE}" stroke-width="4" stroke-linecap="round" stroke-dasharray="8 12" opacity="0.8"/>` +
    `<path d="M 110 450 Q 180 420 240 340 T 350 210" fill="none" stroke="#f2a0b8" stroke-width="4" stroke-linecap="round" stroke-dasharray="8 12" opacity="0.7"/>` +
    // 纸飞机主体投影
    `<polygon points="380,126 130,336 210,351" fill="#4f799e" opacity="0.2"/>` +
    // 纸飞机机身各折面
    `<polygon points="390,110 140,320 220,335" fill="#8bbde3"/>` +
    `<polygon points="390,110 205,320 120,270" fill="#ffffff"/>` +
    `<line x1="390" y1="110" x2="205" y2="320" stroke="#ffffff" stroke-width="3"/>` +
    `<polygon points="390,110 350,300 240,330" fill="#fce1c6"/>` +
    `<line x1="390" y1="110" x2="240" y2="330" stroke="#fcd3aa" stroke-width="2.5"/>` +
    `<polygon points="390,110 240,330 215,325" fill="#7faecd"/>` +
    // 机翼上的小绿芽机徽
    `<g transform="translate(230, 245) rotate(40) scale(0.8)">` +
    `<path d="M 0 0 C -8 -16 -24 -14 -26 -2 C -18 3 -4 2 0 0 Z" fill="${EXERCISE_BASE}"/>` +
    `<path d="M 0 0 C 10 -18 26 -14 28 -2 C 20 4 6 2 0 0 Z" fill="#56ba8b"/>` +
    `<circle cx="0" cy="0" r="3" fill="#3d8a65"/>` +
    `</g>` +
    // 机头冲破的金色晨星
    `<g transform="translate(416, 90)">` +
    `<polygon points="0,-18 5,-5 18,0 5,5 0,18 -5,5 -18,0 -5,-5" fill="${FLAME_GOLD}"/>` +
    `<circle cx="0" cy="0" r="4.5" fill="#ffffff"/>` +
    `</g>` +
    // 晴空微鸟与微尘
    `<path d="M 380 180 Q 392 172 404 180 Q 416 172 428 180" fill="none" stroke="#689eca" stroke-width="3.5" stroke-linecap="round" opacity="0.6"/>` +
    `<circle cx="150" cy="140" r="4" fill="${FLAME_GOLD}" opacity="0.6"/>` +
    `<circle cx="120" cy="165" r="2.5" fill="${FLAME_GOLD}" opacity="0.4"/>` +
    `</svg>`
  )
}
