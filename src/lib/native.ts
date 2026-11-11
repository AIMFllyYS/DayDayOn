/*
 * 运行环境识别与安卓原生桥接唯一入口（ADR-0022、Issue #57）：
 * - APK 壳在 WebView 的 User-Agent 末尾追加 `DayDayOnApp/<版本号>`，网页靠它识别自己跑在壳里。
 * - 原生桥接（Kotlin 组件：权限管理、原生高清相机、流式缩略图分页相册、硬件计步器、手机本地定时提醒）
 *   全部收口在本文件，业务代码严禁直接读取 UA 或 window.DayDayOnNative。
 * - 边界条件保证：当处于纯网页端（无 APK 壳）时，所有桥接函数均零报错降级，且绝不在生产代码返回任何假演示照片。
 */

/** APK 壳追加在 User-Agent 里的标识，Kotlin 侧必须保持一致 */
export const NATIVE_UA_TOKEN = 'DayDayOnApp/'

export function isNativeShellUA(userAgent: string): boolean {
  return userAgent.includes(NATIVE_UA_TOKEN)
}

/** 壳 UA 里的版本号：'… DayDayOnApp/0.2.0' → '0.2.0'；不在壳里或格式不对返回 null（检查更新用） */
export function nativeShellVersion(userAgent: string): string | null {
  const m = /DayDayOnApp\/(\d+\.\d+\.\d+)/.exec(userAgent)
  return m?.[1] ?? null
}

export type ClientPlatform = 'native' | 'standalone' | 'android' | 'ios' | 'desktop'

/** 由 UA 和是否以独立窗口运行判断平台；APK 壳优先，其次是已安装的 PWA */
export function detectPlatform(userAgent: string, standalone: boolean): ClientPlatform {
  if (isNativeShellUA(userAgent)) return 'native'
  if (standalone) return 'standalone'
  if (/Android/i.test(userAgent)) return 'android'
  // iPadOS 13 起默认用桌面 UA，靠触控点数区分不了，这里只认 iPhone / iPad / iPod
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
  return 'desktop'
}

/** 浏览器里取当前平台；只在客户端调用 */
export function currentPlatform(): ClientPlatform {
  if (typeof window === 'undefined') return 'desktop'
  const nav = window.navigator as Navigator & { standalone?: boolean }
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
  return detectPlatform(nav.userAgent, standalone)
}

// ---------------------------------------------------------------------------
// Kotlin @JavascriptInterface 桥接契约定义（window.DayDayOnNative）
// ---------------------------------------------------------------------------

export type NativePermissionName = 'camera' | 'photos' | 'steps' | 'notifications'
export type PermissionStateValue = 'granted' | 'denied' | 'prompt'

export type NativePermissionsMap = Record<NativePermissionName, PermissionStateValue>

export const NATIVE_ALBUM_ALL_ID = '__ALL__'
export const NATIVE_ALBUM_ALL_LABEL = '全部'

export interface NativeAlbumBucket {
  id: string
  name: string
  count: number
}

export interface NativeAlbumPhotoItem {
  id: string
  name: string
  /** 同源流式缩略图路径（/__native__/media/thumb/{id}）或内存预览 URL */
  previewUrl: string
  /** 同源高清压缩图流路径（/__native__/media/full/{id}） */
  fullUrl?: string
  createdAt: string
  width: number
  height: number
  /** 所属相册/文件夹 ID（MediaStore BUCKET_ID） */
  albumId?: string
  /** 所属相册/文件夹显示名 */
  albumName?: string
}

export interface NativeAlbumPhotosPage {
  items: NativeAlbumPhotoItem[]
  hasMore: boolean
  nextOffset: number
  /** Android 14+ 用户是否处于「仅允许访问选定的照片」部分授权态 */
  partialAccess: boolean
}

export type NativeApkUpdateState =
  'idle' | 'downloading' | 'verifying' | 'permission' | 'ready' | 'error'

export interface NativeApkUpdateStatus {
  state: NativeApkUpdateState
  percent: number
  downloadedBytes: number
  totalBytes: number
  version: string
  canInstall: boolean
  error?: string
}

