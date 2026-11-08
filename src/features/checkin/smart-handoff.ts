import { useSyncExternalStore } from 'react'
import type { SmartRecognitionResult } from './smart-schemas'

/*
 * 智能拍照 / 智能上传跨组件内存交接槽与历史识别记录存储（严守 ADR-0002）：
 * 1. 刚拍摄或选择的 File 仅保存在 JS 运行时内存，绝不写入磁盘或 Web Storage；
 * 2. 历史记录仅在 localStorage 存储图片的相对路径（如 captures/2026-11-05/xxx.jpg）与识别出的结构化草稿文本，
 *    绝不存储真实图片二进制、Blob 或 Base64；
 * 3. 页面视图分三态：
 *    - 'scanner'：实时拍照/上传识别态（有未确认草稿时退出触发二次确认）；
 *    - 'history'：历史记录单页列表态（顶部操作卡 + 下方触底表格容器）；
 *    - 'history-detail'：历史记录纯只读详情态（点击返回直接回退到 'history' 列表，绝不弹退出确认框）。
 */

export type SmartInputMode = 'smart-capture' | 'smart-upload'
export type SmartPageViewMode = 'scanner' | 'history' | 'history-detail'

export interface PendingSmartPayload {
  id: string
  file: File
  /** 支持同时交接最多 2 张图片（首张与 file 相同） */
  files?: File[]
  mode: SmartInputMode
  createdAt: string
}

export interface SmartHistoryRecord {
  id: string
  mode: SmartInputMode
  mediaKind: 'image' | 'text'
  fileName: string
  /** 仅存首张图片的相对路径（如 captures/2026-11-05/photo.jpg），不存真实图片 */
  relativeImagePath: string | null
  /** 同时上传 2 张图片时保存两个相对路径（如 ['uploads/.../1.jpg', 'uploads/.../2.jpg']） */
  relativeImagePaths?: string[]
  textSnippet: string | null
  createdAt: string
  confirmed: boolean
  confirmedGoalTitle?: string
  result: SmartRecognitionResult
}

const HISTORY_STORAGE_KEY = 'ddo:smart-history:v1'
const MAX_HISTORY_ITEMS = 50

let pendingPayload: PendingSmartPayload | null = null
let unconfirmedRecordActive = false
let pageViewMode: SmartPageViewMode = 'scanner'
let backHandler: (() => boolean) | null = null
let handoffSeq = 0

const captureListeners = new Set<() => void>()
const historyListeners = new Set<() => void>()
const guardListeners = new Set<() => void>()
const viewModeListeners = new Set<() => void>()

function emit(set: Set<() => void>) {
  set.forEach((fn) => fn())
}

/** 生成安全的虚拟相对路径（只存相对路径，不存真实图片） */
export function buildRelativeMediaPath(
  fileName: string,
  mode: SmartInputMode,
  now: Date = new Date(),
): string {
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const folder = mode === 'smart-capture' ? 'captures' : 'uploads'
  const cleanName =
    fileName
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 60) || (mode === 'smart-capture' ? 'camera_shot.jpg' : 'smart_upload.jpg')
  return `${folder}/${yyyy}-${mm}-${dd}/${cleanName}`
}

export function setPendingSmartCapture(
  input: File | { file: File; files?: File[]; mode?: SmartInputMode },
): PendingSmartPayload {
  const file = input instanceof File ? input : input.file
  const files = input instanceof File ? [input] : (input.files ?? [input.file])
  const mode: SmartInputMode =
    input instanceof File ? 'smart-capture' : (input.mode ?? 'smart-capture')
  const payload: PendingSmartPayload = {
    id: `smart-${Date.now()}-${++handoffSeq}`,
    file,
    files,
    mode,
    createdAt: new Date().toISOString(),
  }
  pendingPayload = payload
  pageViewMode = 'scanner'
  emit(viewModeListeners)
  emit(guardListeners)
  emit(captureListeners)
  return payload
}

export function consumePendingSmartCapture(): PendingSmartPayload | null {
  const current = pendingPayload
  pendingPayload = null
  return current
}

export function peekPendingSmartCapture(): PendingSmartPayload | null {
  return pendingPayload
}

export function subscribePendingSmartCapture(listener: () => void): () => void {
  captureListeners.add(listener)
  return () => {
    captureListeners.delete(listener)
  }
}

