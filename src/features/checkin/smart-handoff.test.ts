import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildRelativeMediaPath,
  clearPendingSmartCaptureForTests,
  consumePendingSmartCapture,
  deleteSmartHistoryRecord,
  getSmartPageViewMode,
  hasUnconfirmedSmartRecord,
  invokeSmartBackHandler,
  listSmartHistory,
  markSmartHistoryConfirmed,
  registerSmartBackHandler,
  resetSmartHistoryForTests,
  saveSmartHistoryRecord,
  setPendingSmartCapture,
  setSmartPageViewMode,
  setUnconfirmedSmartRecord,
} from './smart-handoff'

describe('smart-handoff', () => {
  beforeEach(() => {
    clearPendingSmartCaptureForTests()
    resetSmartHistoryForTests([])
    setUnconfirmedSmartRecord(false)
    setSmartPageViewMode('scanner')
    registerSmartBackHandler(null)
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

  it('requireSessionMatch 防止旧扫描器实例抢占新路由 sid 的待上传文件载荷', () => {
    const file = new File(['meal note'], 'meal.txt', { type: 'text/plain' })
    const payload = setPendingSmartCapture({
      file,
      mode: 'smart-upload',
      requireSessionMatch: true,
    })

    // 未传 sid 或传入旧 sid 的实例不会误消费
    expect(consumePendingSmartCapture()).toBeNull()
    expect(consumePendingSmartCapture('smart-old-id')).toBeNull()

    // 匹配目标 sid 的新挂载实例成功消费
    const consumed = consumePendingSmartCapture(payload.id)
    expect(consumed?.id).toBe(payload.id)
    expect(consumed?.file.name).toBe('meal.txt')
    expect(consumePendingSmartCapture(payload.id)).toBeNull()
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

  it('同时上传 2 张照片时保存两个相对路径（relativeImagePaths），并保持首图路径兼容', () => {
    const record = saveSmartHistoryRecord({
      mode: 'smart-upload',
      mediaKind: 'image',
      fileName: 'photo1.jpg, photo2.jpg',
      relativeImagePath: 'uploads/2026-11-08/photo1.jpg',
      relativeImagePaths: ['uploads/2026-11-08/photo1.jpg', 'uploads/2026-11-08/photo2.jpg'],
      result: {
        aiRunId: '0193f6b2-0000-7000-8000-000000000456',
        draft: {
          detectedModule: 'diet',
          matchedGoalId: null,
          confidence: 0.92,
          summary: '识别到两份餐食',
          scanSteps: ['步骤1', '步骤2', '步骤3'],
          exercise: null,
          diet: {
            mealType: 'lunch',
            items: [{ name: '米饭', portion: '1碗', kcal: 200 }],
            note: null,
          },
          sleep: null,
          study: null,
          custom: null,
        },
      },
    })

    expect(record.relativeImagePath).toBe('uploads/2026-11-08/photo1.jpg')
    expect(record.relativeImagePaths).toEqual([
      'uploads/2026-11-08/photo1.jpg',
      'uploads/2026-11-08/photo2.jpg',
    ])
  })

  it('未确认守卫仅在 scanner 实时扫描视图下激活，history 与 history-detail 只读视图下永不拦截退出', () => {
    setUnconfirmedSmartRecord(true)
    setSmartPageViewMode('scanner')
    expect(hasUnconfirmedSmartRecord()).toBe(true)

    setSmartPageViewMode('history')
    expect(hasUnconfirmedSmartRecord()).toBe(false)

    setSmartPageViewMode('history-detail')
    expect(hasUnconfirmedSmartRecord()).toBe(false)

    setSmartPageViewMode('scanner')
    expect(hasUnconfirmedSmartRecord()).toBe(true)
  })

  it('registerSmartBackHandler 支持在只读历史详情态拦截返回键并直接回退到历史列表', () => {
    setSmartPageViewMode('history-detail')
    const unregister = registerSmartBackHandler(() => {
      if (getSmartPageViewMode() === 'history-detail') {
        setSmartPageViewMode('history')
        return true
      }
      return false
    })

    expect(invokeSmartBackHandler()).toBe(true)
    expect(getSmartPageViewMode()).toBe('history')
    expect(invokeSmartBackHandler()).toBe(false)

    unregister()
  })
})
