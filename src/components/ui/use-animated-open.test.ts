import { describe, expect, it } from 'vitest'
import { initialAnimatedEntered, resolveAnimatedOpen } from './use-animated-open'

describe('useAnimatedOpen 状态机', () => {
  it('按需挂载（初始 open=true）时首帧返回 false，下一帧切为 true 以触发 Base UI data-starting-style', () => {
    const enteredAtMount = initialAnimatedEntered(true)
    expect(enteredAtMount).toBe(false)
    // 挂载首帧传给 Drawer.Root / Dialog.Root 的 open 为 false
    expect(resolveAnimatedOpen(true, enteredAtMount)).toBe(false)
    // 下一动画帧 entered 变为 true 后，open 转为 true，触发 false → true 进场动画
    expect(resolveAnimatedOpen(true, true)).toBe(true)
  })

  it('常驻挂载（初始 open=false）时 entered 直接为 true，后续打开零延迟同步生效', () => {
    const enteredAtMount = initialAnimatedEntered(false)
    expect(enteredAtMount).toBe(true)
    expect(resolveAnimatedOpen(false, enteredAtMount)).toBe(false)
    expect(resolveAnimatedOpen(true, enteredAtMount)).toBe(true)
  })

  it('关闭时无论 entered 状态如何均立即返回 false，不延迟退场动画', () => {
    expect(resolveAnimatedOpen(false, true)).toBe(false)
    expect(resolveAnimatedOpen(false, false)).toBe(false)
  })
})