// ---------------------------------------------------------------------------
// 视图内返回拦截器（用于历史详情回退历史列表、历史列表回退扫描镜）
// ---------------------------------------------------------------------------

export function registerSmartBackHandler(handler: (() => boolean) | null): () => void {
  backHandler = handler
  return () => {
    if (backHandler === handler) {
      backHandler = null
    }
  }
}

export function invokeSmartBackHandler(): boolean {
  if (!backHandler) return false
  return backHandler()
}

// ---------------------------------------------------------------------------
// 未确认记录退出守卫（仅在 scanner 实时扫描视图下生效，只读历史视图永不拦截）
// ---------------------------------------------------------------------------

export function setUnconfirmedSmartRecord(active: boolean) {
  if (unconfirmedRecordActive === active) return
  unconfirmedRecordActive = active
  emit(guardListeners)
}

export function hasUnconfirmedSmartRecord(): boolean {
  return unconfirmedRecordActive && pageViewMode === 'scanner'
}

function subscribeUnconfirmedGuard(listener: () => void): () => void {
  guardListeners.add(listener)
  return () => {
    guardListeners.delete(listener)
  }
}

export function useUnconfirmedSmartRecord(): boolean {
  return useSyncExternalStore(
    subscribeUnconfirmedGuard,
    () => hasUnconfirmedSmartRecord(),
    () => false,
  )
}

// ---------------------------------------------------------------------------
// 智能识别页视图切换（scanner | history | history-detail）
// ---------------------------------------------------------------------------

export function setSmartPageViewMode(mode: SmartPageViewMode) {
  if (pageViewMode === mode) return
  pageViewMode = mode
  emit(viewModeListeners)
  emit(guardListeners)
}

export function getSmartPageViewMode(): SmartPageViewMode {
  return pageViewMode
}

function subscribeViewMode(listener: () => void): () => void {
  viewModeListeners.add(listener)
  return () => {
    viewModeListeners.delete(listener)
  }
}

export function useSmartPageViewMode(): SmartPageViewMode {
  return useSyncExternalStore(
    subscribeViewMode,
    () => pageViewMode,
    () => 'scanner',
  )
}

// ---------------------------------------------------------------------------
// 历史智能拍摄 / 上传记录管理（仅存相对路径与识别结果草稿，不存真实图片）
// ---------------------------------------------------------------------------

const DEFAULT_SEED_RECORDS: readonly SmartHistoryRecord[] = [
  {
    id: '0193f6b2-0000-7000-8000-000000000901',
    mode: 'smart-capture',
    mediaKind: 'image',
    fileName: 'cursor_subscription_bill.jpg',
    relativeImagePath: 'captures/2026-11-04/cursor_subscription_bill.jpg',
    textSnippet: null,
    createdAt: '2026-11-04T12:30:00.000Z',
    confirmed: false,
    result: {
      aiRunId: '0193f6b2-0000-7000-8000-000000000901',
      draft: {
        detectedModule: 'custom',
        matchedGoalId: null,
        confidence: 0.91,
        summary:
          '识别到一张 Cursor AI IDE 订阅支付账单，金额 68.34 元，已按自定义目标记录为已完成。',
        scanSteps: [
          '识别到账单详情截图与支付成功特征',
          '提取出商家、金额 68.34 元与支付时间',
          '已填入自定义板块并标记完成',
        ],
        exercise: null,
        diet: null,
        sleep: null,
        study: null,
        custom: {
          values: { done: true },
          note: 'Cursor AI IDE 订阅支付 68.34 元（10 美元）',
        },
      },
    },
  },
  {
    id: '0193f6b2-0000-7000-8000-000000000902',
    mode: 'smart-upload',
    mediaKind: 'image',
    fileName: 'lunch_plate_photo.jpg',
    relativeImagePath: 'uploads/2026-11-04/lunch_plate_photo.jpg',
    textSnippet: null,
    createdAt: '2026-11-04T04:15:00.000Z',
    confirmed: true,
    confirmedGoalTitle: '好好吃饭',
    result: {
      aiRunId: '0193f6b2-0000-7000-8000-000000000902',
      draft: {
        detectedModule: 'diet',
        matchedGoalId: null,
        confidence: 0.95,
        summary: '识别到午餐 2 样食物：番茄炒蛋、杂粮米饭，合计约 425 kcal。',
        scanSteps: [
          '扫描餐盘区域与食材份量比例',
          '识别出番茄炒蛋与杂粮米饭（约 425 kcal）',
          '已填入好好吃饭饮食清单',
        ],
        exercise: null,
        diet: {
          mealType: 'lunch',
          items: [
            { name: '番茄炒蛋', portion: '约 200 克', kcal: 255 },
            { name: '杂粮米饭', portion: '一碗 150 克', kcal: 170 },
          ],
          note: '少油清淡午餐',
        },
        sleep: null,
        study: null,
        custom: null,
      },
    },
  },
]

