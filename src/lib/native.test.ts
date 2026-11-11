import { afterEach, describe, expect, it } from 'vitest'
import { hasImageMagicBytes, sniffIsImageFile } from './image'
import {
  dataUrlToFile,
  detectPlatform,
  dismissNativeSplash,
  getNativeApkUpdateStatus,
  getNativePermissions,
  getNativeTodaySteps,
  hasNativeApkUpdater,
  hasNativeSystemFilePicker,
  installNativeDownloadedApk,
  isNativePhotosPartialAccess,
  isNativeShellUA,
  listNativeAlbumBuckets,
  listNativeAlbumPhotos,
  listNativeAlbumPhotosPage,
  NATIVE_ALBUM_ALL_ID,
  NATIVE_ALBUM_ALL_LABEL,
  normalizeAlbumBuckets,
  openNativeNotificationSettings,
  pickNativeSystemFiles,
  requestNativePermission,
  sendNativeTestNotification,
  sortAlbumPhotosNewestFirst,
  startNativeApkUpdate,
  subscribeNativeApkUpdateProgress,
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
              id: String(1000 - (offset + idx)),
              name: `IMG_${offset + idx + 1}.jpg`,
              previewUrl: `/__native__/media/thumb/${offset + idx + 1}`,
              fullUrl: `/__native__/media/full/${offset + idx + 1}`,
              createdAt: new Date(
                Date.UTC(2026, 10, 10, 12, 0, 0) - (offset + idx) * 60_000,
              ).toISOString(),
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

  it('严格按最新 → 最旧排序照片，并在相同时间戳时按更高 ID 优先', () => {
    const unordered = [
      { id: 'native:12', createdAt: '2026-11-01T08:00:00.000Z' },
      { id: 'native:45', createdAt: '2026-11-11T09:30:00.000Z' },
      { id: 'native:30', createdAt: '2026-11-09T12:00:00.000Z' },
      { id: 'native:31', createdAt: '2026-11-09T12:00:00.000Z' },
    ]
    const sorted = sortAlbumPhotosNewestFirst(unordered)
    expect(sorted.map((x) => x.id)).toEqual(['native:45', 'native:31', 'native:30', 'native:12'])
  })

  it('相册菜单目录首项固定为「全部」，支持稳定目录顺序与按相册过滤分页', async () => {
    const normalized = normalizeAlbumBuckets([
      { id: 'b-cam', name: 'Camera', count: 18 },
      { id: 'b-shot', name: 'Screenshots', count: 7 },
      { id: 'b-cam', name: 'Camera Duplicate', count: 99 },
    ])
    expect(normalized).toEqual([
      { id: NATIVE_ALBUM_ALL_ID, name: NATIVE_ALBUM_ALL_LABEL, count: 25 },
      { id: 'b-cam', name: 'Camera', count: 18 },
      { id: 'b-shot', name: 'Screenshots', count: 7 },
    ])

    // 纯网页端返回空目录列表
    expect(await listNativeAlbumBuckets()).toEqual([])

    const g = globalThis as unknown as { window?: Window }
    const prevWindow = g.window
    g.window = {
      DayDayOnNative: {
        requestPermission: () => 'granted',
        getAlbumBucketsJson: () =>
          JSON.stringify([
            { id: '__ALL__', name: '全部', count: 3 },
            { id: 'cam', name: 'Camera', count: 2 },
            { id: 'raw', name: 'RAW', count: 1 },
          ]),
        getAlbumPhotosPageWithBucketJson: (_offset: number, _limit: number, bucketId: string) =>
          JSON.stringify({
            items:
              bucketId === 'raw'
                ? [
                    {
                      id: '201',
                      name: 'DSC_0201.dng',
                      previewUrl: '/__native__/media/thumb/201',
                      fullUrl: '/__native__/media/full/201',
                      createdAt: '2026-11-11T05:00:00.000Z',
                      width: 4000,
                      height: 3000,
                      albumId: 'raw',
                      albumName: 'RAW',
                    },
                  ]
                : [
                    {
                      id: '101',
                      name: 'OLD_SYNCED.jpg',
                      previewUrl: '/__native__/media/thumb/101',
                      createdAt: '2026-08-01T10:00:00.000Z',
                      width: 1080,
                      height: 1080,
                      albumId: 'cam',
                    },
                    {
                      id: '205',
                      name: 'NEW_SHOT.jpg',
                      previewUrl: '/__native__/media/thumb/205',
                      createdAt: '2026-11-11T06:20:00.000Z',
                      width: 1080,
                      height: 1440,
                      albumId: 'cam',
                    },
                  ],
            hasMore: false,
            nextOffset: bucketId === 'raw' ? 1 : 2,
            partialAccess: false,
          }),
      },
    } as unknown as Window

    try {
      const buckets = await listNativeAlbumBuckets()
      expect(buckets[0]).toEqual({ id: '__ALL__', name: '全部', count: 3 })
      expect(buckets.map((b) => b.name)).toEqual(['全部', 'Camera', 'RAW'])

      const allPage = await listNativeAlbumPhotosPage(0, 30, '__ALL__')
      expect(allPage.items.map((i) => i.name)).toEqual(['NEW_SHOT.jpg', 'OLD_SYNCED.jpg'])

      const rawPage = await listNativeAlbumPhotosPage(0, 30, 'raw')
      expect(rawPage.items).toHaveLength(1)
      expect(rawPage.items[0]?.name).toBe('DSC_0201.dng')
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

  it('原生 0ms 开屏收尾与应用内 APK 更新闭环桥接正常运作', () => {
    const g = globalThis as unknown as { window?: Window }
    const prevWindow = g.window
    let splashDismissed = false
    let installedTriggered = false

    g.window = {
      DayDayOnNative: {
        dismissSplash: () => {
          splashDismissed = true
        },
        startApkUpdate: (url: string, sha256: string, version: string) =>
          JSON.stringify({
            state: 'downloading',
            percent: 25,
            downloadedBytes: 210_000,
            totalBytes: 840_000,
            version,
            canInstall: true,
            url,
            sha256,
          }),
        getApkUpdateStatusJson: () =>
          JSON.stringify({
            state: 'ready',
            percent: 100,
            downloadedBytes: 840_000,
            totalBytes: 840_000,
            version: '0.1.6',
            canInstall: true,
          }),
        installDownloadedApk: () => {
          installedTriggered = true
          return true
        },
      },
    } as unknown as Window

    try {
      dismissNativeSplash()
      expect(splashDismissed).toBe(true)
      expect(hasNativeApkUpdater()).toBe(true)

      const started = startNativeApkUpdate({
        url: '/download/DayDayOn.apk',
        sha256: 'a'.repeat(64),
        version: '0.1.6',
      })
      expect(started.state).toBe('downloading')
      expect(started.percent).toBe(25)

      let streamedPercent = 0
      const unsub = subscribeNativeApkUpdateProgress((s) => {
        streamedPercent = s.percent
      })
      g.window.__ddoOnUpdateProgress?.({
        state: 'downloading',
        percent: 78,
        downloadedBytes: 650_000,
        totalBytes: 840_000,
        version: '0.1.6',
        canInstall: true,
      })
      expect(streamedPercent).toBe(78)
      unsub()

      const ready = getNativeApkUpdateStatus()
      expect(ready.state).toBe('ready')
      expect(ready.percent).toBe(100)
      expect(installNativeDownloadedApk()).toBe(true)
      expect(installedTriggered).toBe(true)
    } finally {
      g.window = prevWindow
    }
  })

  it('syncNativeReminder 与 sendNativeTestNotification 严格校验通知权限为 granted', async () => {
    const g = globalThis as unknown as { window?: Window }
    const prevWindow = g.window
    let scheduledCalls = 0
    let notifiedTitle = ''
    let openedNotifSettings = false

    // 1. 权限停留在 prompt/denied 时绝不虚报提醒开启成功
    g.window = {
      DayDayOnNative: {
        requestPermission: () => 'denied',
        scheduleDailyReminder: () => {
          scheduledCalls++
          return true
        },
        openNotificationSettings: () => {
          openedNotifSettings = true
        },
      },
    } as unknown as Window

    try {
      expect(await syncNativeReminder({ enabled: true, remindAt: '20:30' })).toBe(false)
      expect(scheduledCalls).toBe(0)
      expect(await sendNativeTestNotification()).toBe(false)
      expect(openNativeNotificationSettings()).toBe(true)
      expect(openedNotifSettings).toBe(true)

      // 2. 权限为 granted 时正常注册每日提醒并可推送真实系统通知
      g.window = {
        DayDayOnNative: {
          requestPermission: () => 'granted',
          scheduleDailyReminder: (remindAt: string, enabled: boolean) => {
            if (remindAt === '20:30' && enabled) scheduledCalls++
            return true
          },
          notify: (title: string) => {
            notifiedTitle = title
            return true
          },
        },
      } as unknown as Window

      expect(await syncNativeReminder({ enabled: true, remindAt: '20:30' })).toBe(true)
      expect(scheduledCalls).toBe(1)
      expect(await sendNativeTestNotification('测试标题', '测试正文')).toBe(true)
      expect(notifiedTitle).toBe('测试标题')
    } finally {
      g.window = prevWindow
    }
  })

  it('pickNativeSystemFiles 通过原生内存流桥接解析图片与文本附件，网页端安全回退 null', async () => {
    expect(hasNativeSystemFilePicker()).toBe(false)
    expect(await pickNativeSystemFiles('*/*', 9)).toBeNull()

    const g = globalThis as unknown as { window?: Window }
    const prevWindow = g.window
    let capturedAccept = ''
    let capturedMax = 0

    const encodedNote = Buffer.from('今天慢跑30分钟', 'utf8').toString('base64')

    g.window = {
      DayDayOnNative: {
        pickSystemFiles: (accept: string, maxCount: number) => {
          capturedAccept = accept
          capturedMax = maxCount
          setTimeout(() => {
            g.window?.__ddoOnSystemFilesResult?.([
              {
                url: `data:text/plain;base64,${encodedNote}`,
                name: 'workout.txt',
                mimeType: 'text/plain',
              },
            ])
          }, 0)
        },
      },
    } as unknown as Window

    try {
      expect(hasNativeSystemFilePicker()).toBe(true)
      const files = await pickNativeSystemFiles('image/*,.txt', 9)
      expect(capturedAccept).toBe('image/*,.txt')
      expect(capturedMax).toBe(9)
      expect(files).toHaveLength(1)
      expect(files?.[0]?.name).toBe('workout.txt')
      expect(files?.[0]?.type).toBe('text/plain')
      expect(await files?.[0]?.text()).toBe('今天慢跑30分钟')
    } finally {
      g.window = prevWindow
    }
  })

  it('sniffIsImageFile 支持无扩展名 / octet-stream 的图片文件头魔数嗅探', async () => {
    const pngHead = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(hasImageMagicBytes(pngHead)).toBe(true)

    const extensionlessPng = new File([pngHead], 'msf_1000034821', {
      type: 'application/octet-stream',
    })
    expect(await sniffIsImageFile(extensionlessPng)).toBe(true)

    const textDoc = new File(['早餐全麦面包配牛奶'], 'diet_note', {
      type: 'application/octet-stream',
    })
    expect(await sniffIsImageFile(textDoc)).toBe(false)
  })
})
