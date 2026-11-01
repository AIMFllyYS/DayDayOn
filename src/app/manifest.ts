import type { MetadataRoute } from 'next'

/*
 * Web App Manifest（pwa.md 第 2 节、ADR-0022）。图标由 /icons/[name] 从 logo-svg.ts 生成。
 * 色值只能写字面量（pwa.md：全项目唯一允许写死色值的地方）：
 * - background_color = --background：系统开屏的底色，和网页开屏（splash.tsx）第一帧同色，两段开屏才接得上
 * - theme_color = --background：状态栏颜色，与根布局 viewport.themeColor 一致
 * Service Worker、离线页仍按 pwa.md 在 M5 实现。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DayDayOn',
    short_name: 'DayDayOn',
    description: '和朋友一起每天打卡：运动、饮食、睡眠、学习和你自己的小目标。',
    lang: 'zh-CN',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fff8f0', // --background
    theme_color: '#fff8f0', // --background
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
