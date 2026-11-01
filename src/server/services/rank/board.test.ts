import { describe, expect, it } from 'vitest'
import {
  buildRankBoard,
  compareRankRows,
  daysToNext,
  isRankEligible,
  RANK_TOP_N,
  rankEntries,
  toRankRow,
  type RankCandidate,
  type RankRow,
} from './board'

const NOW = new Date('2026-11-01T04:00:00Z')

const row = (over: Partial<RankRow> & Pick<RankRow, 'userId'>): RankRow => ({
  nickname: over.userId,
  avatar: null,
  days: 0,
  streak: 0,
  lastCheckinAt: null,
  ...over,
})

const candidate = (
  userId: string,
  dates: { d: string; at: string; makeup?: boolean }[],
  streak = 0,
): RankCandidate => ({
  userId,
  nickname: userId,
  avatar: null,
  streak,
  checkins: dates.map((x) => ({ localDate: x.d, occurredAt: x.at, isMakeup: x.makeup ?? false })),
})

describe('isRankEligible', () => {
  const base = {
    leaderboardOptIn: true,
    onboardedAt: new Date('2026-10-01T00:00:00Z'),
    nickname: '阿柚',
    banned: false,
    banExpires: null,
  }

  it('上榜、已引导、有昵称、未封：可以出现', () => {
    expect(isRankEligible(base, NOW)).toBe(true)
  })

  it('没上榜、没完成引导、没有昵称：都不出现', () => {
    expect(isRankEligible({ ...base, leaderboardOptIn: false }, NOW)).toBe(false)
    expect(isRankEligible({ ...base, onboardedAt: null }, NOW)).toBe(false)
    expect(isRankEligible({ ...base, nickname: null }, NOW)).toBe(false)
    expect(isRankEligible({ ...base, nickname: '' }, NOW)).toBe(false)
  })

  it('被封：不出现；封禁到期后恢复', () => {
    expect(isRankEligible({ ...base, banned: true }, NOW)).toBe(false)
    expect(
      isRankEligible({ ...base, banned: true, banExpires: new Date('2026-12-01T00:00:00Z') }, NOW),
    ).toBe(false)
    expect(
      isRankEligible({ ...base, banned: true, banExpires: new Date('2026-10-31T00:00:00Z') }, NOW),
    ).toBe(true)
  })
})

describe('toRankRow', () => {
  it('补卡不计天数，同一天多次只算一天', () => {
    const r = toRankRow(
      candidate('a', [
        { d: '2026-10-26', at: '2026-10-26T01:00:00Z' },
        { d: '2026-10-26', at: '2026-10-26T09:00:00Z' },
        { d: '2026-10-27', at: '2026-10-28T04:00:00Z', makeup: true },
        { d: '2026-10-28', at: '2026-10-28T02:00:00Z' },
      ]),
    )
    expect(r.days).toBe(2)
  })

  it('最后打卡时间只看非补卡', () => {
    const r = toRankRow(
      candidate('a', [
        { d: '2026-10-26', at: '2026-10-26T01:00:00Z' },
        { d: '2026-10-27', at: '2026-10-28T04:00:00Z', makeup: true },
      ]),
    )
    expect(r.lastCheckinAt).toBe('2026-10-26T01:00:00Z')
  })

  it('只有补卡：天数 0、没有最后打卡时间', () => {
    const r = toRankRow(
      candidate('a', [{ d: '2026-10-27', at: '2026-10-28T04:00:00Z', makeup: true }]),
    )
    expect(r).toMatchObject({ days: 0, lastCheckinAt: null })
  })
})

