import { describe, expect, it } from 'vitest'
import { decodeDoneCursor, encodeDoneCursor } from './cursor'

describe('已完成待办的游标', () => {
  const cursor = { doneAt: '2026-11-01T02:00:00.000Z', id: '0193f6b2-0000-7000-8000-000000000001' }

  it('编码后能原样解码', () => {
    expect(decodeDoneCursor(encodeDoneCursor(cursor))).toEqual(cursor)
  })

  it.each(['', 'not-base64!', Buffer.from('{"d":1,"i":"x"}').toString('base64url')])(
    '不合法的游标返回 null：%s',
    (raw) => {
      expect(decodeDoneCursor(raw)).toBeNull()
    },
  )

  it('id 不是 UUID 时返回 null', () => {
    const raw = Buffer.from(JSON.stringify({ d: cursor.doneAt, i: "1' or 1=1" })).toString(
      'base64url',
    )
    expect(decodeDoneCursor(raw)).toBeNull()
  })
})
