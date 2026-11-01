import Link from 'next/link'
import { BrandMark, BrandWordmark } from '@/components/layout/brand'

/*
 * 登录、引导、隐私说明（routing.md 第 2 节）：无导航，内容居中，最宽 md。
 * 不读会话：/login、/privacy 不要求登录；/onboarding 的校验在页面里（D1）。
 */
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 pt-[calc(var(--safe-top)+1.5rem)] pb-[calc(var(--safe-bottom)+1.5rem)]">
      <Link href="/" className="flex items-center gap-2.5" aria-label="DayDayOn 主页">
        <BrandMark size={32} />
        <BrandWordmark />
      </Link>
      <main className="flex w-full max-w-md flex-1 flex-col justify-center py-8">{children}</main>
    </div>
  )
}