interface AndroidBridge {
  /** 通知安卓原生层移除 0ms 冷启动开屏覆盖层 */
  dismissSplash?: () => void
  /** 启动或恢复后台 APK 更新下载，返回状态 JSON */
  startApkUpdate?: (url: string, sha256: string, version: string) => string
  /** 查询当前 APK 更新下载状态 JSON */
  getApkUpdateStatusJson?: () => string
  /** 调起系统安装器安装已下载好的更新包（未授权未知来源时自动引导去设置页开启） */
  installDownloadedApk?: () => boolean
  /** 当前是否已授予「安装未知应用」权限 */
  canInstallPackages?: () => boolean
  /** 返回 JSON 字符串：Record<NativePermissionName, PermissionStateValue> & { photosPartial?: boolean } */
  getPermissionsJson?: () => string
  /** 触发安卓系统运行时权限弹窗；返回当前或请求后的状态，或通过回调返回 */
  requestPermission?: (permission: string) => string
  /** Android 14+ 部分照片授权下，重新拉起系统选图授权窗增选可访问照片 */
  reselectPhotos?: () => string
  /** 打开安卓系统当前应用详情设置页（Settings.ACTION_APPLICATION_DETAILS_SETTINGS） */
  openAppSettings?: () => void
  /** 打开安卓系统当前应用通知管理设置页（Settings.ACTION_APP_NOTIFICATION_SETTINGS） */
  openNotificationSettings?: () => void
  /** 直接拉起安卓系统原生相机拍摄高清原图（返回同源流式地址或 dataUrl） */
  captureHighResPhoto?: () => void
  /** 直接拉起安卓系统文件选择器（支持图片与 TXT/MD/CSV/HTML 等文档，全程内存流返回零落盘） */
  pickSystemFiles?: (accept: string, maxCount: number) => void
  /** 读取手机相册/文件夹列表 JSON（首项固定为「全部」，后续按稳定可预期顺序排列） */
  getAlbumBucketsJson?: () => string
  /** 按指定相册/文件夹分页读取照片元数据列表 JSON（严格最新 → 最旧，< 5ms） */
  getAlbumPhotosPageWithBucketJson?: (offset: number, limit: number, bucketId: string) => string
  /** 分页读取手机相册照片元数据列表 JSON（< 5ms，不含大图解码） */
  getAlbumPhotosPageJson?: (offset: number, limit: number) => string
  /** 兼容旧版：读取手机相册最近照片列表 JSON */
  getAlbumPhotosJson?: (limit: number) => string
  /** 兼容旧版：按相册照片 ID 读取高清压缩后的 JPEG dataUrl */
  readAlbumPhotoDataUrl?: (photoId: string) => string
  /** 读取硬件计步传感器（TYPE_STEP_COUNTER）计算的今日步数 */
  getTodaySteps?: () => number
  /** 注册或取消手机端每日定时提醒通知（HH:mm） */
  scheduleDailyReminder?: (remindAt: string, enabled: boolean) => boolean
  /** 立即推送一条手机系统通知（用于通知权限检测与提醒测试） */
  notify?: (title: string, body: string) => boolean | void
}

type PermListener = (perm: string, state: string) => void
const permListeners = new Set<PermListener>()

type UpdateProgressListener = (status: NativeApkUpdateStatus) => void
const updateProgressListeners = new Set<UpdateProgressListener>()

declare global {
  interface Window {
    DayDayOnNative?: AndroidBridge
    __ddoOnCameraResult?: (urlOrDataUrl: string | null, fileName?: string) => void
    __ddoOnSystemFilesResult?: (rawItems: unknown) => void
    __ddoOnPermissionResult?: (permission: string, state: string) => void
    __ddoOnUpdateProgress?: (rawStatus: unknown) => void
  }
}

const WEB_PERM_STORAGE_KEY = 'ddo:native-perms:v1'

const DEFAULT_PERMISSIONS: NativePermissionsMap = {
  camera: 'prompt',
  photos: 'prompt',
  steps: 'prompt',
  notifications: 'prompt',
}

function getBridge(): AndroidBridge | null {
  if (typeof window === 'undefined') return null
  return window.DayDayOnNative ?? null
}

function ensureGlobalPermissionDispatcher() {
  if (typeof window === 'undefined') return
  window.__ddoOnPermissionResult = (perm, state) => {
    for (const listener of Array.from(permListeners)) {
      listener(perm, state)
    }
  }
}

/** 是否存在真实的安卓原生桥对象或处于 APK 壳内 */
export function hasNativeBridge(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(window.DayDayOnNative) || isNativeShellUA(window.navigator.userAgent)
}