describe('并列排序', () => {
  it('天数多的在前', () => {
    const sorted = [row({ userId: 'a', days: 3 }), row({ userId: 'b', days: 5 })].sort(
      compareRankRows,
    )
    expect(sorted.map((r) => r.userId)).toEqual(['b', 'a'])
  })

  it('天数相同：连续天数多的在前', () => {
    const sorted = [
      row({ userId: 'a', days: 5, streak: 2 }),
      row({ userId: 'b', days: 5, streak: 9 }),
    ].sort(compareRankRows)
    expect(sorted.map((r) => r.userId)).toEqual(['b', 'a'])
  })

  it('天数和连续天数都相同：最后一次打卡更早的在前（先到先得）', () => {
    const sorted = [
      row({ userId: 'a', days: 5, streak: 5, lastCheckinAt: '2026-11-01T02:00:00.000Z' }),
      row({ userId: 'b', days: 5, streak: 5, lastCheckinAt: '2026-11-01T01:59:59.000Z' }),
    ].sort(compareRankRows)
    expect(sorted.map((r) => r.userId)).toEqual(['b', 'a'])
  })

  it('没有打卡时间的排在有的后面；全部相同时按 userId 稳定排序', () => {
    const sorted = [
      row({ userId: 'c' }),
      row({ userId: 'b', lastCheckinAt: '2026-11-01T01:00:00.000Z' }),
      row({ userId: 'a' }),
    ].sort(compareRankRows)
    expect(sorted.map((r) => r.userId)).toEqual(['b', 'a', 'c'])
  })

  it('rankEntries 编号从 1 开始，去掉内部字段', () => {
    const entries = rankEntries([row({ userId: 'a', days: 1 }), row({ userId: 'b', days: 2 })])
    expect(entries).toEqual([
      { userId: 'b', nickname: 'b', avatar: null, rank: 1, days: 2, streak: 0 },
      { userId: 'a', nickname: 'a', avatar: null, rank: 2, days: 1, streak: 0 },
    ])
  })
})

describe('再打卡 N 天追上前一名', () => {
  const sorted = rankEntries([
    row({ userId: 'a', days: 7 }),
    row({ userId: 'b', days: 4 }),
    row({ userId: 'c', days: 4, streak: 0 }),
  ])

  it('第一名为 null', () => {
    expect(daysToNext(sorted, 0)).toBeNull()
  })

  it('差几天就是几天', () => {
    expect(sorted[1]?.userId).toBe('b')
    expect(daysToNext(sorted, 1)).toBe(3)
  })

  it('天数和前一名相同（并列规则排在后面）为 null', () => {
    expect(daysToNext(sorted, 2)).toBeNull()
  })

  it('越界为 null', () => {
    expect(daysToNext(sorted, 5)).toBeNull()
    expect(daysToNext(sorted, -1)).toBeNull()
  })
})

describe('buildRankBoard', () => {
  it('我没上榜：optedIn false', () => {
    const board = buildRankBoard({
      range: 'week',
      from: '2026-10-26',
      to: '2026-11-01',
      candidates: [candidate('a', [])],
      meUserId: 'me',
    })
    expect(board.me).toEqual({ optedIn: false })
    expect(board.entries).toHaveLength(1)
  })

  it('最多 50 名；我排在 50 名之外也能拿到自己的名次和差距', () => {
    const candidates = Array.from({ length: 60 }, (_, i) =>
      candidate(
        `u${String(i).padStart(2, '0')}`,
        Array.from({ length: 60 - i }, (_, d) => ({
          d: `2026-10-${String((d % 31) + 1).padStart(2, '0')}`,
          at: `2026-10-${String((d % 31) + 1).padStart(2, '0')}T00:00:00Z`,
        })),
      ),
    )
    // u55 的天数：min(60-55, 31) = 5；前一名 u54 = 6
    const board = buildRankBoard({
      range: 'month',
      from: '2026-10-01',
      to: '2026-10-31',
      candidates,
      meUserId: 'u55',
    })
    expect(board.entries).toHaveLength(RANK_TOP_N)
    expect(board.me.optedIn).toBe(true)
    if (board.me.optedIn) {
      expect(board.me.entry.days).toBe(5)
      expect(board.me.entry.rank).toBe(56)
      expect(board.me.daysToNext).toBe(1)
    }
  })
})
