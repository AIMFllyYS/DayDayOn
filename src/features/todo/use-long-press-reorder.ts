'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * 零依赖原生 Pointer Events 长按拖拽排序 Hook（用于待办组内排序 & 自定义分组排序）：
 * - 长按 350ms 触发拖拽态，期间指针位移超过 8px 则自动取消长按，不干扰列表正常上下滚动；
 * - 拖拽时实时根据各项 DOM 中心点计算落位索引，松手提交新顺序并抑制随后的误触 click；
 * - 兼容手机触屏与桌面鼠标，绝不引入额外拖拽依赖。
 */

const LONG_PRESS_MS = 350
const MOVE_CANCEL_PX = 8

export function moveArrayItem<T>(list: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length
  ) {
    return [...list]
  }
  const next = [...list]
  const [moved] = next.splice(fromIndex, 1)
  if (moved !== undefined) next.splice(toIndex, 0, moved)
  return next
}

export interface LongPressReorderOptions {
  /** 当前有序 ID 列表 */
  ids: readonly string[]
  /** 是否允许拖拽（例如列表超过 1 条时开启） */
  enabled?: boolean
  /** 松手确认新顺序回调 */
  onReorder: (nextIds: string[]) => void
}

export interface LongPressReorderBinding {
  onPointerDown: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  onPointerCancel: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

export function useLongPressReorder({ ids, enabled = true, onReorder }: LongPressReorderOptions) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [previewIds, setPreviewIds] = useState<string[] | null>(null)
  const [dragOffsetY, setDragOffsetY] = useState(0)

  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startRef = useRef<{
    id: string
    pointerId: number
    startX: number
    startY: number
    lastY: number
    el: HTMLElement | null
  } | null>(null)
  const activeRef = useRef(false)
  const suppressClickUntilRef = useRef(0)
  const previewRef = useRef<string[] | null>(null)
  const idsRef = useRef(ids)
  const onReorderRef = useRef(onReorder)

  useEffect(() => {
    idsRef.current = ids
  }, [ids])

  useEffect(() => {
    onReorderRef.current = onReorder
  }, [onReorder])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const resetDrag = useCallback(() => {
    clearTimer()
    activeRef.current = false
    startRef.current = null
    previewRef.current = null
    setDraggingId(null)
    setPreviewIds(null)
    setDragOffsetY(0)
  }, [clearTimer])

  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  const registerItem = useCallback((id: string) => {
    return (node: HTMLElement | null) => {
      if (node) itemRefs.current.set(id, node)
      else itemRefs.current.delete(id)
    }
  }, [])

  const finishDrag = useCallback(
    (commit: boolean) => {
      const wasActive = activeRef.current
      const finalIds = previewRef.current
      const originalIds = idsRef.current
      if (wasActive) {
        suppressClickUntilRef.current = Date.now() + 260
      }
      resetDrag()
      if (commit && wasActive && finalIds) {
        const changed =
          finalIds.length === originalIds.length &&
          finalIds.some((id, idx) => id !== originalIds[idx])
        if (changed) onReorderRef.current(finalIds)
      }
    },
    [resetDrag],
  )

  const updateOrderByPointerY = useCallback((clientY: number) => {
    const start = startRef.current
    const current = previewRef.current
    if (!start || !current) return
    const fromIndex = current.indexOf(start.id)
    if (fromIndex === -1) return

    let targetIndex = fromIndex
    for (let i = 0; i < current.length; i++) {
      const id = current[i]
      if (!id || id === start.id) continue
      const node = itemRefs.current.get(id)
      if (!node) continue
      const rect = node.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      if (fromIndex < i && clientY > midY) {
        targetIndex = i
      } else if (fromIndex > i && clientY < midY) {
        targetIndex = Math.min(targetIndex, i)
      }
    }

    if (targetIndex !== fromIndex) {
      const next = moveArrayItem(current, fromIndex, targetIndex)
      previewRef.current = next
      setPreviewIds(next)
      // 重新校准参考点，避免跨项交换后产生视觉跳动
      start.startY = clientY
      setDragOffsetY(0)
    } else {
      setDragOffsetY(clientY - start.startY)
    }
  }, [])

  /** 拖拽结束后短暂拦截误触 click（如点开管理抽屉或切折叠） */
  const shouldSuppressClick = useCallback(() => {
    return activeRef.current || Date.now() < suppressClickUntilRef.current
  }, [])

  const bindItem = useCallback(
    (id: string): LongPressReorderBinding => ({
      onPointerDown: (e) => {
        if (!enabled || idsRef.current.length <= 1) return
        if (e.pointerType === 'mouse' && e.button !== 0) return
        // 点击勾选框、删除按钮等内部独立按钮时不触发长按拖拽
        const target = e.target as HTMLElement | null
        if (target?.closest('[data-no-drag="true"]')) return

        clearTimer()
        const targetEl = e.currentTarget as HTMLElement
        startRef.current = {
          id,
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          lastY: e.clientY,
          el: targetEl,
        }

        timerRef.current = setTimeout(() => {
          const s = startRef.current
          if (!s || s.id !== id) return
          activeRef.current = true
          const initial = [...idsRef.current]
          previewRef.current = initial
          setDraggingId(id)
          setPreviewIds(initial)
          setDragOffsetY(0)
          try {
            s.el?.setPointerCapture(s.pointerId)
          } catch {
            // 某些浏览器在虚拟指针下不支持 capture，静默忽略
          }
          if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(25)
          }
        }, LONG_PRESS_MS)
      },
      onPointerMove: (e) => {
        const s = startRef.current
        if (!s || s.pointerId !== e.pointerId) return
        if (!activeRef.current) {
          const dist = Math.hypot(e.clientX - s.startX, e.clientY - s.startY)
          if (dist > MOVE_CANCEL_PX) {
            clearTimer()
            startRef.current = null
          }
          return
        }
        e.preventDefault()
        s.lastY = e.clientY
        updateOrderByPointerY(e.clientY)
      },
      onPointerUp: (e) => {
        const s = startRef.current
        if (!s || s.pointerId !== e.pointerId) return
        finishDrag(true)
      },
      onPointerCancel: () => {
        finishDrag(false)
      },
      onContextMenu: (e) => {
        // 移动端长按拖拽过程中阻止弹出系统右键菜单
        if (activeRef.current) e.preventDefault()
      },
    }),
    [clearTimer, enabled, finishDrag, updateOrderByPointerY],
  )

  return {
    orderedIds: previewIds ?? ids,
    draggingId,
    dragOffsetY,
    isDragging: draggingId !== null,
    registerItem,
    bindItem,
    shouldSuppressClick,
  }
}
