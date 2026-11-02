'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'

/*
 * 悬浮团团的拖动、吸附与手势（ui-design-system.md 第 9 节「悬浮团团」）。
 * 正式组件（FloatingPet）和 Playbook 演示共用这一份逻辑：传 containerRef 时坐标相对容器（演示框），
 * 不传就是整屏。手势：点一下 = 单击，300ms 内点两下 = 双击，按住 450ms 不动 = 长按晃悠。
 *
 * 吸附规则：离左 / 右 / 上边缘 ≤ 24px 吸附并露半张脸（右侧露左半边，左侧露右半边，顶部倒立）；
 * 底部不吸附，由 bottomInset（Dock 栏）挡住。
 */

export const PET_SIZE = 56
export const SNAP_DISTANCE = 24
const LONG_PRESS_MS = 450
const DOUBLE_TAP_MS = 300
const MOVE_THRESHOLD = 6

export type PetEdge = 'none' | 'left' | 'right' | 'top'

export interface PetPosition {
  /** 相对容器（默认视口）左上角的坐标 */
  left: number
  top: number
  edge: PetEdge
}

export interface PetDragOptions {
  size?: number
  /** 底边保留高度：手机 Dock 栏；不传为 0 */
  bottomInset?: number
  /** 限定在一个元素内（Playbook 演示框）；不传就是整个视口 */
  containerRef?: RefObject<HTMLElement | null>
  /** 位置记在本机的键；不传就不持久化（演示框） */
  storageKey?: string
  /** 初始位置；不传时按整屏右下角算（演示框里给固定值，避免在 render 里量容器） */
  initial?: PetPosition
  onTap?: () => void
  onDoubleTap?: () => void
}

interface Bounds {
  width: number
  height: number
}

function measure(container: HTMLElement | null, inset: number): Bounds {
  if (container) return { width: container.clientWidth, height: container.clientHeight - inset }
  return { width: window.innerWidth, height: window.innerHeight - inset }
}

/** 默认位置：右下角，Dock 栏上方 */
export function defaultPetPosition(bounds: Bounds, size: number): PetPosition {
  return {
    left: bounds.width - size - 16,
    top: Math.max(0, bounds.height - size - 16),
    edge: 'none',
  }
}

function clampTo(p: PetPosition, bounds: Bounds, size: number): PetPosition {
  const half = size / 2
  return {
    left: Math.min(Math.max(p.left, -half), bounds.width - half),
    top: Math.min(Math.max(p.top, -half), Math.max(-half, bounds.height - half)),
    edge: 'none',
  }
}

function snapTo(p: PetPosition, bounds: Bounds, size: number): PetPosition {
  const half = size / 2
  if (p.left + half <= SNAP_DISTANCE) return { left: -half, top: p.top, edge: 'left' }
  if (bounds.width - (p.left + half) <= SNAP_DISTANCE) {
    return { left: bounds.width - half, top: p.top, edge: 'right' }
  }
  if (p.top + half <= SNAP_DISTANCE) return { left: p.left, top: -half, edge: 'top' }
  return clampTo(p, bounds, size)
}

function readStored(key: string | undefined): PetPosition | null {
  if (!key || typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const p = JSON.parse(raw) as PetPosition
    if (typeof p.left !== 'number' || typeof p.top !== 'number') return null
    return { left: p.left, top: p.top, edge: 'none' }
  } catch {
    return null
  }
}

export interface PetDrag {
  position: PetPosition
  dragging: boolean
  /** 长按蓄力中（一直晃悠） */
  swaying: boolean
  /** 双击后的转圈，900ms */
  spinning: boolean
  /** 吸附到顶部后的探头，1.4s */
  peeking: boolean
  handlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
    onPointerUp: () => void
    onPointerCancel: () => void
  }
}

