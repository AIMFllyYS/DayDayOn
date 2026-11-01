import { describe, expect, it } from 'vitest'
import { FEED_LIMIT, feedSince, shapeFeed, type FeedSourceRow } from './feed'

const NOW = new Date('2026-11-01T04:00:00Z')

let seq = 0
function src(over: Partial<FeedSourceRow> = {}): FeedSourceRow {
  seq += 1
  return {
    checkinId: `0193f6b2-0000-7000-8000-${String(seq).padStart(12, '0')}`,
    userId: 'u1',
    nickname: '阿柚',
    avatar: null,
    module: 'exercise',
    occurredAt: new Date('2026-11-01T03:00:00Z'),
    leaderboardOptIn: true,
    onboardedAt: new Date('2026-10-01T00:00:00Z'),
    banned: false,
    banExpires: null,
    ...over,
  }
}

describe('feedSince', () => {
  it('往前 24 小时', () => {
    expect(feedSince(NOW).toISOString()).toBe('2026-10-31T04:00:00.000Z')
  })
})

describe('shapeFeed', () => {
  it('只留昵称、头像、板块和时间：不带任何数值、备注或资料字段', () => {
    const [item] = shapeFeed([src({ avatar: 'mascot:tuan:happy:exercise' })], NOW)
    expect(item && Object.keys(item).sort()).toEqual(
      ['avatar', 'id', 'module', 'nickname', 'occurredAt', 'userId'].sort(),
    )
    expect(item).toMatchObject({
      nickname: '阿柚',
      avatar: 'mascot:tuan:happy:exercise',
      module: 'exercise',
      occurredAt: '2026-11-01T03:00:00.000Z',
    })
  })

  it('按时间倒序，最多 10 条', () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      src({ occurredAt: new Date(NOW.getTime() - (i + 1) * 60_000) }),
    ).reverse()
    const items = shapeFeed(rows, NOW)
    expect(items).toHaveLength(FEED_LIMIT)
    const times = items.map((i) => Date.parse(i.occurredAt))
    expect([...times].sort((a, b) => b - a)).toEqual(times)
    expect(items[0]?.occurredAt).toBe('2026-11-01T03:59:00.000Z')
  })

  it('24 小时窗口：正好 24 小时前保留，更早和未来的去掉', () => {
    const items = shapeFeed(
      [
        src({ occurredAt: new Date('2026-10-31T04:00:00Z') }),
        src({ occurredAt: new Date('2026-10-31T03:59:59Z') }),
        src({ occurredAt: new Date('2026-11-01T04:00:01Z') }),
      ],
      NOW,
    )
    expect(items.map((i) => i.occurredAt)).toEqual(['2026-10-31T04:00:00.000Z'])
  })

  it('没上榜、被封（未到期）的人不出现；封禁已到期的恢复', () => {
    const items = shapeFeed(
      [
        src({ userId: 'off', leaderboardOptIn: false }),
        src({ userId: 'banned', banned: true }),
        src({ userId: 'until', banned: true, banExpires: new Date('2026-12-01T00:00:00Z') }),
        src({ userId: 'expired', banned: true, banExpires: new Date('2026-10-01T00:00:00Z') }),
      ],
      NOW,
    )
    expect(items.map((i) => i.userId)).toEqual(['expired'])
  })
})
