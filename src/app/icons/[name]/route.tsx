import { ImageResponse } from 'next/og'
import { notFound } from 'next/navigation'
import {
  logoDataUri,
  logoSvg,
  type LogoShape,
  type LogoVariant,
} from '@/components/layout/logo-svg'

/*
 * App 图标的全部尺寸（ADR-0022、pwa.md 第 1 节）：PWA manifest 引用，APK 打包时也从这里下载。
 * 构建时按 generateStaticParams 预渲染成静态文件，不占运行时。图标源只有 logo-svg.ts 一份。
 */

interface IconSpec {
  variant: LogoVariant
  shape: LogoShape
  /** null 表示输出 SVG 原文 */
  px: number | null
}

const ICONS: Record<string, IconSpec> = {
  // PWA：purpose any（圆角）与 maskable（满版，系统自己裁形状）
  'icon-192.png': { variant: 'full', shape: 'rounded', px: 192 },
  'icon-512.png': { variant: 'full', shape: 'rounded', px: 512 },
  'maskable-192.png': { variant: 'full', shape: 'square', px: 192 },
  'maskable-512.png': { variant: 'full', shape: 'square', px: 512 },
  // APK：Android 自适应图标前景层（背景层用纯色 LOGO_BG），以及应用商店展示用的 512 图
  'android-foreground-432.png': { variant: 'full', shape: 'foreground', px: 432 },
  // 矢量源文件，给 APK 工程转 VectorDrawable、做宣传图用
  'logo-full.svg': { variant: 'full', shape: 'rounded', px: null },
  'logo-mark.svg': { variant: 'mark', shape: 'rounded', px: null },
  'logo-full-foreground.svg': { variant: 'full', shape: 'foreground', px: null },
}

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }))
}

export async function GET(_req: Request, ctx: RouteContext<'/icons/[name]'>) {
  const { name } = await ctx.params
  const spec = ICONS[name]
  if (!spec) notFound()
  const cache = { 'Cache-Control': 'public, max-age=86400' }
  if (spec.px === null) {
    return new Response(logoSvg(spec.variant, spec.shape), {
      headers: { 'Content-Type': 'image/svg+xml', ...cache },
    })
  }
  const px = spec.px
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element -- ImageResponse 里只能用 <img>
    <img src={logoDataUri(spec.variant, spec.shape)} width={px} height={px} alt="" />,
    { width: px, height: px, headers: cache },
  )
}
