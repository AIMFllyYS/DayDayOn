'use client'

import { useEffect } from 'react'

/** 动画万一没触发 animationend（标签页在后台、浏览器省电），最晚这么久后也要移除开屏 */
const FAILSAFE_MS = 2600

/**
 * 开屏的收尾（ADR-0022）：播完移除 <html data-splash>；点一下开屏就跳过（淡出）。
 * 开屏是否出现由根布局的内联脚本在首帧前决定，这里只负责收尾，不渲染任何东西。
 */
export function SplashController() {
  useEffect(() => {
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
