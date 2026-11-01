import Link from 'next/link'
import { BrandMark, BrandWordmark } from '@/components/layout/brand'

/*
 * 落地页外壳（routing.md 第 2 节、ADR-0022）：顶栏品牌 + 页脚，内容最宽 5xl。
 * 不读会话：整页能预渲染成静态外壳；只有页面里的 CTA 在 <Suspense> 里读 cookie。
 */
export default function MarketingLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="bg-paper flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-2.5 px-4 pt-[calc(var(--safe-top)+1rem)] pb-2 md:px-8">
        <Link href="/welcome" className="flex items-center gap-2.5" aria-label="DayDayOn 介绍">
          <BrandMark size={32} />
          <BrandWordmark />
        </Link>
      </header>
      <main className="@container mx-auto w-full max-w-5xl flex-1 px-4 md:px-8">{children}</main>
      <footer className="text-tiny text-muted mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-4 pb-[calc(var(--safe-bottom)+1.5rem)] md:px-8">
        <span>DayDayOn · 和朋友一起的打卡手账</span>
        <Link href="/privacy" className="hover:text-foreground underline">
          隐私说明
        </Link>
      </footer>
    </div>
  )
}
