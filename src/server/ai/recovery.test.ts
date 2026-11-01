import { describe, expect, it, vi } from 'vitest'
import { reservationFromLedger, withRetry } from './recovery'

describe('withRetry', () => {
  it('第一次成功就不重试', async () => {
    const fn = vi.fn(async () => 'ok')
    await expect(withRetry(fn, { attempts: 3, delayMs: 0 })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('失败后重试，直到成功', async () => {
    let n = 0
    const fn = vi.fn(async () => {
      n += 1
      if (n < 3) throw new Error('连接被重置')
      return n
    })
    await expect(withRetry(fn, { attempts: 3, delayMs: 0 })).resolves.toBe(3)
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('次数用完抛出最后一次的错误', async () => {
    let n = 0
    const fn = vi.fn(async () => {
      n += 1
      throw new Error(`第 ${n} 次`)
    })
    await expect(withRetry(fn, { attempts: 2, delayMs: 0 })).rejects.toThrow('第 2 次')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('reservationFromLedger', () => {
  it('从预占流水还原两部分金额（流水里是负数）', () => {
    expect(
      reservationFromLedger([
        { kind: 'reserve', bucket: 'weekly', amountMicros: -3000 },
        { kind: 'reserve', bucket: 'bonus', amountMicros: -500 },
      ]),
    ).toEqual({ weeklyMicros: 3000, bonusMicros: 500 })
  })

  it('只预占了本周额度', () => {
    expect(
      reservationFromLedger([{ kind: 'reserve', bucket: 'weekly', amountMicros: -3000 }]),
    ).toEqual({ weeklyMicros: 3000, bonusMicros: 0 })
  })

  it('已经结算或释放过：返回 null，不再退一次', () => {
    expect(
      reservationFromLedger([
        { kind: 'reserve', bucket: 'weekly', amountMicros: -3000 },
        { kind: 'settle', bucket: 'weekly', amountMicros: 2000 },
      ]),
    ).toBeNull()
    expect(
      reservationFromLedger([
        { kind: 'reserve', bucket: 'bonus', amountMicros: -3000 },
        { kind: 'release', bucket: 'bonus', amountMicros: 3000 },
      ]),
    ).toBeNull()
  })

  it('没有预占流水：返回 null', () => {
    expect(reservationFromLedger([])).toBeNull()
  })
})
