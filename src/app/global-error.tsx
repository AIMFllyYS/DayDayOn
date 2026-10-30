'use client'

// 根 layout 出错时的兜底页面：此时 globals.css 可能未加载，所以用内联样式
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: '#fff8f0',
          color: '#4a3f35',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h2>系统出错了</h2>
        <button type="button" onClick={reset}>
          重试
        </button>
      </body>
    </html>
  )
}
