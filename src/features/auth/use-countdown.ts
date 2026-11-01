'use client'

import { useEffect, useState } from 'react'

/** 倒计时（秒）：start(60) 开始，每秒减一，到 0 停止。用于"重新发送"按钮 */
export function useCountdown() {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (left <= 0) return
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [left])
  return { left, start: (seconds: number) => setLeft(seconds) }
}
