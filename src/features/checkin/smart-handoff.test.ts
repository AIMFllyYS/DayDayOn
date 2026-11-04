import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildRelativeMediaPath,
  consumePendingSmartCapture,
  deleteSmartHistoryRecord,
  listSmartHistory,
  markSmartHistoryConfirmed,
  resetSmartHistoryForTests,
  saveSmartHistoryRecord,
  setPendingSmartCapture,
} from './smart-handoff'

describe('smart-handoff', () => {
  beforeEach(() => {
    consumePendingSmartCapture()
    resetSmartHistoryForTests([])
  })

  it('setPendingSmartCapture 支持智能拍照与智能上传双模式且一次性消费', () => {
    const file = new File(['hello'], 'test.jpg', { type: 'image/jpeg' })
    const payload = setPendingSmartCapture({ file, mode: 'smart-upload' })
    expect(payload.mode).toBe('smart-upload')
    expect(payload.file.name).toBe('test.jpg')

    const consumed = consumePendingSmartCapture()
    expect(consumed?.id).toBe(payload.id)
    expect(consumePendingSmartCapture()).toBeNull()
  })

  it('buildRelativeMediaPath 只生成相对路径字符串并清理非法字符', () => {
    const date = new Date('2026-11-05T08:00:00Z')
    const p1 = buildRelativeMediaPath('IMG 2026:01?.jpg', 'smart-capture', date)
    expect(p1).toBe('captures/2026-11-05/IMG_2026_01_.jpg')

    const p2 = buildRelativeMediaPath('notes.html', 'smart-upload', date)
    expect(p2).toBe('uploads/2026-11-05/notes.html')
  })

  it('历史记录保存相对路径、支持确认入库标记与删除', () => {
    const record = saveSmartHistoryRecord({
      mode: 'smart-capture',
      mediaKind: 'image',
      fileName: 'receipt.jpg',
      result: {
        aiRunId: '0193f6b2-0000-7000-8000-000000000123',
        draft: {
          detectedModule: 'custom',
          matchedGoalId: null,
          confidence: 0.9,
          summary: '账单 68.34 元',
          scanSteps: ['步骤1', '步骤2', '步骤3'],
          exercise: null,
          diet: null,
          sleep: null,
          study: null,
          custom: { values: { done: true }, note: '测试备注' },
        },
      },
    })

    expect(record.relativeImagePath).toMatch(/^captures\/\d{4}-\d{2}-\d{2}\/receipt\.jpg$/)
    expect(record.confirmed).toBe(false)
    expect(listSmartHistory()).toHaveLength(1)

    markSmartHistoryConfirmed('0193f6b2-0000-7000-8000-000000000123', '我的小目标')
    expect(listSmartHistory()[0]?.confirmed).toBe(true)
    expect(listSmartHistory()[0]?.confirmedGoalTitle).toBe('我的小目标')

    deleteSmartHistoryRecord(record.id)
    expect(listSmartHistory()).toHaveLength(0)
  })
})
