import { describe, expect, it, vi } from 'vitest'
import {
  consumePendingSmartCapture,
  setPendingSmartCapture,
  subscribePendingSmartCapture,
} from './smart-handoff'

describe('smart-handoff 内存交接槽', () => {
  it('存入 File 后仅能被消费一次，消费后立即释放内存引用', () => {
    const file = new File(['dummy-image'], 'meal.jpg', { type: 'image/jpeg' })
    const listener = vi.fn()
    const unsub = subscribePendingSmartCapture(listener)

    setPendingSmartCapture(file)
    expect(listener).toHaveBeenCalledTimes(1)

    const consumed = consumePendingSmartCapture()
    expect(consumed).toBe(file)

    // 再次消费应返回 null，防止重复识别或滞留内存
    expect(consumePendingSmartCapture()).toBeNull()
    unsub()
  })
})
