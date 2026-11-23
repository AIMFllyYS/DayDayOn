'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import {
  consumePageTransition,
  getOriginFromEvent,
  parseNavTransitionAttr,
  setPageTransition,
  type PageTransitionKind,
  type TransitionOrigin,
} from '@/lib/motion'

/*
 * 全站统一页面转场宿主与局部子视图转场原语（ADR-0005）：
 * 1. PageTransitionHost：挂在 (app)/layout.tsx 的 <Suspense> 内，监听全站 [data-nav-transition] 点击与
 *    popstate 返回手势，路由变更首帧同步激活对应动画（零首帧闪烁）：
 *    - push：从右往左舒缓滑入（560ms）
 *    - pop：从左往右柔和回落（460ms）
 *    - expand：以点击点 (x, y) 为聚焦圆心径向铺开全屏（540ms）
 *    - tab：一级主导航轻盈渐入（280ms）
 * 2. SubpageTransition：同路由内的二级视图切换（如「我的」5 个设置子页、消息中心移动端二级页）。
 * 3. FocusExpandView：同路由内的聚焦点径向展开（如主页切换好友房间 / 返回我的主页）。
 *
 * 所有转场在动画结束（onAnimationEnd + 兜底计时器）后自动卸除动画类与内联 transformOrigin，
 * 绝不残留 stacking context，确保内部 sticky 顶栏、吸底条与 fixed 弹层表现完全正常。
 */

interface ActiveTransition {
  kind: Exclude<PageTransitionKind, 'none'>
  origin?: TransitionOrigin
  seq: number
}

const ANIMATION_CLASS: Record<Exclude<PageTransitionKind, 'none'>, string> = {
  push: 'animate-page-push',
  pop: 'animate-page-pop',
  expand: 'animate-page-expand',
  tab: 'animate-page-tab',
}

const SAFETY_MS: Record<Exclude<PageTransitionKind, 'none'>, number> = {
  push: 660,
  pop: 540,
  expand: 660,
  tab: 360,
}

function buildOriginStyle(origin?: TransitionOrigin): CSSProperties | undefined {
  if (!origin) return undefined
  return {
    '--origin-x': `${origin.x}px`,
    '--origin-y': `${origin.y}px`,
    transformOrigin: `${origin.x}px ${origin.y}px`,
  } as CSSProperties
}

/** 正式路由级统一转场宿主（需放在 <Suspense> 内以兼容 cacheComponents） */
export function PageTransitionHost({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [prevPath, setPrevPath] = useState(pathname)
  const [seq, setSeq] = useState(0)
  const [active, setActive] = useState<ActiveTransition | null>(null)

  // 路由变化首帧同步计算转场，避免新页面先闪一帧再播放动画（首屏冷启动 prevPath === pathname 不触发）
  if (pathname !== prevPath) {
    const intent = consumePageTransition(prevPath, pathname)
    setPrevPath(pathname)
    if (intent.kind !== 'none') {
      const nextSeq = seq + 1
      setSeq(nextSeq)
      setActive({ kind: intent.kind, origin: intent.origin, seq: nextSeq })
    } else {
      setActive(null)
    }
  }

  // 全局捕获声明式 data-nav-transition 点击与浏览器返回手势
  useEffect(() => {
    function onClickCapture(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return
      }
      const target = e.target instanceof Element ? e.target : null
      if (!target) return
      const trigger = target.closest('[data-nav-transition]')
      if (!trigger) return
      const kind = parseNavTransitionAttr(trigger.getAttribute('data-nav-transition'))
      if (!kind) return
      if (kind === 'expand') {
        setPageTransition('expand', getOriginFromEvent(e, trigger))
      } else {
        setPageTransition(kind)
      }
    }

    function onPopState() {
      setPageTransition('pop')
    }

    document.addEventListener('click', onClickCapture, true)
    window.addEventListener('popstate', onPopState)
    return () => {
      document.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  // 兜底自动清理（兼容 prefers-reduced-motion 或动画被打断）
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => {
      setActive((cur) => (cur?.seq === active.seq ? null : cur))
    }, SAFETY_MS[active.kind])
    return () => window.clearTimeout(timer)
  }, [active])

  const activeKind = active?.kind ?? null

  return (
    <div
      data-page-transition={activeKind ?? 'idle'}
      className={cn(
        'flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col',
        activeKind && ANIMATION_CLASS[activeKind],
        activeKind === 'expand' && 'bg-paper will-change-[clip-path,transform,opacity]',
        (activeKind === 'push' || activeKind === 'pop') && 'will-change-[transform,opacity]',
      )}
      style={activeKind === 'expand' ? buildOriginStyle(active?.origin) : undefined}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget || !active) return
        setActive((cur) => (cur?.seq === active.seq ? null : cur))
      }}
    >
      {children}
    </div>
  )
}

/** 同路由内的二级子视图切换（右进左出 / 左回右出），如「我的」二级页与消息中心二级页 */
export function SubpageTransition({
  transitionKey,
  direction = 'push',
  className,
  children,
}: {
  transitionKey: string
  direction: 'push' | 'pop' | 'none'
  className?: string
  children: ReactNode
}) {
  const [animating, setAnimating] = useState(direction !== 'none')
  const [prevKey, setPrevKey] = useState(transitionKey)

  if (transitionKey !== prevKey) {
    setPrevKey(transitionKey)
    setAnimating(direction !== 'none')
  }

  useEffect(() => {
    if (!animating || direction === 'none') return
    const timer = window.setTimeout(() => setAnimating(false), SAFETY_MS[direction])
    return () => window.clearTimeout(timer)
  }, [animating, direction, transitionKey])

  const animClass = animating && direction !== 'none' ? ANIMATION_CLASS[direction] : undefined

  return (
    <div
      key={transitionKey}
      data-subpage-transition={animating && direction !== 'none' ? direction : 'idle'}
      className={cn(animClass, animating && 'will-change-[transform,opacity]', className)}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setAnimating(false)
      }}
    >
      {children}
    </div>
  )
}

/** 同路由内的聚焦点径向展开（如主页在「我的主页」与「好友小窝」间切换） */
export function FocusExpandView({
  transitionKey,
  origin,
  className,
  children,
}: {
  transitionKey: string
  origin?: (TransitionOrigin & { seq?: number }) | null
  className?: string
  children: ReactNode
}) {
  const [prevKey, setPrevKey] = useState(transitionKey)
  const [animating, setAnimating] = useState(false)

  if (transitionKey !== prevKey) {
    setPrevKey(transitionKey)
    setAnimating(true)
  }

  useEffect(() => {
    if (!animating) return
    const timer = window.setTimeout(() => setAnimating(false), SAFETY_MS.expand)
    return () => window.clearTimeout(timer)
  }, [animating, transitionKey, origin?.seq])

  const resolvedOrigin: TransitionOrigin = origin ? { x: origin.x, y: origin.y } : { x: 40, y: 36 }

  return (
    <div
      key={transitionKey}
      data-focus-expand={animating ? 'active' : 'idle'}
      className={cn(
        animating && 'animate-page-expand bg-paper will-change-[clip-path,transform,opacity]',
        className,
      )}
      style={animating ? buildOriginStyle(resolvedOrigin) : undefined}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setAnimating(false)
      }}
    >
      {children}
    </div>
  )
}
