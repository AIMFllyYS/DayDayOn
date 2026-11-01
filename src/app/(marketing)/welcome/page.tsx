import type { Metadata } from 'next'
import { Suspense } from 'react'
import { WelcomeCta, WelcomeCtaFallback } from '@/features/welcome/components/welcome-cta'
import { WelcomeContent } from '@/features/welcome/components/welcome-content'

export const metadata: Metadata = {
  title: { absolute: 'DayDayOn · 和朋友一起的打卡手账' },
  description: '运动、饮食、睡眠、学习和你自己的小目标。拍张照让 AI 帮你记，和朋友一起看谁更坚持。',
}

/** 落地页（ADR-0022）：未登录打开 / 时由 proxy 送到这里；已登录也能直接访问 */
export default function Page() {
  const cta = (
    <Suspense fallback={<WelcomeCtaFallback />}>
      <WelcomeCta />
    </Suspense>
  )
  return <WelcomeContent cta={cta} />
}
