/*
 * 运行环境识别与安卓原生桥接唯一入口（ADR-0022、Issue #57）：
 * - APK 壳在 WebView 的 User-Agent 末尾追加 `DayDayOnApp/<版本号>`，网页靠它识别自己跑在壳里。
 * - 原生桥接（Kotlin 组件：权限管理、原生高清相机、微信式多选相册、硬件计步器、手机本地定时提醒）
 *   全部收口在本文件，业务代码严禁直接读取 UA 或 window.DayDayOnNative。
 * - 边界条件保证：当处于纯网页端（无 APK 壳）时，所有桥接函数均零报错降级（如今日步数固定返回 0）。
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

export interface NativeAlbumPhotoItem {
  id: string
  name: string
  /** 预览用 data URL 或 object URL（仅存在于内存） */
  previewUrl: string
  createdAt: string
  width: number
  height: number
}

interface AndroidBridge {
  /** 返回 JSON 字符串：Record<NativePermissionName, PermissionStateValue> */
  getPermissionsJson?: () => string
  /** 触发安卓系统运行时权限弹窗；返回当前或请求后的状态，或通过回调返回 */
  requestPermission?: (permission: string) => string
  /** 打开安卓系统当前应用详情设置页（Settings.ACTION_APPLICATION_DETAILS_SETTINGS） */
  openAppSettings?: () => void
  /** 直接拉起安卓系统原生相机拍摄高清原图（返回回调或 dataUrl JSON） */
  captureHighResPhoto?: () => void
  /** 读取手机相册最近照片缩略列表 JSON */
  getAlbumPhotosJson?: (limit: number) => string
  /** 按相册照片 ID 读取高清压缩后的 JPEG dataUrl */
  readAlbumPhotoDataUrl?: (photoId: string) => string
  /** 读取硬件计步传感器（TYPE_STEP_COUNTER）计算的今日步数 */
  getTodaySteps?: () => number
  /** 注册或取消手机端每日定时提醒通知（HH:mm） */
  scheduleDailyReminder?: (remindAt: string, enabled: boolean) => boolean
}

declare global {
  interface Window {
    DayDayOnNative?: AndroidBridge
    __ddoOnCameraResult?: (dataUrl: string | null, fileName?: string) => void
    __ddoOnPermissionResult?: (permission: string, state: string) => void
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
      photos: normalizePermState(parsed.photos),
      steps: normalizePermState(parsed.steps),
      notifications: normalizePermState(parsed.notifications),
    }
  } catch {
    return { ...DEFAULT_PERMISSIONS }
  }
}

