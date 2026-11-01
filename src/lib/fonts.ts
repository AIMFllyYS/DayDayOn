import localFont from 'next/font/local'

/*
 * 只含拉丁字母、数字和常用标点的子集（各约 30KB），中文落到系统字体。
 * 不用 next/font/google：本地开发在国内网络下拉不到 Google Fonts。
 * 子集化命令和字符范围见 docs/conventions/ui-design-system.md 第 3 节。
 */
export const nunito = localFont({
  src: '../assets/fonts/nunito-latin-var.woff2',
  variable: '--font-nunito',
  weight: '200 1000',
  display: 'swap',
})

export const fredoka = localFont({
  src: '../assets/fonts/fredoka-latin-var.woff2',
  variable: '--font-fredoka',
  weight: '400 700',
  display: 'swap',
})
