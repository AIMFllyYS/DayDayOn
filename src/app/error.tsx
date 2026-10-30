'use client'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-2xl font-bold">出了点小问题</h2>
      <p className="text-muted">页面加载失败，可以再试一次。</p>
      <button
        type="button"
        onClick={reset}
        className="bg-foreground text-background rounded-full px-5 py-2"
      >
        重试
      </button>
    </div>
  )
}
