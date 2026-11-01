'use client'

import { BrandMark, BrandWordmark } from '@/components/layout/brand'
import { Button } from '@/components/ui/button'
import { WelcomeContent } from '@/features/welcome/components/welcome-content'

/*
 * 落地页预览：渲染正式组件 WelcomeContent，CTA 换成不跳转的静态按钮。
 * 结构与 (marketing)/layout.tsx 一致：顶栏品牌 + 容器查询根。
 */
export function WelcomeScreen({ thumb = false }: { thumb?: boolean }) {
  const cta = (
    <>
      <Button icon="check">开始打卡</Button>
      <Button variant="soft">先看看能做什么</Button>
    </>
  )
  return (
    <div className="bg-paper min-h-full">
      <header className="flex items-center gap-2.5 px-4 pt-10 pb-2">
        <BrandMark size={32} />
        <BrandWordmark />
      </header>
      <div className="@container px-4">
        <WelcomeContent cta={cta} thumb={thumb} />
      </div>
    </div>
  )
}