export const isNativeApp = hasNativeBridge

function normalizePermState(val: unknown): PermissionStateValue {
  if (val === 'granted' || val === 'denied' || val === 'prompt') return val
  return 'prompt'
}

function readWebStoredPermissions(): NativePermissionsMap {
  if (typeof window === 'undefined') return { ...DEFAULT_PERMISSIONS }
  try {
    const raw = window.localStorage.getItem(WEB_PERM_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PERMISSIONS }
    const parsed = JSON.parse(raw) as Partial<Record<NativePermissionName, unknown>>
    return {
      camera: normalizePermState(parsed.camera),
      photos: 'prompt',
      steps: 'prompt',
      notifications: normalizePermState(parsed.notifications),
    }
  } catch {
    return { ...DEFAULT_PERMISSIONS }
  }
}

function writeWebStoredPermission(name: 'camera' | 'notifications', state: PermissionStateValue) {
  if (typeof window === 'undefined') return
  try {
    const current = readWebStoredPermissions()
    current[name] = state
    window.localStorage.setItem(WEB_PERM_STORAGE_KEY, JSON.stringify(current))
  } catch {
    // 忽略隐私模式写入异常
  }
}

/**
 * 查询全部 4 项核心权限的当前状态（相机、相册、计步、通知）。
 * - APK 壳内：直接读取 Kotlin 侧真实状态（含永久拒绝 denied 检测与 Android 14 部分授权）；
 * - 网页端：仅映射浏览器真实支持的 camera / notifications 状态，绝不伪造 photos / steps 授权。
 */
export async function getNativePermissions(): Promise<NativePermissionsMap> {
  const bridge = getBridge()
  if (bridge?.getPermissionsJson) {
    try {
      const parsed = JSON.parse(bridge.getPermissionsJson()) as Partial<
        Record<NativePermissionName, unknown>
      >
      return {
        camera: normalizePermState(parsed.camera),
        photos: normalizePermState(parsed.photos),
        steps: normalizePermState(parsed.steps),
        notifications: normalizePermState(parsed.notifications),
      }
    } catch {
      // 解析失败时向下回退
    }
  }

  const base = readWebStoredPermissions()
  if (typeof window !== 'undefined') {
    if ('Notification' in window) {
      const np = window.Notification.permission
      if (np === 'granted') base.notifications = 'granted'
      else if (np === 'denied') base.notifications = 'denied'
    }
    if (window.navigator?.permissions?.query) {
      try {
        const cam = await window.navigator.permissions.query({
          name: 'camera' as PermissionName,
        })
        if (cam.state === 'granted' || cam.state === 'denied' || cam.state === 'prompt') {
          base.camera = cam.state
        }
      } catch {
        // 部分浏览器不支持 query('camera')，保持 base.camera
      }
    }
  }
  return base
}

/** Android 14+ 是否处于「仅允许访问选定的照片」部分授权模式 */
export function isNativePhotosPartialAccess(): boolean {
  const bridge = getBridge()
  if (!bridge?.getPermissionsJson) return false
  try {
    const parsed = JSON.parse(bridge.getPermissionsJson()) as { photosPartial?: unknown }
    return parsed.photosPartial === true
  } catch {
    return false
  }
}

function createPermWaiter(expectedPerm: NativePermissionName): {
  promise: Promise<PermissionStateValue>
  cancel: () => void
} {
  ensureGlobalPermissionDispatcher()
  let cleanup = () => {}
  const promise = new Promise<PermissionStateValue>((resolve) => {
    const timer = setTimeout(() => {
      permListeners.delete(onResult)
      resolve('prompt')
    }, 15_000)
    function onResult(perm: string, state: string) {
      if (perm !== expectedPerm) return
      clearTimeout(timer)
      permListeners.delete(onResult)
      resolve(normalizePermState(state))
    }
    cleanup = () => {
      clearTimeout(timer)
      permListeners.delete(onResult)
    }
    permListeners.add(onResult)
  })
  return { promise, cancel: cleanup }
}

/**
 * 真实请求某项权限：
 * - APK 壳内：调用 Kotlin Activity.requestPermissions 拉起安卓系统授权框（支持并发监听器防覆盖）；
 * - 浏览器内：仅 camera 与 notifications 调用标准 Web API，photos 与 steps 不存在前置权限，保持 'prompt'。
 */
