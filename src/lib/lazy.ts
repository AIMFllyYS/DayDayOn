'use client'

import { useEffect, useState } from 'react'

/*
 * 统一懒加载与空闲预热工具（ui-primitives.md 第 3 节）：
 * - useLazyMount(open)：首次打开时挂载，关闭后保持挂载，确保 Base UI data-ending-style 退场动画完整播放；
 * - useIdlePreload(loader)：客户端水合后的浏览器空闲期静默预热高频弹层 chunk，兼顾首屏零负担与首次点击零等待。
 */

/** 首次变为 true 时返回 true，之后保持挂载不卸载 */
export function useLazyMount(active: boolean): boolean {
  const [mounted, setMounted] = useState(active)
  if (active && !mounted) {
    setMounted(true)
  }
  return mounted
}

/** 浏览器空闲期静默预热动态模块；支持取消以免卸载后无意义触发 */
export function useIdlePreload(loader: () => Promise<unknown>, fallbackDelayMs = 2400): void {
  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(() => {
        void loader()
      })
      return () => win.cancelIdleCallback?.(id)
    }
    const timer = window.setTimeout(() => {
      void loader()
    }, fallbackDelayMs)
    return () => window.clearTimeout(timer)
  }, [loader, fallbackDelayMs])
}
