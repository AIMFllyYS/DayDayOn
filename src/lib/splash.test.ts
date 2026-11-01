import { describe, expect, it } from 'vitest'
import { SPLASH_MASCOT_KEY, SPLASH_PLAYED_KEY, splashGreeting, splashScript } from './splash'

const ANDROID = 'Mozilla/5.0 (Linux; Android 15) Chrome/140.0 Mobile Safari/537.36'

interface Env {
  ua?: string
  standalone?: boolean
  coarse?: boolean
  played?: boolean
  mascot?: string
  hour?: number
}

/** 在假的 window / document 上执行内联脚本，返回它写到 <html> 上的 dataset */
function run(env: Env = {}) {
  const session = new Map<string, string>(env.played ? [[SPLASH_PLAYED_KEY, '1']] : [])
  const local = new Map<string, string>(env.mascot ? [[SPLASH_MASCOT_KEY, env.mascot]] : [])
  const storage = (m: Map<string, string>) => ({
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  })
  const dataset: Record<string, string> = {}
  const window = {
    navigator: { userAgent: env.ua ?? ANDROID },
    matchMedia: (q: string) => ({
      matches: q.includes('standalone') ? (env.standalone ?? false) : (env.coarse ?? true),
    }),
    sessionStorage: storage(session),
    localStorage: storage(local),
  }
  const document = { documentElement: { dataset } }
  const hour = env.hour ?? 12
  class FakeDate {
    getHours() {
      return hour
    }
  }
  new Function('window', 'document', 'Date', splashScript)(window, document, FakeDate)
  return { dataset, session }
}

describe('splashScript', () => {
  it('浏览器里直接打开网址不播放', () => {
    expect(run({ standalone: false }).dataset.splash).toBeUndefined()
  })

  it('手机上已安装的 PWA 冷启动时播放，并记下本次已播', () => {
    const { dataset, session } = run({ standalone: true })
    expect(dataset.splash).toBe('1')
    expect(session.get(SPLASH_PLAYED_KEY)).toBe('1')
  })

  it('桌面上安装的 PWA（非触屏）不播放', () => {
    expect(run({ standalone: true, coarse: false }).dataset.splash).toBeUndefined()
  })

  it('APK 壳里总是按冷启动处理', () => {
    expect(run({ ua: `${ANDROID} DayDayOnApp/1.0.0`, coarse: false }).dataset.splash).toBe('1')
  })

  it('同一次启动里不重播', () => {
    expect(run({ standalone: true, played: true }).dataset.splash).toBeUndefined()
  })

  it('记住的形象是墩墩时换成墩墩，其他值保持团团', () => {
    expect(run({ standalone: true, mascot: 'dun' }).dataset.splashChar).toBe('dun')
    expect(run({ standalone: true, mascot: 'x' }).dataset.splashChar).toBeUndefined()
  })

  it('问候分档与 splashGreeting 一致', () => {
    for (const hour of [0, 4, 5, 10, 11, 21, 22, 23]) {
      expect(run({ standalone: true, hour }).dataset.splashGreet).toBe(splashGreeting(hour))
    }
  })

  it('读存储出错时不播放', () => {
    const dataset: Record<string, string> = {}
    const window = {
      navigator: { userAgent: ANDROID },
      matchMedia: () => ({ matches: true }),
      get sessionStorage(): never {
        throw new Error('SecurityError')
      },
    }
    new Function('window', 'document', splashScript)(window, { documentElement: { dataset } })
    expect(dataset.splash).toBeUndefined()
  })
})

describe('splashGreeting', () => {
  it('5–10 点早安，11–21 点白天，22–4 点夜里', () => {
    expect(splashGreeting(5)).toBe('morning')
    expect(splashGreeting(10)).toBe('morning')
    expect(splashGreeting(11)).toBe('day')
    expect(splashGreeting(21)).toBe('day')
    expect(splashGreeting(22)).toBe('night')
    expect(splashGreeting(4)).toBe('night')
  })
})