export async function requestNativePermission(
  name: NativePermissionName,
): Promise<PermissionStateValue> {
  const bridge = getBridge()
  if (bridge?.requestPermission) {
    const waiter = createPermWaiter(name)
    try {
      const immediate = bridge.requestPermission(name)
      if (immediate === 'granted' || immediate === 'denied') {
        waiter.cancel()
        return immediate
      }
      return await waiter.promise
    } catch {
      waiter.cancel()
      return 'denied'
    }
  }

  if (typeof window === 'undefined') return 'prompt'

  if (name === 'camera') {
    if (window.navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await window.navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } },
        })
        stream.getTracks().forEach((t) => t.stop())
        writeWebStoredPermission('camera', 'granted')
        return 'granted'
      } catch {
        writeWebStoredPermission('camera', 'denied')
        return 'denied'
      }
    }
  }

  if (name === 'notifications' && 'Notification' in window) {
    try {
      const res = await window.Notification.requestPermission()
      const state: PermissionStateValue =
        res === 'granted' ? 'granted' : res === 'denied' ? 'denied' : 'prompt'
      writeWebStoredPermission('notifications', state)
      return state
    } catch {
      return 'denied'
    }
  }

  return 'prompt'
}

/** Android 14+ 部分照片授权下，重新调起系统照片选择器增选照片 */
export async function reselectNativePhotos(): Promise<PermissionStateValue> {
  const bridge = getBridge()
  if (bridge?.reselectPhotos) {
    const waiter = createPermWaiter('photos')
    try {
      const immediate = bridge.reselectPhotos()
      if (immediate === 'granted' || immediate === 'denied') {
        waiter.cancel()
        return immediate
      }
      return await waiter.promise
    } catch {
      waiter.cancel()
      return 'denied'
    }
  }
  return requestNativePermission('photos')
}

/** 打开安卓系统的应用权限设置页 */
export function openNativeAppSettings(): boolean {
  const bridge = getBridge()
  if (bridge?.openAppSettings) {
    try {
      bridge.openAppSettings()
      return true
    } catch {
      return false
    }
  }
  return false
}

/** 打开安卓系统的应用通知设置页（旧版壳自动回退至应用详情页） */
export function openNativeNotificationSettings(): boolean {
  const bridge = getBridge()
  if (bridge?.openNotificationSettings) {
    try {
      bridge.openNotificationSettings()
      return true
    } catch {
      return openNativeAppSettings()
    }
  }
  return openNativeAppSettings()
}

/** 将 dataURL 转为内存 File 对象（不落盘） */
export function dataUrlToFile(dataUrl: string, fileName: string): File | null {
  try {
    const commaIdx = dataUrl.indexOf(',')
    if (commaIdx < 0) return null
    const header = dataUrl.slice(0, commaIdx)
    const base64 = dataUrl.slice(commaIdx + 1)
    const mimeMatch = /data:([^;]+);base64/.exec(header)
    const mime = mimeMatch?.[1] ?? 'image/jpeg'
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new File([bytes], fileName, { type: mime })
  } catch {
    return null
  }
}

async function mediaUrlOrDataUrlToFile(
  urlOrDataUrl: string,
  fileName: string,
): Promise<File | null> {
  if (urlOrDataUrl.startsWith('data:')) {
    return dataUrlToFile(urlOrDataUrl, fileName)
  }
  try {
    const res = await fetch(urlOrDataUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    if (blob.size <= 0) return null
    return new File([blob], fileName, { type: blob.type || 'image/jpeg' })
  } catch {
    return null
  }
}

/**
 * 直接调用手机原生相机拍摄高分辨率照片（仅在 APK 壳内调用）。
 * - 在 APK 壳内：拉起系统原生高清相机（CameraTempFileProvider + EXIF 自动旋转），在内存中转为 File 返回；
 * - 不在 APK 壳内（或无原生相机桥）：直接返回 null，由调用方触发 `<input type="file" capture="environment">`。
 */
export async function captureNativeHighResPhoto(): Promise<File | null> {
  const bridge = getBridge()
  if (!bridge?.captureHighResPhoto) {
    return null
  }

  const perm = await requestNativePermission('camera')
  if (perm === 'denied') {
    throw new Error('CAMERA_PERMISSION_DENIED')
  }

  return new Promise<File | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), 60_000)
    window.__ddoOnCameraResult = (urlOrDataUrl, fileName) => {
      clearTimeout(timer)
      if (!urlOrDataUrl) {
        resolve(null)
        return
      }
      const safeName = fileName || `camera_${Date.now()}.jpg`
      void mediaUrlOrDataUrlToFile(urlOrDataUrl, safeName).then(resolve)
    }
    try {
      bridge.captureHighResPhoto?.()
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })
}

