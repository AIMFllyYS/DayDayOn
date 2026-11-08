import { afterEach, describe, expect, it } from 'vitest'
import {
  dataUrlToFile,
  detectPlatform,
  getNativePermissions,
  getNativeTodaySteps,
  isNativeShellUA,
  syncNativeReminder,
} from './native'

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36'
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'
const WINDOWS_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0'

afterEach(() => {
  if (typeof window !== 'undefined') {
    delete window.DayDayOnNative
  }
})

describe('isNativeShellUA', () => {
  it('UA 里带 DayDayOnApp/ 才算 APK 壳', () => {
    expect(isNativeShellUA(`${ANDROID_CHROME} DayDayOnApp/1.0.0`)).toBe(true)
    expect(isNativeShellUA(ANDROID_CHROME)).toBe(false)
  })
})

describe('detectPlatform', () => {
  it('APK 壳优先于其他判断', () => {
    expect(detectPlatform(`${ANDROID_CHROME} DayDayOnApp/1.0.0`, true)).toBe('native')
  })

  it('已安装的 PWA 记为 standalone', () => {
    expect(detectPlatform(ANDROID_CHROME, true)).toBe('standalone')
    expect(detectPlatform(IPHONE_SAFARI, true)).toBe('standalone')
  })

  it('浏览器里按系统区分安卓、iOS 和桌面', () => {
    expect(detectPlatform(ANDROID_CHROME, false)).toBe('android')
    expect(detectPlatform(IPHONE_SAFARI, false)).toBe('ios')
    expect(detectPlatform(WINDOWS_EDGE, false)).toBe('desktop')
  })
})

describe('getNativeTodaySteps 边界条件', () => {
  it('没有安装手机端（纯网页环境无 DayDayOnNative）时固定返回 0，不报错', async () => {
    expect(await getNativeTodaySteps()).toBe(0)
  })

  it('原生桥存在时读取并截断为合法非负整数', async () => {
    const g = globalThis as unknown as { window?: Window }
    const prevWindow = g.window
    g.window = {
      DayDayOnNative: {
        getTodaySteps: () => 6842.9,
      },
    } as unknown as Window
    try {
      expect(await getNativeTodaySteps()).toBe(6842)
    } finally {
      g.window = prevWindow
    }
  })

  it('原生桥返回负数或抛异常时安全兜底为 0', async () => {
    const g = globalThis as unknown as { window?: Window }
    const prevWindow = g.window
    g.window = {
      DayDayOnNative: {
        getTodaySteps: () => -120,
      },
    } as unknown as Window
    try {
      expect(await getNativeTodaySteps()).toBe(0)
    } finally {
      g.window = prevWindow
    }
  })
})

describe('getNativePermissions & syncNativeReminder & dataUrlToFile', () => {
  it('无原生桥时返回默认权限状态与 false 提醒同步结果', async () => {
    const perms = await getNativePermissions()
    expect(perms).toEqual({
      camera: 'prompt',
      photos: 'prompt',
      steps: 'prompt',
      notifications: 'prompt',
    })
    expect(await syncNativeReminder({ enabled: true, remindAt: '21:00' })).toBe(false)
  })

  it('dataUrlToFile 能将 base64 转为内存 File', () => {
    const file = dataUrlToFile('data:image/jpeg;base64,/9j/4AAQ', 'shot.jpg')
    expect(file).not.toBeNull()
    expect(file?.name).toBe('shot.jpg')
    expect(file?.type).toBe('image/jpeg')
  })
})
