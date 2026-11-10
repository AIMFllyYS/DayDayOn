'use client'

import { useEffect } from 'react'
import { dismissNativeSplash } from '@/lib/native'

/** 动画万一没触发 animationend（标签页在后台、浏览器省电），最晚这么久后也要移除开屏 */
const FAILSAFE_MS = 2600

/**
 * 开屏的收尾（ADR-0022）：
 * - 在 Android 原生壳内：首屏水合就绪时立即调用 `dismissNativeSplash()` 通知原生层揭开 0ms 开屏覆盖层；
 * - 在已安装的手机 PWA 内：播完移除 <html data-splash>；点一下开屏就跳过（淡出）。
 */
export function SplashController() {
  useEffect(() => {
    dismissNativeSplash()
    const root = document.documentElement
    const el = document.getElementById('app-splash')
    if (!root.dataset.splash || !el) return

    const done = () => {
      delete root.dataset.splash
      delete root.dataset.splashChar
      delete root.dataset.splashGreet
    }
    // 只认开屏自己的动画结束（团团、印章的动画也会冒泡上来）
    const onEnd = (e: AnimationEvent) => {
      if (e.target === el) done()
    }
    const skip = () => {
      if (root.dataset.splash) root.dataset.splash = 'skip'
    }
    const timer = window.setTimeout(done, FAILSAFE_MS)
    el.addEventListener('animationend', onEnd)
    el.addEventListener('pointerdown', skip)
    return () => {
      window.clearTimeout(timer)
      el.removeEventListener('animationend', onEnd)
      el.removeEventListener('pointerdown', skip)
    }
  }, [])
  return null
}
