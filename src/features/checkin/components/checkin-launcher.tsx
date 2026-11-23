'use client'

import dynamic from 'next/dynamic'
import { useIdlePreload, useLazyMount } from '@/lib/lazy'
import { useCheckinLauncher, useCheckinLauncherState } from '../launcher-store'

/*
 * 打卡弹层挂载点（F3）。外壳挂一次；"＋"、主页卡片、弹层自身都经 useCheckinLauncher() 开关。
 * 弹层代码不进首屏（ui-primitives.md 第 3 节）：
 * - dynamic 传入 loading: () => null 生成局部 Suspense 边界，防止首次加载时 Promise 冒泡击穿页面级 Suspense；
 * - 首屏水合后经 useIdlePreload 在浏览器空闲期静默预热模块，首次点击底栏"＋"零网络等待，直接从底部丝滑拉出；
 * - 经 useLazyMount 加载后保持挂载，关闭时能完整播完退场动画。
 */
const loadCheckinSheet = () => import('./checkin-sheet').then((m) => m.CheckinSheet)
const CheckinSheet = dynamic(loadCheckinSheet, { loading: () => null })

export function CheckinLauncher() {
  const state = useCheckinLauncherState()
  const launcher = useCheckinLauncher()
  const loaded = useLazyMount(state.open)

  useIdlePreload(loadCheckinSheet)

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
