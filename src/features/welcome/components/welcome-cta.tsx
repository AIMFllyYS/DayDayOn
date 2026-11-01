import { headers } from 'next/headers'
import { LinkButton } from '@/features/dashboard/components/link-button'
import { getSessionCookie } from '@/server/auth/cookie'

/*
 * 落地页主按钮：有会话 cookie 时"进入 DayDayOn"，否则"开始打卡"去登录页（ADR-0022）。
 * 只看 cookie 是否存在、不校验会话（和 proxy 一样）；cookie 过期的人点进主页会被页面送回登录页。
 * 读 cookie，必须放在 <Suspense> 里（cacheComponents）。
 */
export async function WelcomeCta() {
  const signedIn = getSessionCookie(await headers()) !== null
  return signedIn ? (
    <LinkButton href="/" icon="home">
      进入 DayDayOn
    </LinkButton>
  ) : (
    <>
      <LinkButton href="/login" icon="check">
        开始打卡
      </LinkButton>
      <LinkButton href="#modules" variant="soft">
        先看看能做什么
      </LinkButton>
    </>
  )
}

/** 预渲染时的占位：和未登录的样子一致，避免布局跳动 */
export function WelcomeCtaFallback() {
  return (
    <>
      <LinkButton href="/login" icon="check">
        开始打卡
      </LinkButton>
      <LinkButton href="#modules" variant="soft">
        先看看能做什么
      </LinkButton>
    </>
  )
}
