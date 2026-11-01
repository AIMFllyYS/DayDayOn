import { NATIVE_UA_TOKEN } from './native'

/*
 * 开屏（ADR-0022、pwa.md 第 6 节）：只在"手机上以 App 形式冷启动"时播放一次。
 * - APK 壳、已安装的 PWA（display-mode: standalone）并且是触屏设备：播放
 * - 浏览器直接打开网址、桌面：不播放
 * - 同一次启动（sessionStorage 还在）里刷新、切后台再回来：不重播
 *
 * 必须在首帧前决定，否则会先闪出页面再盖上开屏。所以由根布局 <head> 里的内联脚本执行，
 * 只给 <html> 写 data-splash、data-splash-char、data-splash-greet 三个属性；开屏本身是静态 HTML + CSS，
 * 不依赖水合。只读 storage 和 matchMedia，不读 cookie 和会话，根布局保持静态（cacheComponents）。
 */

export const SPLASH_PLAYED_KEY = 'daydayon:splash-played:v1'
/** 上次用的形象（团团 / 墩墩），登录后由 ThemeSync 写入，开屏用它挑那一只 */
export const SPLASH_MASCOT_KEY = 'daydayon:mascot:v1'

export type SplashGreeting = 'morning' | 'day' | 'night'

/** 按本地小时选一句问候：5–10 点早安，22–4 点夜里，其余白天 */
export function splashGreeting(hour: number): SplashGreeting {
  if (hour < 5 || hour >= 22) return 'night'
  if (hour < 11) return 'morning'
  return 'day'
}

export const splashGreetingText: Record<SplashGreeting, string> = {
  morning: '早安，今天也一起加油',
  day: '欢迎回来，今天也一起加油',
  night: '这么晚还在呀，早点休息',
}

/** 记住形象，下次开屏用；存不了就算了，开屏退回团团 */
export function rememberSplashMascot(character: string) {
  try {
    window.localStorage.setItem(SPLASH_MASCOT_KEY, character)
  } catch {
    // 隐私模式或禁用存储
  }
}

/*
 * 内联脚本。逻辑与上面的注释一致；问候分档与 splashGreeting 一致（单测会执行这段脚本核对）。
 * 任何一步出错都不播放开屏，页面照常显示。
 */
export const splashScript = `(function(){try{var w=window,d=document.documentElement,n=w.navigator,ua=n.userAgent||"";var app=ua.indexOf(${JSON.stringify(NATIVE_UA_TOKEN)})>-1;var sa=app||w.matchMedia("(display-mode: standalone)").matches||n.standalone===true;if(!sa||!(app||w.matchMedia("(pointer: coarse)").matches))return;var s=w.sessionStorage;if(s.getItem(${JSON.stringify(SPLASH_PLAYED_KEY)}))return;s.setItem(${JSON.stringify(SPLASH_PLAYED_KEY)},"1");if(w.localStorage.getItem(${JSON.stringify(SPLASH_MASCOT_KEY)})==="dun")d.dataset.splashChar="dun";var h=new Date().getHours();d.dataset.splashGreet=h<5||h>=22?"night":h<11?"morning":"day";d.dataset.splash="1"}catch(e){}})()`