interface NativePickedFileDescriptor {
  url: string
  name: string
  mimeType?: string
}

/** 当前 APK 壳是否内置原生系统文件内存流桥接（v0.1.10+） */
export function hasNativeSystemFilePicker(): boolean {
  return Boolean(getBridge()?.pickSystemFiles)
}

/**
 * 在 APK 壳内直接调起安卓系统文件管理器（支持多选图片含 HEIC/DNG 及 TXT/MD/CSV/JSON/HTML 等文档）：
 * - 全程通过 `/__native__/media/picked/{token}` 在内存传输字节流，严守 ADR-0002 零落盘红线；
 * - 若不在支持该桥接的壳内，返回 `null`，由调用方回退至标准 `<input type="file">`。
 */
export async function pickNativeSystemFiles(accept = '*/*', maxCount = 9): Promise<File[] | null> {
  const bridge = getBridge()
  const pickFn = bridge?.pickSystemFiles
  if (!pickFn) {
    return null
  }

  return new Promise<File[] | null>((resolve) => {
    const timer = setTimeout(() => resolve([]), 180_000)
    window.__ddoOnSystemFilesResult = (rawItems) => {
      clearTimeout(timer)
      void (async () => {
        try {
          const parsed = (typeof rawItems === 'string' ? JSON.parse(rawItems) : rawItems) as unknown
          if (!Array.isArray(parsed) || parsed.length === 0) {
            resolve([])
            return
          }
          const resolved: File[] = []
          for (const entry of parsed as Partial<NativePickedFileDescriptor>[]) {
            if (!entry || typeof entry.url !== 'string' || !entry.url) continue
            const safeName =
              typeof entry.name === 'string' && entry.name.trim()
                ? entry.name.trim()
                : `file_${resolved.length + 1}`
            const preferredMime =
              typeof entry.mimeType === 'string' && entry.mimeType.trim()
                ? entry.mimeType.trim()
                : ''
            if (entry.url.startsWith('data:')) {
              const f = dataUrlToFile(entry.url, safeName)
              if (f) {
                resolved.push(
                  preferredMime && f.type !== preferredMime
                    ? new File([f], safeName, { type: preferredMime })
                    : f,
                )
              }
              continue
            }
            const res = await fetch(entry.url)
            if (!res.ok) continue
            const blob = await res.blob()
            if (blob.size <= 0) continue
            resolved.push(
              new File([blob], safeName, {
                type: preferredMime || blob.type || 'application/octet-stream',
              }),
            )
          }
          resolve(resolved)
        } catch {
          resolve([])
        }
      })()
    }
    try {
      pickFn.call(bridge, accept, Math.max(1, Math.min(9, Math.trunc(maxCount))))
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })
}

function extractNumericTail(id: string): number {
  const m = /(\d+)$/.exec(id)
  return m ? Number(m[1]) : Number.NaN
}

/**
 * 严格按时间从最新到最旧（Newest → Oldest）稳定排序：
 * 1. 先按 `createdAt` 毫秒时间戳倒序；
 * 2. 时间相同时按末尾数字 ID 倒序，再按字符串倒序决胜。
 */
export function sortAlbumPhotosNewestFirst<T extends { id: string; createdAt: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    const timeA = Date.parse(a.createdAt)
    const timeB = Date.parse(b.createdAt)
    const safeA = Number.isFinite(timeA) ? timeA : 0
    const safeB = Number.isFinite(timeB) ? timeB : 0
    if (safeA !== safeB) return safeB - safeA

    const numA = extractNumericTail(a.id)
    const numB = extractNumericTail(b.id)
    if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
      return numB - numA
    }
    return b.id.localeCompare(a.id)
  })
}

/**
 * 规范化相册/文件夹列表：
 * - 第一项永远固定为「全部」（`__ALL__`）；
 * - 其余文件夹去重并保留稳定可预期的排列顺序。
 */
