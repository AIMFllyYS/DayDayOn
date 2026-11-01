'use client'

import { useSyncExternalStore } from 'react'

/*
 * 打卡弹层的开关（plan-mvp-build.md 3.1）。接口 F1 定；F3 可以替换内部实现，但不改导出签名。
 * 挂载点（features/checkin/components/checkin-launcher.tsx，F3）读 useCheckinLauncherState()，
 * 外壳的"＋"、主页卡片（D4）、弹层自身（D3）调 useCheckinLauncher().open(view)。
 * 视图在同一个弹层里切换内容，不开第二层弹层（PRD 2.4）。
 */

export type CheckinLauncherView = 'list' | 'weight' | 'mood'

export interface CheckinLauncherState {
  open: boolean
  view: CheckinLauncherView
}

export interface CheckinLauncher {
  open: (view?: CheckinLauncherView) => void
  close: () => void
}

let state: CheckinLauncherState = { open: false, view: 'list' }
const listeners = new Set<() => void>()
const SERVER_STATE: CheckinLauncherState = { open: false, view: 'list' }

function setState(next: CheckinLauncherState) {
  if (next.open === state.open && next.view === state.view) return
  state = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const launcher: CheckinLauncher = {
  open: (view = 'list') => setState({ open: true, view }),
  close: () => setState({ ...state, open: false }),
}

/** 打开 / 关闭弹层的动作（引用稳定，可以放进依赖数组） */
export function useCheckinLauncher(): CheckinLauncher {
  return launcher
}

/** 弹层当前状态（挂载点使用） */
export function useCheckinLauncherState(): CheckinLauncherState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  )
}
