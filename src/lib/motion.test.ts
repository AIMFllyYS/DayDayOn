import { beforeEach, describe, expect, it } from 'vitest'
import {
  consumePageTransition,
  getOriginFromEvent,
  parseNavTransitionAttr,
  resetPageTransitionForTest,
  resolveRouteTransitionKind,
  setPageTransition,
} from './motion'

describe('motion 页面转场意图与路由推断', () => {
  beforeEach(() => {
    resetPageTransitionForTest()
  })

  it('按路由层级正确推断默认转场类型（tab / push / pop / none）', () => {
    expect(resolveRouteTransitionKind(null, '/')).toBe('none')
    expect(resolveRouteTransitionKind('/me', '/me')).toBe('none')
    expect(resolveRouteTransitionKind('/', '/todo')).toBe('tab')
    expect(resolveRouteTransitionKind('/rank', '/me')).toBe('tab')
    expect(resolveRouteTransitionKind('/me', '/goals')).toBe('push')
    expect(resolveRouteTransitionKind('/me', '/me/profile')).toBe('push')
    expect(resolveRouteTransitionKind('/goals', '/goals/new')).toBe('push')
    expect(resolveRouteTransitionKind('/goals', '/me')).toBe('pop')
    expect(resolveRouteTransitionKind('/goals/g1/checkin', '/goals/g1')).toBe('pop')
    expect(resolveRouteTransitionKind('/friends/u2/goals/g1', '/')).toBe('pop')
  })

  it('显式记录的 expand / push 意图优先于路由推断，且消费一次即清空', () => {
    setPageTransition('expand', { x: 120, y: 340 })
    const first = consumePageTransition('/', '/goals/g1')
    expect(first.kind).toBe('expand')
    expect(first.origin).toEqual({ x: 120, y: 340 })

    // 第二次消费应回落到路由推断
    const second = consumePageTransition('/goals/g1', '/')
    expect(second.kind).toBe('pop')
    expect(second.origin).toBeUndefined()
  })

  it('超时过期的显式意图自动忽略并回落到路由推断', () => {
    setPageTransition('expand', { x: 80, y: 90 })
    const expired = consumePageTransition('/me', '/goals', Date.now() + 5000)
    expect(expired.kind).toBe('push')
  })

  it('安全解析声明式 data-nav-transition 属性', () => {
    expect(parseNavTransitionAttr('expand')).toBe('expand')
    expect(parseNavTransitionAttr('push')).toBe('push')
    expect(parseNavTransitionAttr('pop')).toBe('pop')
    expect(parseNavTransitionAttr('tab')).toBe('tab')
    expect(parseNavTransitionAttr('invalid')).toBeNull()
    expect(parseNavTransitionAttr(null)).toBeNull()
  })

  it('从点击事件或回退元素提取聚焦坐标', () => {
    expect(getOriginFromEvent({ clientX: 145.6, clientY: 288.2 })).toEqual({ x: 146, y: 288 })
    const fakeEl = {
      getBoundingClientRect: () => ({ left: 100, top: 200, width: 80, height: 40 }),
    } as unknown as Element
    expect(getOriginFromEvent({ clientX: 0, clientY: 0 }, fakeEl)).toEqual({ x: 140, y: 220 })
  })
})