function writeWebStoredPermission(name: NativePermissionName, state: PermissionStateValue) {
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
 * - APK 壳内：直接读取 Kotlin 侧 ContextCompat.checkSelfPermission 的真实状态；
 * - 网页端：结合浏览器 Permissions API / Notification.permission 与本地状态，绝不抛错。
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

/**
 * 真实请求某项权限：
 * - APK 壳内：调用 Kotlin ActivityCompat.requestPermissions 拉起安卓系统授权框；
 * - 浏览器内：camera 真实调起 getUserMedia 请求摄像头权限；notifications 真实调起 Notification.requestPermission。
 */
export async function requestNativePermission(
  name: NativePermissionName,
): Promise<PermissionStateValue> {
  const bridge = getBridge()
  if (bridge?.requestPermission) {
    try {
      const immediate = bridge.requestPermission(name)
      if (immediate === 'granted' || immediate === 'denied') {
        writeWebStoredPermission(name, immediate)
        return immediate
      }
      // 等待原生异步权限回调（最长 15 秒超时）
      const asyncState = await new Promise<PermissionStateValue>((resolve) => {
        const timer = window.setTimeout(() => resolve('prompt'), 15_000)
        window.__ddoOnPermissionResult = (perm, state) => {
          if (perm !== name) return
          window.clearTimeout(timer)
          resolve(normalizePermState(state))
        }
      })
      writeWebStoredPermission(name, asyncState)
      return asyncState
    } catch {
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

  // 相册与计步在模拟器或手动授权下记录为已开启
  writeWebStoredPermission(name, 'granted')
  return 'granted'
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

/**
 * 直接调用手机原生相机拍摄高分辨率照片（先真实请求相机权限）。
 * - 在 APK 壳内：拉起系统原生相机，拍摄高清图并在内存中转为 File 返回；
 * - 不在 APK 壳内（或无原生相机桥）：返回 null，由调用方回退到 `<input type="file" capture="environment">`。
 */
export async function captureNativeHighResPhoto(): Promise<File | null> {
  const perm = await requestNativePermission('camera')
  if (perm === 'denied') {
    throw new Error('CAMERA_PERMISSION_DENIED')
  }

  const bridge = getBridge()
  if (!bridge?.captureHighResPhoto) {
    return null
  }

  return new Promise<File | null>((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 60_000)
    window.__ddoOnCameraResult = (dataUrl, fileName) => {
      window.clearTimeout(timer)
      if (!dataUrl) {
        resolve(null)
        return
      }
      resolve(dataUrlToFile(dataUrl, fileName || `camera_${Date.now()}.jpg`))
    }
    try {
      bridge.captureHighResPhoto?.()
    } catch {
      window.clearTimeout(timer)
      resolve(null)
    }
  })
}

/**
 * 读取手机相册照片列表（用于微信式多选相册组件）。
 * - 在 APK 壳内：先请求相册权限，再从 MediaStore 读取真实照片缩略图；
 * - 网页端/Playbook：返回内置的治愈手账演示相册照片（纯内存 SVG/Canvas 转 JPEG），支持直接点选体验 1..9 多选流程。
 */
export async function listNativeAlbumPhotos(limit = 24): Promise<NativeAlbumPhotoItem[]> {
  const bridge = getBridge()
  if (bridge?.getAlbumPhotosJson) {
    const perm = await requestNativePermission('photos')
    if (perm === 'denied') return []
    try {
      const raw = bridge.getAlbumPhotosJson(limit)
      const parsed = JSON.parse(raw) as NativeAlbumPhotoItem[]
      if (Array.isArray(parsed)) return parsed
    } catch {
      // 回退到内置列表
    }
  }
  return buildDemoAlbumPhotos()
}

/** 按照片项导出真实可上传的内存 JPEG File */
export async function resolveAlbumPhotoToFile(item: NativeAlbumPhotoItem): Promise<File | null> {
  const bridge = getBridge()
  if (bridge?.readAlbumPhotoDataUrl && !item.previewUrl.startsWith('data:')) {
    try {
      const dataUrl = bridge.readAlbumPhotoDataUrl(item.id)
      if (dataUrl) return dataUrlToFile(dataUrl, item.name)
    } catch {
      // ignore
    }
  }
  if (item.previewUrl.startsWith('data:')) {
    return dataUrlToFile(item.previewUrl, item.name)
  }
  try {
    const res = await fetch(item.previewUrl)
    const blob = await res.blob()
    return new File([blob], item.name, { type: blob.type || 'image/jpeg' })
  } catch {
    return null
  }
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
 * 同步手机端原生定时提醒（每天 remindAt 触发系统状态栏通知）。
 * - 在 APK 壳内：若开启则先请求通知权限，再调用 scheduleDailyReminder；
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
      if (perm === 'denied') return false
    }
    return Boolean(bridge.scheduleDailyReminder(config.remindAt ?? '21:00', config.enabled))
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// 内置相册生成（内存 Canvas 生成有效 JPEG DataURL，确保通过服务端 FF D8 FF JPEG 校验）
// ---------------------------------------------------------------------------

let cachedDemoPhotos: NativeAlbumPhotoItem[] | null = null

function createSolidJpegDataUrl(bgHex: string, accentHex: string, title: string): string {
  if (typeof document === 'undefined') return ''
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 360
    canvas.height = 360
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.fillStyle = bgHex
    ctx.fillRect(0, 0, 360, 360)
    ctx.fillStyle = accentHex
    ctx.beginPath()
    ctx.arc(180, 150, 72, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#4a3b32'
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(title, 180, 285)
    return canvas.toDataURL('image/jpeg', 0.85)
  } catch {
    return ''
  }
}

function buildDemoAlbumPhotos(): NativeAlbumPhotoItem[] {
  if (cachedDemoPhotos && cachedDemoPhotos.length > 0 && cachedDemoPhotos[0]?.previewUrl) {
    return cachedDemoPhotos
  }
  const presets = [
    {
      id: 'album-1',
      name: 'lunch_salad_bowl.jpg',
      title: '轻食鸡胸肉沙拉',
      bg: '#fff3e6',
      accent: '#f4a261',
    },
    {
      id: 'album-2',
      name: 'oat_milk_latte.jpg',
      title: '燕麦拿铁与全麦包',
      bg: '#fefae0',
      accent: '#d4a373',
    },
    {
      id: 'album-3',
      name: 'evening_run_5km.jpg',
      title: '操场慢跑 5 公里',
      bg: '#e9f5ef',
      accent: '#52b788',
    },
    {
      id: 'album-4',
      name: 'sleep_record_ring.jpg',
      title: '昨晚睡眠 7.5 小时',
      bg: '#eef0ff',
      accent: '#748ffc',
    },
    {
      id: 'album-5',
      name: 'study_notes_math.jpg',
      title: '高等数学复习笔记',
      bg: '#fff0f6',
      accent: '#f06595',
    },
    {
      id: 'album-6',
      name: 'homemade_tomato_egg.jpg',
      title: '番茄炒蛋配杂粮饭',
      bg: '#fff4e6',
      accent: '#ff922b',
    },
    {
      id: 'album-7',
      name: 'gym_dumbbell_sets.jpg',
      title: '哑铃力量训练 4 组',
      bg: '#e6fcf5',
      accent: '#20c997',
    },
    {
      id: 'album-8',
      name: 'fruit_yogurt_cup.jpg',
      title: '蓝莓无糖酸奶碗',
      bg: '#f3f0ff',
      accent: '#845ef7',
    },
    {
      id: 'album-9',
      name: 'reading_chapter_3.jpg',
      title: '英语文献精读打卡',
      bg: '#e7f5ff',
      accent: '#339af0',
    },
  ]
  const now = new Date()
  const list = presets.map((p, idx) => ({
    id: p.id,
    name: p.name,
    previewUrl: createSolidJpegDataUrl(p.bg, p.accent, p.title),
    createdAt: new Date(now.getTime() - idx * 3600_000).toISOString(),
    width: 1080,
    height: 1080,
  }))
  if (list[0]?.previewUrl) {
    cachedDemoPhotos = list
  }
  return list
}
