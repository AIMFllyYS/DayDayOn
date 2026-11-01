'use client'

import { useSyncExternalStore } from 'react'

/*
 * 每分钟刷新一次的"现在"：DDL 徽章（快到期 / 已过期）和"今天 / 明天"文案跟着时间走。
 * 服务端渲染时返回 null（不在预渲染里读当前时间），调用方此时显示骨架。
 */

const TICK_MS = 60_000
let current: Date | null = null
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

function tick() {
  current = new Date()
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (timer === undefined) {
    // 没人订阅期间时间照样在走：重新开始计时前先刷新一次
    current = new Date()
    timer = setInterval(tick, TICK_MS)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

function snapshot(): Date {
  current ??= new Date()
  return current
}

export function useNow(): Date | null {
  return useSyncExternalStore(subscribe, snapshot, () => null)
}
