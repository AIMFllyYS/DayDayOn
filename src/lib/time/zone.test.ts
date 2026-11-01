import { describe, expect, it } from 'vitest'
import {
  calendarDateOf,
  combineLocal,
  combineLocalDateTime,
  dayKey,
  isValidTimeZone,
  localDateOf,
  localTimeOf,
  monthKey,
  monthRange,
  nextDayStartsAt,
  nextWeekStartsAt,
  secondsBetween,
  sleepRange,
  sleepRangeForDay,
  toLocalDateTimeValue,
  weekKey,
  weekRange,
} from './zone'

// 规范：time-and-dates.md 第 6 节。所有时刻都是固定字面量，本机与 CI（TZ=UTC）都要通过
const SH = 'Asia/Shanghai'
const NY = 'America/New_York'

describe('localDateOf', () => {
  it('跨午夜：零点换日时 23:59 算当天，00:00 算第二天', () => {
    expect(localDateOf('2026-10-31T15:59:00Z', SH, 0)).toBe('2026-10-31')
    expect(localDateOf('2026-10-31T16:00:00Z', SH, 0)).toBe('2026-11-01')
  })

  it('默认 4 点换日：23:59 与 00:00 都算当天', () => {
    expect(localDateOf('2026-10-31T15:59:00Z', SH)).toBe('2026-10-31')
    expect(localDateOf('2026-10-31T16:00:00Z', SH)).toBe('2026-10-31')
  })

  it('换日边界：03:59 仍算前一天，04:00 算新的一天', () => {
    // 北京时间 2026-11-01 03:59:59 / 04:00:00
    expect(localDateOf('2026-10-31T19:59:59Z', SH, 4)).toBe('2026-10-31')
    expect(localDateOf('2026-10-31T20:00:00Z', SH, 4)).toBe('2026-11-01')
  })

  it('换日时间可调：6 点换日时 05:59 算前一天', () => {
    expect(localDateOf('2026-10-31T21:59:00Z', SH, 6)).toBe('2026-10-31')
    expect(localDateOf('2026-10-31T22:00:00Z', SH, 6)).toBe('2026-11-01')
  })

  it('跨月、跨年的换日', () => {
    // 北京时间 2027-01-01 03:00 → 仍是 2026-12-31
    expect(localDateOf('2026-12-31T19:00:00Z', SH)).toBe('2026-12-31')
    // 北京时间 2026-03-01 02:00 → 2026-02-28（2026 不是闰年）
    expect(localDateOf('2026-02-28T18:00:00Z', SH)).toBe('2026-02-28')
  })

  it('用户时区不是北京时间时按用户时区算', () => {
    // 2026-11-01T03:30Z：纽约 10-31 23:30（夏令时 UTC-4），北京 11-01 11:30
    expect(localDateOf('2026-11-01T03:30:00Z', NY)).toBe('2026-10-31')
    expect(localDateOf('2026-11-01T03:30:00Z', SH)).toBe('2026-11-01')
    // 纽约 2026-11-01 04:00 EST（夏令时结束后）= 09:00Z
    expect(localDateOf('2026-11-01T08:59:00Z', NY)).toBe('2026-10-31')
    expect(localDateOf('2026-11-01T09:00:00Z', NY)).toBe('2026-11-01')
  })

  it('接受 Date 与毫秒时间戳', () => {
    const d = new Date('2026-10-31T20:00:00Z')
    expect(localDateOf(d, SH)).toBe('2026-11-01')
    expect(localDateOf(d.getTime(), SH)).toBe('2026-11-01')
  })

  it('无效入参抛 RangeError', () => {
    expect(() => localDateOf('not-a-date', SH)).toThrow(RangeError)
    expect(() => localDateOf('2026-10-31T00:00:00Z', SH, 24)).toThrow(RangeError)
    expect(() => localDateOf('2026-10-31T00:00:00Z', SH, 1.5)).toThrow(RangeError)
  })
})

describe('calendarDateOf / localTimeOf', () => {
  it('不做日切换偏移', () => {
    expect(calendarDateOf('2026-10-31T19:59:00Z', SH)).toBe('2026-11-01')
    expect(localTimeOf('2026-10-31T19:59:00Z', SH)).toBe('03:59')
    expect(localTimeOf('2026-10-31T16:00:00Z', SH)).toBe('00:00')
  })
})

describe('dayKey', () => {
  it('按北京时间零点换日', () => {
    expect(dayKey('2026-10-31T15:59:59Z')).toBe('2026-10-31')
    expect(dayKey('2026-10-31T16:00:00Z')).toBe('2026-11-01')
  })
})