export function usePetDrag(options: PetDragOptions): PetDrag {
  const {
    size = PET_SIZE,
    bottomInset = 0,
    containerRef,
    storageKey,
    initial,
    onTap,
    onDoubleTap,
  } = options
  const bounds = useCallback(
    () => measure(containerRef?.current ?? null, bottomInset),
    [containerRef, bottomInset],
  )

  const [position, setPosition] = useState<PetPosition>(() => {
    const stored = readStored(storageKey)
    if (stored) return stored
    if (initial) return initial
    if (typeof window === 'undefined') return { left: 0, top: 0, edge: 'none' }
    return defaultPetPosition(measure(null, bottomInset), size)
  })
  const [dragging, setDragging] = useState(false)
  const [swaying, setSwaying] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [peeking, setPeeking] = useState(false)

  const drag = useRef<{
    startX: number
    startY: number
    originLeft: number
    originTop: number
    moved: boolean
    longPress: boolean
  } | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTap = useRef(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      for (const t of [longPressTimer, tapTimer, spinTimer, peekTimer]) {
        if (t.current) clearTimeout(t.current)
      }
    },
    [],
  )

  const persist = useCallback(
    (p: PetPosition) => {
      if (!storageKey) return
      try {
        localStorage.setItem(storageKey, JSON.stringify(p))
      } catch {
        // localStorage 不可用时静默
      }
    },
    [storageKey],
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      // 指针捕获：拖动时指针常常跑出这只小团子，没有捕获就收不到后续的移动事件
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // 部分环境不支持指针捕获，退回普通事件
      }
      const origin = containerRef?.current?.getBoundingClientRect()
      drag.current = {
        startX: e.clientX - (origin?.left ?? 0),
        startY: e.clientY - (origin?.top ?? 0),
        originLeft: position.left,
        originTop: position.top,
        moved: false,
        longPress: false,
      }
      longPressTimer.current = setTimeout(() => {
        if (drag.current && !drag.current.moved) {
          drag.current.longPress = true
          setSwaying(true)
        }
      }, LONG_PRESS_MS)
    },
    [containerRef, position.left, position.top],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = drag.current
      if (!d) return
      const origin = containerRef?.current?.getBoundingClientRect()
      const x = e.clientX - (origin?.left ?? 0)
      const y = e.clientY - (origin?.top ?? 0)
      if (!d.moved) {
        if (Math.hypot(x - d.startX, y - d.startY) <= MOVE_THRESHOLD) return
        d.moved = true
        if (longPressTimer.current) clearTimeout(longPressTimer.current)
        setSwaying(false)
        setDragging(true)
      }
      setPosition(
        clampTo(
          { left: d.originLeft + (x - d.startX), top: d.originTop + (y - d.startY), edge: 'none' },
          bounds(),
          size,
        ),
      )
    },
    [bounds, containerRef, size],
  )

  const end = useCallback(() => {
    const d = drag.current
    drag.current = null
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    setSwaying(false)
    setDragging(false)
    if (!d) return

    if (d.moved) {
      setPosition((prev) => {
        const next = snapTo(prev, bounds(), size)
        persist(next)
        if (next.edge === 'top') {
          setPeeking(true)
          if (peekTimer.current) clearTimeout(peekTimer.current)
          peekTimer.current = setTimeout(() => setPeeking(false), 1400)
        }
        return next
      })
      return
    }
    if (d.longPress) return // 长按松手只结束晃悠，不当成点击

    const now = Date.now()
    if (now - lastTap.current <= DOUBLE_TAP_MS) {
      lastTap.current = 0
      if (tapTimer.current) clearTimeout(tapTimer.current)
      setSpinning(true)
      if (spinTimer.current) clearTimeout(spinTimer.current)
      spinTimer.current = setTimeout(() => setSpinning(false), 900)
      onDoubleTap?.()
      return
    }
    lastTap.current = now
    tapTimer.current = setTimeout(() => onTap?.(), DOUBLE_TAP_MS)
  }, [bounds, onDoubleTap, onTap, persist, size])

  return {
    position,
    dragging,
    swaying,
    spinning,
    peeking,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
    },
  }
}
