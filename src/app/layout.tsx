import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'DayDayOn',
    template: '%s · DayDayOn',
  },
  description: '和朋友一起每天打卡：运动、饮食、睡眠、学习和你自己的小目标。',
  applicationName: 'DayDayOn',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 让页面延伸到刘海和底部手势区，配合 env(safe-area-inset-*) 使用
  viewportFit: 'cover',
  themeColor: '#fff8f0',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
