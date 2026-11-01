import type { Metadata } from 'next'
import { ComingSoon } from '@/components/layout/coming-soon'

export const metadata: Metadata = { title: '新人引导' }

/** 占位页（F3），由领域 Agent 替换 */
export default function Page() {
  return (
    <>
      <h1 className="text-title text-center font-bold">新人引导</h1>
      <ComingSoon />
    </>
  )
}