describe('weekKey', () => {
  it('周一切换：北京时间周日 23:59:59 属于本周，周一 00:00:00 属于下周', () => {
    // 2026-11-01 是周日
    expect(weekKey('2026-11-01T15:59:59Z')).toBe('2026-W44')
    expect(weekKey('2026-11-01T16:00:00Z')).toBe('2026-W45')
  })

  it('2026-10-31 在 W44', () => {
    expect(weekKey(new Date('2026-10-31T15:59:59Z'))).toBe('2026-W44')
  })

  it('跨年的 ISO 周：2025-12-29（周一）起属于 2026-W01', () => {
    expect(weekKey('2025-12-28T15:59:59Z')).toBe('2025-W52')
    expect(weekKey('2025-12-28T16:00:00Z')).toBe('2026-W01')
  })

  it('跨年的 ISO 周：2027-01-01 属于 2026-W53', () => {
    expect(weekKey('2026-12-31T16:00:00Z')).toBe('2026-W53')
    expect(weekKey('2027-01-03T15:59:59Z')).toBe('2026-W53')
    expect(weekKey('2027-01-03T16:00:00Z')).toBe('2027-W01')
  })

  it('周键与用户时区无关：纽约还是周日时北京已是周一', () => {
    // 2026-11-01T16:00Z：纽约 11-01 11:00（周日），北京 11-02 00:00（周一）
    expect(localDateOf('2026-11-01T16:00:00Z', NY, 0)).toBe('2026-11-01')
    expect(weekKey('2026-11-01T16:00:00Z')).toBe('2026-W45')
  })
})

describe('monthKey', () => {
  it('按北京时间换月', () => {
    expect(monthKey('2026-10-31T15:59:59Z')).toBe('2026-10')
    expect(monthKey('2026-10-31T16:00:00Z')).toBe('2026-11')
    expect(monthKey('2026-12-31T16:00:00Z')).toBe('2027-01')
  })
})

