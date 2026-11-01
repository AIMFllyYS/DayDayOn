import { describe, expect, it } from 'vitest'
import { detectPlatform, isNativeShellUA } from './native'

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36'
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'
const WINDOWS_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0'

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
