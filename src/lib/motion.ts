/*
 * 全站页面转场与聚焦点展开意图管理（ADR-0005）：
 * - 'push'：传统子页面从右往左舒缓弹出（如「我的」子页、目标设置、个人资料、通知中心）
 * - 'pop'：返回上一级时的左向右回落
 * - 'expand'：以点击聚焦点 (x, y) 为圆心径向铺开全屏（如主页板块近况/今日进度、好友房间切换）
 * - 'tab'：底栏 / 侧栏一级导航切换时的轻盈渐入
 */

export type PageTransitionKind = 'push' | 'pop' | 'expand' | 'tab' | 'none'

export interface TransitionOrigin {
  /** 视口 X 坐标（px） */
  x: number
  /** 视口 Y 坐标（px） */
  y: number
}

export interface PageTransitionIntent {
  kind: PageTransitionKind
  origin?: TransitionOrigin
  timestamp: number
}

const INTENT_TTL_MS = 2500

const PRIMARY_ROUTES = new Set(['/', '/todo', '/rank', '/me'])

let pendingIntent: PageTransitionIntent | null = null

/** 声明式 HTML 属性值解析（挂在 Link / 按钮的 data-nav-transition 上） */
export function parseNavTransitionAttr(
  value: string | null | undefined,
): PageTransitionKind | null {
  if (
    value === 'push' ||
    value === 'pop' ||
    value === 'expand' ||
    value === 'tab' ||
    value === 'none'
  ) {
    return value
  }
  return null
}

/** 从点击事件或目标元素中提取视口聚焦坐标；键盘触发（clientX=0 && clientY=0）时取元素几何中心 */
export function getOriginFromEvent(
  event?: {
    clientX?: number
    clientY?: number
    currentTarget?: EventTarget | null
    target?: EventTarget | null
  } | null,
  fallbackElement?: Element | null,
): TransitionOrigin | undefined {
  if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
    if (event.clientX > 0 || event.clientY > 0) {
      return { x: Math.round(event.clientX), y: Math.round(event.clientY) }
    }
  }
  const el =
    fallbackElement ??
    (event?.currentTarget instanceof Element
      ? event.currentTarget
      : event?.target instanceof Element
        ? event.target
        : null)
  if (el && typeof el.getBoundingClientRect === 'function') {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 || rect.height > 0) {
      return {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
      }
    }
  }
  return undefined
}

/** 记录下一次页面切换的转场意图 */
export function setPageTransition(kind: PageTransitionKind, origin?: TransitionOrigin): void {
  pendingIntent = {
    kind,
    origin,
    timestamp: Date.now(),
  }
}

/** 快捷记录聚焦点击点铺开意图 */
export function setExpandOriginFromEvent(
  event?: {
    clientX?: number
    clientY?: number
    currentTarget?: EventTarget | null
    target?: EventTarget | null
  } | null,
  fallbackElement?: Element | null,
): TransitionOrigin | undefined {
  const origin = getOriginFromEvent(event, fallbackElement)
  setPageTransition('expand', origin)
  return origin
}

function normalizePath(path: string): string {
  if (!path || path === '/') return '/'
  return path.endsWith('/') ? path.slice(0, -1) : path
}

function pathDepth(path: string): number {
  const norm = normalizePath(path)
  if (norm === '/') return 0
  return norm.split('/').filter(Boolean).length
}

/** 未显式标记转场类型时，按路由层级自动推断默认转场方向 */
export function resolveRouteTransitionKind(
  prevPath: string | null,
  nextPath: string,
): PageTransitionKind {
  if (!prevPath) return 'none'
  const prev = normalizePath(prevPath)
  const next = normalizePath(nextPath)
  if (prev === next) return 'none'

  const prevPrimary = PRIMARY_ROUTES.has(prev)
  const nextPrimary = PRIMARY_ROUTES.has(next)

  if (prevPrimary && nextPrimary) return 'tab'
  if (prevPrimary && !nextPrimary) return 'push'
  if (!prevPrimary && nextPrimary) return 'pop'

  const prevDepth = pathDepth(prev)
  const nextDepth = pathDepth(next)
  if (nextDepth < prevDepth) return 'pop'
  return 'push'
}

/** 消费一次转场意图：优先使用未过期的显式意图，否则按路由层级自动推断 */
export function consumePageTransition(
  prevPath: string | null,
  nextPath: string,
  now = Date.now(),
): PageTransitionIntent {
  const intent = pendingIntent
  pendingIntent = null

  if (intent && now - intent.timestamp <= INTENT_TTL_MS) {
    return intent
  }

  return {
    kind: resolveRouteTransitionKind(prevPath, nextPath),
    timestamp: now,
  }
}

/** 仅用于单元测试重置模块状态 */
export function resetPageTransitionForTest(): void {
  pendingIntent = null
}
