'use client'

import { useSyncExternalStore } from 'react'
import { flushTodoDeletes } from '@/lib/api/queries/todos'

/*
 * 延迟删除（PRD 2.10：删除可在 5 秒内撤销）。
 * 点删除时只把 id 记进这里，列表据此隐藏；撤销提示消失（超时或被关掉）后才真正发 DELETE。
 * 不直接改查询缓存：撤销窗口里列表可能被重新获取，隐藏集合能保证那一条不会"复活"。
 * 页面关闭时（pagehide）把还没发出的删除用 keepalive 请求补发；监听挂在 window 上，离开 /todo 后同样生效。
 */

let pending: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()
const EMPTY: ReadonlySet<string> = new Set()

let listening = false
function listenPageHide() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('pagehide', () => flushTodoDeletes([...pending]))
}

function emit(next: ReadonlySet<string>) {
  pending = next
  for (const l of listeners) l()
}

export const pendingDeletes = {
  add(id: string) {
    if (pending.has(id)) return
    listenPageHide()
    emit(new Set([...pending, id]))
  },
  remove(id: string) {
    if (!pending.has(id)) return
    const next = new Set(pending)
    next.delete(id)
    emit(next)
  },
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 当前隐藏中的待办 id；服务端渲染时为空 */
export function usePendingDeletes(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => pending,
    () => EMPTY,
  )
}
