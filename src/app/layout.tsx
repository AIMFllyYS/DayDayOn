import type { Metadata, Viewport } from 'next'
import { ToastProvider } from '@/components/ui/toast'
import { THEME_IDS } from '@/features/me/schemas'
import { fredoka, nunito } from '@/lib/fonts'
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

/*
 * 主题（PRD 7.1）：首帧前从 localStorage 读出主题写到 <html data-theme>，避免先闪一下默认色。
 * 只读 localStorage、只认白名单里的主题 id；不读 cookie 和会话，根布局保持静态（cacheComponents）。
 * 键名与 src/lib/theme.ts 的 STORAGE_KEY 一致。
 */
const themeScript = `(function(){try{var t=localStorage.getItem("daydayon:theme:v1");if(${JSON.stringify(THEME_IDS)}.indexOf(t)>-1)document.documentElement.dataset.theme=t}catch(e){}})()`

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="zh-CN"
      className={`${nunito.variable} ${fredoka.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ToastProvider>
          {/* isolation 根：弹层 Portal 挂在 body 上，始终盖在页面内容之上（ui-primitives.md 第 2 节） */}
          <div className="isolate flex flex-1 flex-col">{children}</div>
        </ToastProvider>
      </body>
    </html>
  )
}
