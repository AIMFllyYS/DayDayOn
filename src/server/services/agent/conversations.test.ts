import { describe, expect, it } from 'vitest'
import type { DbOrTx } from '@/server/db/client'
import { loadMessages, stripFileParts, titleFromFirstUserText } from './conversations'

function mockDb(
  conversationRow: { id: string; userId: string } | undefined,
  messageRows: Array<{
    messageId: string
    role: 'user' | 'assistant'
    parts: unknown[]
    createdAt: Date
  }> = [],
): DbOrTx {
  let callIndex = 0
  return {
    select: () => ({
      from: () => ({
        where: () => {
          callIndex += 1
          if (callIndex === 1) {
            return {
              limit: async () => (conversationRow ? [conversationRow] : []),
            }
          }
          return {
            orderBy: () => ({
              limit: async () => messageRows,
            }),
          }
        },
      }),
    }),
  } as unknown as DbOrTx
}

describe('titleFromFirstUserText', () => {
  it('空白文本回退为「新对话」', () => {
    expect(titleFromFirstUserText('')).toBe('新对话')
    expect(titleFromFirstUserText('   \n\t  ')).toBe('新对话')
  })

  it('折叠多空白并在超过 20 字时截断加省略号', () => {
    expect(titleFromFirstUserText('  今天   跑了 3 公里 ')).toBe('今天 跑了 3 公里')
    const long = '今天早上跑了五公里中午吃了番茄炒蛋晚上还要背单词'
    expect(titleFromFirstUserText(long)).toBe(`${long.slice(0, 20)}…`)
  })
})

describe('stripFileParts', () => {
  it('将连续的 file part 合并为一行不落盘说明文字，保留其他 part', () => {
    const parts = [
      { type: 'file', mediaType: 'image/jpeg', url: 'data:image/jpeg;base64,xxx' },
      { type: 'file', mediaType: 'image/jpeg', url: 'data:image/jpeg;base64,yyy' },
      { type: 'text', text: '帮我算下这顿午饭的热量' },
      { type: 'file', mediaType: 'image/jpeg', url: 'data:image/jpeg;base64,zzz' },
    ]
    expect(stripFileParts(parts)).toEqual([
      { type: 'text', text: '2 张照片（识别后不保存）' },
      { type: 'text', text: '帮我算下这顿午饭的热量' },
      { type: 'text', text: '1 张照片（识别后不保存）' },
    ])
  })
})

describe('loadMessages', () => {
  it('会话不存在且默认 allowMissing=false 时抛 404 NOT_FOUND', async () => {
    const db = mockDb(undefined)
    await expect(loadMessages(db, 'u1', 'conv-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    })
  })

  it('会话不存在但 allowMissing=true（新对话首轮发送）时返回空数组', async () => {
    const db = mockDb(undefined)
    await expect(loadMessages(db, 'u1', 'conv-new', { allowMissing: true })).resolves.toEqual([])
  })

  it('会话属于其他用户时，即使 allowMissing=true 也抛 404 NOT_FOUND 防越权', async () => {
    const db = mockDb({ id: 'conv-other', userId: 'u2' })
    await expect(
      loadMessages(db, 'u1', 'conv-other', { allowMissing: true }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    })
  })

  it('会话存在且属于本人时按序返回消息列表', async () => {
    const at = new Date('2026-11-02T06:00:00.000Z')
    const db = mockDb({ id: 'conv-1', userId: 'u1' }, [
      {
        messageId: 'm1',
        role: 'user',
        parts: [{ type: 'text', text: '你好团团' }],
        createdAt: at,
      },
    ])
    const res = await loadMessages(db, 'u1', 'conv-1', { allowMissing: true })
    expect(res).toEqual([
      {
        id: 'm1',
        role: 'user',
        parts: [{ type: 'text', text: '你好团团' }],
        createdAt: at,
      },
    ])
  })
})
