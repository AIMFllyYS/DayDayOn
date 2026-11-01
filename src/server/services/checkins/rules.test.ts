import { describe, expect, it } from 'vitest'
import {
  calendarDays,
  checkSleepTimes,
  decodeCursor,
  encodeCursor,
  estimateBurnKcal,
  intakeKcalOf,
  isUniqueViolation,
  metOf,
  monthBounds,
  serverOccurredAt,
  targetDayOf,
} from './rules'

const sh = { timeZone: 'Asia/Shanghai', dayStartHour: 4 }
const ny = { timeZone: 'America/New_York', dayStartHour: 4 }

describe('打卡日与补卡时刻', () => {
  // 北京时间 2026-11-01 10:00
  const now = new Date('2026-11-01T02:00:00Z')

  it('今天的打卡日按用户时区算', () => {
    expect(targetDayOf(now, sh, false)).toBe('2026-11-01')
    expect(targetDayOf(now, ny, false)).toBe('2026-10-31')
  })

  it('凌晨 3:59 仍算前一天，补卡则再往前一天', () => {
    const late = new Date('2026-10-31T19:59:00Z') // 北京 11-01 03:59
    expect(targetDayOf(late, sh, false)).toBe('2026-10-31')
    expect(targetDayOf(late, sh, true)).toBe('2026-10-30')
  })

  it('非补卡取 now；补卡取昨天打卡日 12:00（用户时区）', () => {
    expect(serverOccurredAt(now, sh, false)).toEqual(now)
    expect(serverOccurredAt(now, sh, true).toISOString()).toBe('2026-10-31T04:00:00.000Z')
  })
})

describe('睡眠时刻校验', () => {
  const now = new Date('2026-11-01T02:00:00Z') // 北京 11-01 10:00
  const bed = new Date('2026-10-31T15:30:00Z') // 北京 23:30
  const wake = new Date('2026-10-31T23:30:00Z') // 北京 07:30

  it('今天起床的睡眠通过，记到起床时刻', () => {
    expect(checkSleepTimes(bed, wake, now, sh, false)).toEqual({ ok: true, occurredAt: wake })
  })

  it('起床时间在未来：拒绝', () => {
    const r = checkSleepTimes(bed, new Date('2026-11-01T03:00:00Z'), now, sh, false)
    expect(r.ok).toBe(false)
  })

  it('起床在昨天但没开补卡：拒绝；开补卡：通过', () => {
    const bed2 = new Date('2026-10-30T15:30:00Z')
    const wake2 = new Date('2026-10-30T23:30:00Z')
    expect(checkSleepTimes(bed2, wake2, now, sh, false).ok).toBe(false)
    expect(checkSleepTimes(bed2, wake2, now, sh, true).ok).toBe(true)
  })

  it('补卡却填了今天的起床：拒绝', () => {
    expect(checkSleepTimes(bed, wake, now, sh, true).ok).toBe(false)
  })

  it('入睡不早于起床：拒绝', () => {
    expect(checkSleepTimes(wake, wake, now, sh, false).ok).toBe(false)
  })
})

describe('运动消耗估算', () => {
  it('MET × kg × h，四舍五入', () => {
    // 跑步适中 8.3 × 60kg × 0.5h = 249
    expect(estimateBurnKcal('跑步', 'moderate', 1800, 60_000)).toBe(249)
  })

  it('没有体重记录时不估算', () => {
    expect(estimateBurnKcal('跑步', 'moderate', 1800, null)).toBeNull()
  })

  it('用户新建的品类按"其他"查表', () => {
    expect(metOf('飞盘', 'hard')).toBe(metOf('其他', 'hard'))
  })
})

describe('饮食摄入', () => {
  it('只累加填了热量的条目；全空为 null', () => {
    expect(
      intakeKcalOf([
        { name: '米饭', portion: '', kcal: 170 },
        { name: '青菜', portion: '', kcal: null },
        { name: '鸡蛋', portion: '', kcal: 80 },
      ]),
    ).toBe(250)
    expect(intakeKcalOf([{ name: '水果', portion: '', kcal: null }])).toBeNull()
  })
})

describe('日历聚合', () => {
  const row = (localDate: string, isMakeup: boolean, durationSeconds: number) => ({
    localDate,
    isMakeup,
    durationSeconds,
    count: 1,
    mealType: null,
    occurredAt: '2026-11-01T00:00:00.000Z',
  })

  it('按日聚合、升序，区分达成与只有补卡的日子', () => {
    const days = calendarDays(
      [row('2026-11-03', false, 1000), row('2026-11-01', true, 1800), row('2026-11-03', true, 900)],
      'exercise',
      () => ({ kind: 'duration', value: 1800, weekdays: [1, 2, 3, 4, 5, 6, 7] }),
    )
    expect(days).toEqual([
      { localDate: '2026-11-01', count: 1, done: true, makeupOnly: true },
      { localDate: '2026-11-03', count: 2, done: true, makeupOnly: false },
    ])
  })

  it('月份边界：12 月的下一个月是次年 1 月', () => {
    expect(monthBounds('2026-12')).toEqual({ from: '2026-12-01', until: '2027-01-01' })
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', until: '2026-03-01' })
  })
})

describe('游标', () => {
  it('编码后能解码回来', () => {
    const c = { localDate: '2026-11-01', id: '0193f6b2-0000-7000-8000-000000000000' }
    expect(decodeCursor(encodeCursor(c))).toEqual(c)
  })

  it('乱写的游标解析为 null', () => {
    expect(decodeCursor('abc')).toBeNull()
    expect(decodeCursor(Buffer.from('["x",1]').toString('base64url'))).toBeNull()
  })
})

describe('唯一冲突识别', () => {
  it('能穿过 drizzle 的包装找到 23505', () => {
    const err = new Error('query failed', { cause: { code: '23505', constraint: 'k' } })
    expect(isUniqueViolation(err)).toBe(true)
    expect(isUniqueViolation(err, 'k')).toBe(true)
    expect(isUniqueViolation(err, 'other')).toBe(false)
    expect(isUniqueViolation(new Error('x'))).toBe(false)
  })
})
