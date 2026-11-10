import { afterEach, describe, expect, it } from 'vitest'
import {
  dataUrlToFile,
  detectPlatform,
  getNativePermissions,
  getNativeTodaySteps,
  isNativePhotosPartialAccess,
  isNativeShellUA,
  listNativeAlbumPhotos,
  listNativeAlbumPhotosPage,
  requestNativePermission,
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
    expect(isNativeShellUA(`${ANDROID_CHROME} DayDayOnApp/0.1.6`)).toBe(true)
    expect(isNativeShellUA(ANDROID_CHROME)).toBe(false)
  })
})

describe('detectPlatform', () => {
  it('APK 壳优先于其他判断', () => {
    expect(detectPlatform(`${ANDROID_CHROME} DayDayOnApp/0.1.6`, true)).toBe('native')
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

describe('相册分页与网页端零假数据隔离边界', () => {
  it('纯网页环境绝不返回任何内置演示假图', async () => {
    const page = await listNativeAlbumPhotosPage(0, 30)
    expect(page).toEqual({
      items: [],
      hasMore: false,
      nextOffset: 0,
      partialAccess: false,
    })
    expect(await listNativeAlbumPhotos(30)).toEqual([])
  })

  it('APK 壳内支持分页元数据解析与 Android 14+ 部分授权标识', async () => {
    const g = globalThis as unknown as { window?: Window }
    const prevWindow = g.window
    g.window = {
      DayDayOnNative: {
        requestPermission: () => 'granted',
        getPermissionsJson: () =>
          JSON.stringify({
            camera: 'granted',
            photos: 'granted',
            photosPartial: true,
            steps: 'denied',
            notifications: 'granted',
          }),
        getAlbumPhotosPageJson: (offset: number, limit: number) =>
          JSON.stringify({
            items: Array.from({ length: limit }, (_, idx) => ({
              id: String(offset + idx + 1),
              name: `IMG_${offset + idx + 1}.jpg`,
              previewUrl: `/__native__/media/thumb/${offset + idx + 1}`,
              fullUrl: `/__native__/media/full/${offset + idx + 1}`,
              createdAt: '2026-11-10T04:00:00.000Z',
              width: 1080,
              height: 1440,
            })),
            hasMore: offset + limit < 75,
            nextOffset: offset + limit,
            partialAccess: true,
          }),
      },
    } as unknown as Window

    try {
      expect(isNativePhotosPartialAccess()).toBe(true)
      const perms = await getNativePermissions()
      expect(perms.steps).toBe('denied')

      const p1 = await listNativeAlbumPhotosPage(0, 30)
      expect(p1.items).toHaveLength(30)
      expect(p1.items[0]?.previewUrl).toBe('/__native__/media/thumb/1')
      expect(p1.hasMore).toBe(true)
      expect(p1.nextOffset).toBe(30)
      expect(p1.partialAccess).toBe(true)

      const p3 = await listNativeAlbumPhotosPage(60, 30)
      expect(p3.hasMore).toBe(false)
      expect(p3.nextOffset).toBe(90)
    } finally {
      g.window = prevWindow
    }
  })

  it('旧版 0.1.3 APK 壳无分页方法时向下兼容 getAlbumPhotosJson', async () => {
    const g = globalThis as unknown as { window?: Window }
    const prevWindow = g.window
    g.window = {
      DayDayOnNative: {
        requestPermission: () => 'granted',
        getAlbumPhotosJson: () =>
          JSON.stringify([
            {
              id: '99',
              name: 'legacy.jpg',
              previewUrl: 'data:image/jpeg;base64,/9j/4AAQ',
              createdAt: '2026-11-08T00:00:00.000Z',
              width: 800,
              height: 800,
            },
          ]),
      },
    } as unknown as Window

    try {
      const p = await listNativeAlbumPhotosPage(0, 30)
      expect(p.items).toHaveLength(1)
      expect(p.items[0]?.id).toBe('99')
      expect(p.hasMore).toBe(false)
    } finally {
      g.window = prevWindow
    }
  })
})

describe('getNativePermissions & requestNativePermission & dataUrlToFile', () => {
  it('无原生桥时返回默认权限状态，且请求 photos/steps 不伪造 granted', async () => {
    const perms = await getNativePermissions()
    expect(perms).toEqual({
      camera: 'prompt',
      photos: 'prompt',
      steps: 'prompt',
      notifications: 'prompt',
    })
    expect(await requestNativePermission('photos')).toBe('prompt')
    expect(await requestNativePermission('steps')).toBe('prompt')
    expect(await syncNativeReminder({ enabled: true, remindAt: '21:00' })).toBe(false)
  })

  it('dataUrlToFile 能将 base64 转为内存 File', () => {
    const file = dataUrlToFile('data:image/jpeg;base64,/9j/4AAQ', 'shot.jpg')
    expect(file).not.toBeNull()
    expect(file?.name).toBe('shot.jpg')
    expect(file?.type).toBe('image/jpeg')
  })
})
