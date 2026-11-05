import { describe, expect, it } from 'vitest'
import { isAgentEditable } from './edit-window'

describe('isAgentEditable：Agent 只能改今天和昨天', () => {
  const today = '2026-11-05'
  it('今天、昨天可以改', () => {
    expect(isAgentEditable('2026-11-05', today)).toBe(true)
    expect(isAgentEditable('2026-11-04', today)).toBe(true)
  })
  it('前天和更早、以及将来的日子都不行', () => {
    expect(isAgentEditable('2026-11-03', today)).toBe(false)
    expect(isAgentEditable('2026-10-05', today)).toBe(false)
    expect(isAgentEditable('2026-11-06', today)).toBe(false)
  })
  it('跨月：11 月 1 日的昨天是 10 月 31 日', () => {
    expect(isAgentEditable('2026-10-31', '2026-11-01')).toBe(true)
    expect(isAgentEditable('2026-10-30', '2026-11-01')).toBe(false)
  })
})