describe('weekRange / monthRange', () => {
  it('周榜区间是北京时间的周一到周日', () => {
    expect(weekRange('2026-11-01T15:59:59Z')).toEqual({ start: '2026-10-26', end: '2026-11-01' })
    expect(weekRange('2026-11-01T16:00:00Z')).toEqual({ start: '2026-11-02', end: '2026-11-08' })
  })

  it('跨年的周', () => {
    expect(weekRange('2026-12-31T16:00:00Z')).toEqual({ start: '2026-12-28', end: '2027-01-03' })
  })

  it('月榜区间是北京时间的自然月', () => {
    expect(monthRange('2026-10-31T15:59:59Z')).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    expect(monthRange('2026-10-31T16:00:00Z')).toEqual({ start: '2026-11-01', end: '2026-11-30' })
    expect(monthRange('2026-12-15T00:00:00Z')).toEqual({ start: '2026-12-01', end: '2026-12-31' })
    expect(monthRange('2028-02-10T00:00:00Z')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })
})

describe('nextWeekStartsAt / nextDayStartsAt', () => {
  it('下一个北京时间周一 00:00', () => {
    expect(nextWeekStartsAt('2026-11-01T15:59:59Z').toISOString()).toBe('2026-11-01T16:00:00.000Z')
    expect(nextWeekStartsAt('2026-11-01T16:00:00Z').toISOString()).toBe('2026-11-08T16:00:00.000Z')
  })

  it('下一个北京时间 00:00', () => {
    expect(nextDayStartsAt('2026-10-31T15:59:59Z').toISOString()).toBe('2026-10-31T16:00:00.000Z')
    expect(nextDayStartsAt('2026-10-31T16:00:00Z').toISOString()).toBe('2026-11-01T16:00:00.000Z')
  })
})

describe('combineLocal', () => {
  it('本地日期 + 时分 → 时刻', () => {
    expect(combineLocal('2026-10-31', '23:30', SH).toISOString()).toBe('2026-10-31T15:30:00.000Z')
    expect(combineLocal('2026-11-01', '00:00', SH).toISOString()).toBe('2026-10-31T16:00:00.000Z')
    expect(combineLocal('2026-10-31', '23:30', 'UTC').toISOString()).toBe(
      '2026-10-31T23:30:00.000Z',
    )
  })

  it('非北京时区，含夏令时前后', () => {
    expect(combineLocal('2026-10-31', '23:30', NY).toISOString()).toBe('2026-11-01T03:30:00.000Z')
    expect(combineLocal('2026-11-02', '08:00', NY).toISOString()).toBe('2026-11-02T13:00:00.000Z')
  })

  it('与 localDateOf 往返一致', () => {
    const at = combineLocal('2026-11-01', '04:00', SH)
    expect(localDateOf(at, SH)).toBe('2026-11-01')
    expect(localDateOf(new Date(at.getTime() - 1000), SH)).toBe('2026-10-31')
  })

  it('格式错误抛 RangeError', () => {
    expect(() => combineLocal('2026-02-30', '10:00', SH)).toThrow(RangeError)
    expect(() => combineLocal('2026-10-31', '24:00', SH)).toThrow(RangeError)
    expect(() => combineLocal('2026/10/31', '10:00', SH)).toThrow(RangeError)
  })
})

describe('combineLocalDateTime / toLocalDateTimeValue', () => {
  it('datetime-local 往返', () => {
    const at = combineLocalDateTime('2026-11-02T18:00', SH)
    expect(at.toISOString()).toBe('2026-11-02T10:00:00.000Z')
    expect(toLocalDateTimeValue(at, SH)).toBe('2026-11-02T18:00')
  })

  it('格式错误抛 RangeError', () => {
    expect(() => combineLocalDateTime('2026-11-02', SH)).toThrow(RangeError)
  })
})

describe('secondsBetween', () => {
  it('b − a 的秒数', () => {
    expect(secondsBetween('2026-10-31T15:00:00Z', '2026-10-31T15:30:00Z')).toBe(1800)
    expect(secondsBetween('2026-10-31T15:30:00Z', '2026-10-31T15:00:00Z')).toBe(-1800)
    expect(secondsBetween(new Date(0), new Date(1999))).toBe(1)
  })
})

describe('sleepRange', () => {
  it('跨午夜：起床早于入睡算次日', () => {
    const r = sleepRange('2026-10-31', '23:30', '07:00', SH)
    expect(r).not.toBeNull()
    expect(r?.bedAt.toISOString()).toBe('2026-10-31T15:30:00.000Z')
    expect(r?.wakeAt.toISOString()).toBe('2026-10-31T23:00:00.000Z')
    expect(r?.durationSeconds).toBe(7.5 * 3600)
    expect(r?.nextDay).toBe(true)
  })

  it('同一天内的睡眠（午睡、凌晨才睡）', () => {
    const r = sleepRange('2026-11-01', '01:00', '09:00', SH)
    expect(r?.nextDay).toBe(false)
    expect(r?.durationSeconds).toBe(8 * 3600)
  })

  it('起床时间等于入睡时间视为输入错误', () => {
    expect(sleepRange('2026-10-31', '23:00', '23:00', SH)).toBeNull()
  })

  it('非北京时区跨夏令时结束：墙上 8 小时实际 9 小时', () => {
    // 纽约 2026-11-01 02:00 回拨到 01:00
    const r = sleepRange('2026-10-31', '23:00', '07:00', NY)
    expect(r?.durationSeconds).toBe(9 * 3600)
  })
})

describe('sleepRangeForDay', () => {
  it('起床 = 打卡日的该时分，入睡晚于起床取前一天', () => {
    const r = sleepRangeForDay('2026-11-01', '23:30', '07:00', SH)
    expect(r?.bedAt.toISOString()).toBe('2026-10-31T15:30:00.000Z')
    expect(r?.wakeAt.toISOString()).toBe('2026-10-31T23:00:00.000Z')
    expect(localDateOf(r?.wakeAt ?? 0, SH)).toBe('2026-11-01')
  })

  it('起床早于换日时间时，墙上日期是打卡日次日，localDateOf 仍是打卡日', () => {
    const r = sleepRangeForDay('2026-10-31', '22:00', '03:30', SH, 4)
    expect(r?.wakeAt.toISOString()).toBe('2026-10-31T19:30:00.000Z')
    expect(r?.bedAt.toISOString()).toBe('2026-10-31T14:00:00.000Z')
    expect(localDateOf(r?.wakeAt ?? 0, SH, 4)).toBe('2026-10-31')
  })

  it('起床等于入睡视为输入错误', () => {
    expect(sleepRangeForDay('2026-11-01', '07:00', '07:00', SH)).toBeNull()
  })
})

describe('isValidTimeZone', () => {
  it('识别 IANA 时区名', () => {
    expect(isValidTimeZone(SH)).toBe(true)
    expect(isValidTimeZone(NY)).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })
})