let cachedHistory: readonly SmartHistoryRecord[] | null = null

function readStorage(): readonly SmartHistoryRecord[] {
  if (cachedHistory !== null) return cachedHistory
  if (typeof window === 'undefined') return DEFAULT_SEED_RECORDS
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY)
    if (raw === null) {
      cachedHistory = DEFAULT_SEED_RECORDS
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(DEFAULT_SEED_RECORDS))
      return cachedHistory
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      cachedHistory = []
      return cachedHistory
    }
    cachedHistory = parsed as SmartHistoryRecord[]
    return cachedHistory
  } catch {
    cachedHistory = DEFAULT_SEED_RECORDS
    return cachedHistory
  }
}

function writeStorage(next: readonly SmartHistoryRecord[]) {
  cachedHistory = next
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 忽略配额或隐私模式异常
    }
  }
  emit(historyListeners)
}

export function listSmartHistory(): readonly SmartHistoryRecord[] {
  return readStorage()
}

export function getSmartHistoryRecord(id: string): SmartHistoryRecord | null {
  return readStorage().find((item) => item.id === id) ?? null
}

export function saveSmartHistoryRecord(input: {
  mode: SmartInputMode
  mediaKind: 'image' | 'text'
  fileName: string
  relativeImagePath?: string | null
  relativeImagePaths?: string[]
  textSnippet?: string | null
  result: SmartRecognitionResult
}): SmartHistoryRecord {
  const now = new Date()
  const relativeImagePath =
    input.relativeImagePath !== undefined
      ? input.relativeImagePath
      : input.mediaKind === 'image'
        ? buildRelativeMediaPath(input.fileName, input.mode, now)
        : null
  const relativeImagePaths =
    input.relativeImagePaths && input.relativeImagePaths.length > 0
      ? input.relativeImagePaths.slice(0, 2)
      : relativeImagePath
        ? [relativeImagePath]
        : undefined

  const record: SmartHistoryRecord = {
    id: input.result.aiRunId,
    mode: input.mode,
    mediaKind: input.mediaKind,
    fileName: input.fileName || (input.mode === 'smart-capture' ? 'camera.jpg' : 'upload.dat'),
    relativeImagePath,
    relativeImagePaths,
    textSnippet: input.textSnippet ?? null,
    createdAt: now.toISOString(),
    confirmed: false,
    result: input.result,
  }

  const current = readStorage().filter((item) => item.id !== record.id)
  const next = [record, ...current].slice(0, MAX_HISTORY_ITEMS)
  writeStorage(next)
  return record
}

export function markSmartHistoryConfirmed(aiRunId: string, goalTitle?: string) {
  const current = readStorage()
  let changed = false
  const next = current.map((item) => {
    if (item.id !== aiRunId && item.result.aiRunId !== aiRunId) return item
    changed = true
    return {
      ...item,
      confirmed: true,
      confirmedGoalTitle: goalTitle ?? item.confirmedGoalTitle,
    }
  })
  if (changed) writeStorage(next)
}

export function deleteSmartHistoryRecord(id: string) {
  const current = readStorage()
  const next = current.filter((item) => item.id !== id)
  if (next.length !== current.length) {
    writeStorage(next)
  }
}

export function resetSmartHistoryForTests(records: readonly SmartHistoryRecord[] = []) {
  writeStorage(records)
}

function subscribeSmartHistory(listener: () => void): () => void {
  historyListeners.add(listener)
  return () => {
    historyListeners.delete(listener)
  }
}

export function useSmartHistory(): readonly SmartHistoryRecord[] {
  return useSyncExternalStore(
    subscribeSmartHistory,
    () => readStorage(),
    () => DEFAULT_SEED_RECORDS,
  )
}
