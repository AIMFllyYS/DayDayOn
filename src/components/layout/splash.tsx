import { BrandWordmark } from '@/components/layout/brand'
import { MascotSvg } from '@/components/mascot/mascot-svg'
import { Stamp } from '@/components/ui/stamp'
import { cn } from '@/lib/cn'
import { splashGreetingText, type SplashGreeting } from '@/lib/splash'

const GREETINGS: SplashGreeting[] = ['morning', 'day', 'night']

/*
 * 开屏画面（ADR-0022）。静态 HTML + CSS：默认 display: none，<html data-splash> 时才显示（globals.css 的 .splash）。
 * 团团的位置（top 42%）与挖洞圆心一致；底色与 manifest 的 background_color（--background）一致，
 * 这样系统开屏的最后一帧和这里的第一帧能接上。
 * preview：Playbook 里放在手机框中演示，用 absolute 代替 fixed，只渲染一句问候。
 */
export function Splash({
  preview = false,
  greeting = 'day',
}: {
  preview?: boolean
  greeting?: SplashGreeting
}) {
  const greetings = preview ? [greeting] : GREETINGS
  return (
    <div
      id={preview ? undefined : 'app-splash'}
      aria-hidden
      data-preview={preview || undefined}
      className={cn(
        'splash bg-background inset-0 z-[100] select-none',
        preview ? 'absolute' : 'fixed',
      )}
    >
      <div className="absolute top-[42%] left-1/2 flex -translate-x-1/2 -translate-y-[64px] flex-col items-center">
        <div className="relative">
          <span className="animate-splash-hop block" style={{ transformOrigin: '50% 90%' }}>
            <span className="splash-char-tuan inline-flex">
              <MascotSvg mood="happy" size={128} character="tuan" />
            </span>
            <span className="splash-char-dun">
              <MascotSvg mood="happy" size={128} character="dun" />
            </span>
          </span>
          <Stamp
            text="开始啦"
            caption="DayDayOn"
            size={64}
            animate
            className="absolute -top-2 -right-12 ![animation-delay:900ms]"
          />
        </div>
        <BrandWordmark className="text-title mt-6" />
        {greetings.map((g) => (
          <p
            key={g}
            className={cn('splash-greet text-caption text-muted mt-1', `splash-greet-${g}`)}
          >
            {splashGreetingText[g]}
          </p>
        ))}
      </div>
    </div>
  )
}
