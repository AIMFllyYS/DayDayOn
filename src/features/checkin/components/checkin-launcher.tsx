'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useCheckinLauncher, useCheckinLauncherState } from '../launcher-store'

/*
 * 打卡弹层挂载点（F3）。外壳挂一次；"＋"、主页卡片、弹层自身都经 useCheckinLauncher() 开关。
 * 弹层代码不进首屏（ui-primitives.md 第 3 节）：
 * - dynamic 传入 loading: () => null 生成局部 Suspense 边界，防止首次加载时 Promise 冒泡击穿页面级 Suspense；
 * - 首屏水合后在浏览器空闲期静默预热模块，首次点击底栏"＋"零网络等待，直接从底部丝滑拉出；
 * - 加载后保持挂载，关闭时能完整播完退场动画。
 */
const loadCheckinSheet = () => import('./checkin-sheet').then((m) => m.CheckinSheet)
const CheckinSheet = dynamic(loadCheckinSheet, { loading: () => null })

export function CheckinLauncher() {
  const state = useCheckinLauncherState()
  const launcher = useCheckinLauncher()
  const [loaded, setLoaded] = useState(false)
  if (state.open && !loaded) setLoaded(true)

  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(() => {
        void loadCheckinSheet()
      })
      return () => win.cancelIdleCallback?.(id)
    }
    const timer = window.setTimeout(() => {
      void loadCheckinSheet()
    }, 2400)
    return () => window.clearTimeout(timer)
  }, [])

  if (!loaded) return null
  return (
    <CheckinSheet
      open={state.open}
      view={state.view}
      onOpenChange={(open) => {
        if (!open) launcher.close()
      }}
    />
  )
}
