'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useCheckinLauncher, useCheckinLauncherState } from '../launcher-store'

/*
 * 打卡弹层挂载点（F3）。外壳挂一次；"＋"、主页卡片、弹层自身都经 useCheckinLauncher() 开关。
 * 弹层代码不进首屏（ui-primitives.md 第 3 节）：第一次打开时才加载 checkin-sheet（D3 实现），
 * 加载后保持挂载，关闭时能播完退场动画。
 */
const CheckinSheet = dynamic(() => import('./checkin-sheet').then((m) => m.CheckinSheet))

export function CheckinLauncher() {
  const state = useCheckinLauncherState()
  const launcher = useCheckinLauncher()
  const [loaded, setLoaded] = useState(false)
  if (state.open && !loaded) setLoaded(true)
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
