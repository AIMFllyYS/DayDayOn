import { describe, expect, it } from 'vitest'
import { myRankNote } from './format'

const baseEntry = {
  rank: 2,
  userId: 'u1',
  nickname: '小满',
  avatar: null,
  days: 5,
  streak: 5,
}

describe('rank format myRankNote', () => {
  it('第一名展示保持提示', () => {
    expect(myRankNote({ optedIn: true, entry: { ...baseEntry, rank: 1 }, daysToNext: null })).toBe(
      '我 · 暂列第一，继续保持',
    )
  })

  it('落后前一名时展示追赶天数', () => {
    expect(myRankNote({ optedIn: true, entry: baseEntry, daysToNext: 2 })).toBe(
      '我 · 再打卡 2 天追上前一名',
    )
  })

  it('与前一名同天数时不展示冗长解释，简洁展示「我」避免换行', () => {
    expect(myRankNote({ optedIn: true, entry: baseEntry, daysToNext: null })).toBe('我')
  })
})
