import type { ReactNode } from 'react'
import { WelcomeMascotProvider } from './mascot-context'
import { WelcomeAiDemo } from './welcome-ai-demo'
import { WelcomeCheckinDemo } from './welcome-checkin-demo'
import { WelcomeClosing, WelcomePrivacy } from './welcome-closing'
import { WelcomeDownload } from './welcome-download'
import { WelcomeFriends } from './welcome-friends'
import { WelcomeHero } from './welcome-hero'
import { WelcomeModules } from './welcome-modules'

/**
 * 落地页正文（ADR-0022）：/welcome 和 Playbook 的页面预览共用。
 * 所有演示都是写死的数据，不调接口。cta 由调用方给：正式页面按是否登录换文字，Playbook 给静态按钮。
 * 宽度适配用容器查询（@2xl 等），调用方要提供 @container 根。
 */
export function WelcomeContent({ cta, thumb = false }: { cta: ReactNode; thumb?: boolean }) {
  return (
    <WelcomeMascotProvider>
      <WelcomeHero cta={cta} thumb={thumb} />
      <WelcomeModules />
      <WelcomeAiDemo />
      <WelcomeCheckinDemo />
      <WelcomeFriends />
      <WelcomeDownload />
      <WelcomePrivacy />
      <WelcomeClosing cta={cta} />
    </WelcomeMascotProvider>
  )
}