export function normalizeAlbumBuckets(
  rawBuckets: readonly NativeAlbumBucket[],
  fallbackAllCount = 0,
): NativeAlbumBucket[] {
  let explicitAllCount: number | null = null
  const seen = new Set<string>()
  const folders: NativeAlbumBucket[] = []

  for (const item of rawBuckets) {
    if (!item || typeof item.id !== 'string') continue
    const id = item.id.trim()
    if (!id) continue
    const count =
      typeof item.count === 'number' && Number.isFinite(item.count)
        ? Math.max(0, Math.trunc(item.count))
        : 0
    if (id === NATIVE_ALBUM_ALL_ID) {
      explicitAllCount = count
      continue
    }
    if (seen.has(id)) continue
    seen.add(id)
    const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : id
    folders.push({ id, name, count })
  }

  const summedCount = folders.reduce((acc, f) => acc + f.count, 0)
  const totalCount = explicitAllCount ?? Math.max(fallbackAllCount, summedCount)
  return [{ id: NATIVE_ALBUM_ALL_ID, name: NATIVE_ALBUM_ALL_LABEL, count: totalCount }, ...folders]
}

/**
 * 读取手机相册/文件夹列表：
 * - 在新版 APK 壳内：直接读取 MediaStore 聚合目录，保证首项固定为「全部」且目录顺序稳定；
 * - 在旧版 APK 壳内：安全降级返回单条「全部」；
 * - 在纯网页端：返回空数组。
 */
export async function listNativeAlbumBuckets(): Promise<NativeAlbumBucket[]> {
  const bridge = getBridge()
  if (!bridge) return []

  const perm = await requestNativePermission('photos')
  if (perm === 'denied') return []

  if (bridge.getAlbumBucketsJson) {
    try {
      const raw = bridge.getAlbumBucketsJson()
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return normalizeAlbumBuckets(parsed as NativeAlbumBucket[])
      }
    } catch {
      // 解析异常时降级为默认「全部」
    }
  }
  return [{ id: NATIVE_ALBUM_ALL_ID, name: NATIVE_ALBUM_ALL_LABEL, count: 0 }]
}

/**
 * 分页读取手机相册照片元数据列表（用于流式缩略图无限下滑相册组件）。
 * - 在 APK 壳内：毫秒级按相册/文件夹查询 MediaStore 分页元数据（严格最新 → 最旧，缩略图走 `/__native__/media/thumb/{id}` 异步流）；
 * - 兼容旧版 APK 壳：自动回退 `getAlbumPhotosPageJson` / `getAlbumPhotosJson` 并执行时间倒序保序；
 * - 在纯网页端：**固定返回空页，绝不生成或返回任何内置演示假图**。
 */
export async function listNativeAlbumPhotosPage(
  offset = 0,
  limit = 30,
  bucketId = NATIVE_ALBUM_ALL_ID,
): Promise<NativeAlbumPhotosPage> {
  const bridge = getBridge()
  const targetBucket = bucketId.trim() || NATIVE_ALBUM_ALL_ID
  const empty: NativeAlbumPhotosPage = {
    items: [],
    hasMore: false,
    nextOffset: offset,
    partialAccess: false,
  }
  if (!bridge) return empty

  const perm = await requestNativePermission('photos')
  if (perm === 'denied') return empty

  if (bridge.getAlbumPhotosPageWithBucketJson) {
    try {
      const raw = bridge.getAlbumPhotosPageWithBucketJson(offset, limit, targetBucket)
      const parsed = JSON.parse(raw) as Partial<NativeAlbumPhotosPage>
      const rawItems = Array.isArray(parsed.items) ? parsed.items : []
      const items = sortAlbumPhotosNewestFirst(rawItems)
      return {
        items,
        hasMore: Boolean(parsed.hasMore),
        nextOffset:
          typeof parsed.nextOffset === 'number' ? parsed.nextOffset : offset + items.length,
        partialAccess: Boolean(parsed.partialAccess),
      }
    } catch {
      // 解析失败时尝试旧版双参数接口
    }
  }

  if (bridge.getAlbumPhotosPageJson) {
    try {
      const raw = bridge.getAlbumPhotosPageJson(offset, limit)
      const parsed = JSON.parse(raw) as Partial<NativeAlbumPhotosPage>
      const rawItems = Array.isArray(parsed.items) ? parsed.items : []
      const filtered =
        targetBucket === NATIVE_ALBUM_ALL_ID
          ? rawItems
          : rawItems.filter((item) => !item.albumId || item.albumId === targetBucket)
      const items = sortAlbumPhotosNewestFirst(filtered)
      return {
        items,
        hasMore: Boolean(parsed.hasMore),
        nextOffset:
          typeof parsed.nextOffset === 'number' ? parsed.nextOffset : offset + rawItems.length,
        partialAccess: Boolean(parsed.partialAccess),
      }
    } catch {
      // 解析失败时尝试旧版接口
    }
  }

  if (bridge.getAlbumPhotosJson && offset === 0) {
    try {
      const raw = bridge.getAlbumPhotosJson(limit)
      const parsed = JSON.parse(raw) as NativeAlbumPhotoItem[]
      if (Array.isArray(parsed)) {
        const items = sortAlbumPhotosNewestFirst(parsed)
        return {
          items,
          hasMore: false,
          nextOffset: items.length,
          partialAccess: isNativePhotosPartialAccess(),
        }
      }
    } catch {
      // ignore
    }
  }

  return empty
}

