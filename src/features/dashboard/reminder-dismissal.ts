'use client'

import { useSyncExternalStore } from 'react'

/*
 * 打卡提醒"今天不再显示"（PRD 7.1）：在 localStorage 记下关掉的打卡日，当天不再出现。
 * localStorage 属于跨信任边界的数据，读出后只认 YYYY-MM-DD（client-data-and-forms.md 第 7 节）。
 * localStorage 不可用（隐私模式）时退化为只在本次页面会话内隐藏。
 */

const STORAGE_KEY = 'daydayon:reminder-dismissed:v1'
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/

const listeners = new Set<() => void>()
let memoryDismissed: string | null = null

function read(): string | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    if (v !== null && LOCAL_DATE.test(v)) return v
  } catch {
    // 读不了就看内存里的
  }
  return memoryDismissed
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** 今天（打卡日 localDate）的提醒是否已经关掉；服务端渲染时视为没关 */
export function useReminderDismissed(localDate: string): {
  dismissed: boolean
  dismiss: () => void
} {
  const stored = useSyncExternalStore(subscribe, read, () => null)
  return {
    dismissed: stored === localDate,
    dismiss: () => {
      memoryDismissed = localDate
      try {
        window.localStorage.setItem(STORAGE_KEY, localDate)
      } catch {
        // 写不进去：memoryDismissed 兜底
      }
      listeners.forEach((l) => l())
    },
  }
}
