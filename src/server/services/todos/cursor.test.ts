import { describe, expect, it } from 'vitest'
import {
  decodeDoneCursor,
  decodeOpenCursor,
  decodeTimeCursor,
  encodeDoneCursor,
  encodeOpenCursor,
  encodeTimeCursor,
} from './cursor'

const UUID = '0193f6b2-0000-7000-8000-000000000001'

describe('待办时间游标（TimeCursor / DoneCursor）', () => {
  const doneCursor = { doneAt: '2026-11-01T02:00:00.000Z', id: UUID }

  it('DoneCursor 兼容编解码', () => {
    expect(decodeDoneCursor(encodeDoneCursor(doneCursor))).toEqual(doneCursor)
  })

  it('TimeCursor 编解码', () => {
    const tc = { at: '2026-11-01T02:00:00.000Z', id: UUID }
    expect(decodeTimeCursor(encodeTimeCursor(tc))).toEqual(tc)
  })

  it.each(['', 'not-base64!', Buffer.from('{"d":1,"i":"x"}').toString('base64url')])(
    '不合法的游标返回 null：%s',
    (raw) => {
      expect(decodeDoneCursor(raw)).toBeNull()
      expect(decodeTimeCursor(raw)).toBeNull()
    },
  )

  it('id 不是 UUID 时返回 null', () => {
    const raw = Buffer.from(JSON.stringify({ t: doneCursor.doneAt, i: "1' or 1=1" })).toString(
      'base64url',
    )
    expect(decodeTimeCursor(raw)).toBeNull()
  })
})

describe('进行中待办游标（OpenCursor）', () => {
  it('支持有 DDL 与无 DDL 两种情况原样解码', () => {
    const withDue = {
      sortOrder: 3,
      dueAt: '2026-11-02T10:00:00.000Z',
      createdAt: '2026-11-01T02:00:00.000Z',
      id: UUID,
    }
    const withoutDue = {
      sortOrder: 4,
      dueAt: null,
      createdAt: '2026-11-01T02:00:00.000Z',
      id: UUID,
    }
    expect(decodeOpenCursor(encodeOpenCursor(withDue))).toEqual(withDue)
    expect(decodeOpenCursor(encodeOpenCursor(withoutDue))).toEqual(withoutDue)
  })

  it('非法 sortOrder 或非法时间返回 null', () => {
    const bad = Buffer.from(
      JSON.stringify({ o: 1.5, d: null, c: '2026-11-01T02:00:00.000Z', i: UUID }),
    ).toString('base64url')
    expect(decodeOpenCursor(bad)).toBeNull()
  })
})
