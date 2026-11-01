'use client'

import { Button } from '@/components/ui/button'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-title font-bold">出了点小问题</h2>
      <p className="text-body text-muted">页面加载失败，可以再试一次。</p>
      <Button icon="undo" onClick={reset}>
        重试
      </Button>
    </div>
  )
}