/** 兼容单次读取调用 */
export async function listNativeAlbumPhotos(limit = 30): Promise<NativeAlbumPhotoItem[]> {
  const page = await listNativeAlbumPhotosPage(0, limit)
  return page.items
}

/** 按照片项导出真实可上传的内存 JPEG File */
export async function resolveAlbumPhotoToFile(item: NativeAlbumPhotoItem): Promise<File | null> {
  if (item.fullUrl) {
    const streamed = await mediaUrlOrDataUrlToFile(item.fullUrl, item.name)
    if (streamed) return streamed
  }
  const bridge = getBridge()
  if (bridge?.readAlbumPhotoDataUrl && !item.previewUrl.startsWith('data:')) {
    try {
      const dataUrl = bridge.readAlbumPhotoDataUrl(item.id)
      if (dataUrl) return dataUrlToFile(dataUrl, item.name)
    } catch {
      // ignore
    }
  }
  return mediaUrlOrDataUrlToFile(item.previewUrl, item.name)
}

/**
 * 读取今日步数（边界条件硬性保障）：
 * - 在 APK 壳内：从硬件计步传感器读取今日步数（非负整数）；
 * - 在网页端、未安装手机端、或未授予计步权限时：**固定返回 0，绝不抛出任何异常**。
 */
export async function getNativeTodaySteps(): Promise<number> {
  const bridge = getBridge()
  if (!bridge?.getTodaySteps) {
    return 0
  }
  try {
    const raw = bridge.getTodaySteps()
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
      return 0
    }
    return Math.min(200_000, Math.trunc(raw))
  } catch {
    return 0
  }
}

/**
 * 同步手机端定时提醒（每天 remindAt 触发系统状态栏通知）。
 * - 在 APK 壳内：若开启则必须先获得通知权限（perm === 'granted'），再调用 scheduleDailyReminder；
 * - 在网页端：安全返回 false，不报错。
 */
export async function syncNativeReminder(config: {
  enabled: boolean
  remindAt: string | null
}): Promise<boolean> {
  const bridge = getBridge()
  if (!bridge?.scheduleDailyReminder) {
    return false
  }
  try {
    if (config.enabled) {
      const perm = await requestNativePermission('notifications')
      if (perm !== 'granted') return false
    }
    return Boolean(bridge.scheduleDailyReminder(config.remindAt ?? '21:00', config.enabled))
  } catch {
    return false
  }
}

/**
 * 立即发送一条测试提醒通知，确认系统通知权限与通知渠道工作正常。
 */
export async function sendNativeTestNotification(
  title = '团团提醒你打卡啦～',
  body = '手机通知已就绪，到设定时间会准时提醒你打卡！',
): Promise<boolean> {
  const perm = await requestNativePermission('notifications')
  if (perm !== 'granted') return false

  const bridge = getBridge()
  if (bridge?.notify) {
    try {
      const res = bridge.notify(title, body)
      return res !== false
    } catch {
      return false
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (window.Notification.permission === 'granted') {
        new window.Notification(title, { body })
        return true
      }
    } catch {
      return false
    }
  }

  return false
}

/** 通知 Android 原生层揭开 0ms 开屏覆盖层（网页首屏水合就绪时调用） */
export function dismissNativeSplash(): void {
  const bridge = getBridge()
  if (!bridge?.dismissSplash) return
  try {
    bridge.dismissSplash()
  } catch {
    // ignore
  }
}

const DEFAULT_APK_UPDATE_STATUS: NativeApkUpdateStatus = {
  state: 'idle',
  percent: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  version: '',
  canInstall: true,
}

function normalizeApkUpdateState(val: unknown): NativeApkUpdateState {
  if (
    val === 'idle' ||
    val === 'downloading' ||
    val === 'verifying' ||
    val === 'permission' ||
    val === 'ready' ||
    val === 'error'
  ) {
    return val
  }
  return 'idle'
}

function parseApkUpdateStatus(raw: unknown): NativeApkUpdateStatus {
  if (!raw) return { ...DEFAULT_APK_UPDATE_STATUS }
  try {
    const obj = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<
      Record<keyof NativeApkUpdateStatus, unknown>
    >
    const percent =
      typeof obj.percent === 'number' && Number.isFinite(obj.percent)
        ? Math.max(0, Math.min(100, Math.round(obj.percent)))
        : 0
    const downloadedBytes =
      typeof obj.downloadedBytes === 'number' && Number.isFinite(obj.downloadedBytes)
        ? Math.max(0, Math.trunc(obj.downloadedBytes))
        : 0
    const totalBytes =
      typeof obj.totalBytes === 'number' && Number.isFinite(obj.totalBytes)
        ? Math.max(0, Math.trunc(obj.totalBytes))
        : 0
    const error = typeof obj.error === 'string' && obj.error.trim() ? obj.error.trim() : undefined
    return {
      state: normalizeApkUpdateState(obj.state),
      percent,
      downloadedBytes,
      totalBytes,
      version: typeof obj.version === 'string' ? obj.version : '',
      canInstall: obj.canInstall !== false,
      ...(error ? { error } : {}),
    }
  } catch {
    return { ...DEFAULT_APK_UPDATE_STATUS }
  }
}

function ensureGlobalUpdateProgressDispatcher() {
  if (typeof window === 'undefined') return
  window.__ddoOnUpdateProgress = (rawStatus) => {
    const status = parseApkUpdateStatus(rawStatus)
    for (const listener of Array.from(updateProgressListeners)) {
      listener(status)
    }
  }
}

/** 当前壳是否支持原生后台下载与自动安装 APK 闭环 */
export function hasNativeApkUpdater(): boolean {
  const bridge = getBridge()
  return Boolean(bridge?.startApkUpdate && bridge?.getApkUpdateStatusJson)
}

/** 读取当前原生 APK 更新下载状态 */
export function getNativeApkUpdateStatus(): NativeApkUpdateStatus {
  const bridge = getBridge()
  if (!bridge?.getApkUpdateStatusJson) return { ...DEFAULT_APK_UPDATE_STATUS }
  try {
    return parseApkUpdateStatus(bridge.getApkUpdateStatusJson())
  } catch {
    return { ...DEFAULT_APK_UPDATE_STATUS }
  }
}

/** 启动或继续安卓原生后台 APK 下载（完成后自动校验 SHA-256 并拉起安装/未知来源授权） */
export function startNativeApkUpdate(input: {
  url: string
  sha256: string
  version: string
}): NativeApkUpdateStatus {
  ensureGlobalUpdateProgressDispatcher()
  const bridge = getBridge()
  if (!bridge?.startApkUpdate) return { ...DEFAULT_APK_UPDATE_STATUS }
  try {
    return parseApkUpdateStatus(bridge.startApkUpdate(input.url, input.sha256, input.version))
  } catch {
    return { ...DEFAULT_APK_UPDATE_STATUS, state: 'error', error: '无法启动更新下载' }
  }
}

/** 直接调起系统安装器安装已下载好的 APK（若未授权未知来源安装，自动引导去系统设置开启） */
export function installNativeDownloadedApk(): boolean {
  ensureGlobalUpdateProgressDispatcher()
  const bridge = getBridge()
  if (!bridge?.installDownloadedApk) return false
  try {
    return Boolean(bridge.installDownloadedApk())
  } catch {
    return false
  }
}

/** 订阅原生后台 APK 下载与安装状态流 */
export function subscribeNativeApkUpdateProgress(listener: UpdateProgressListener): () => void {
  ensureGlobalUpdateProgressDispatcher()
  updateProgressListeners.add(listener)
  return () => {
    updateProgressListeners.delete(listener)
  }
}
