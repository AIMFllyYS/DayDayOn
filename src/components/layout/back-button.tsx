'use client'

import { useRouter } from 'next/navigation'
import { IconButton } from '@/components/ui/button'

/**
 * 二级页面的返回按钮（routing.md 第 7 节）：有历史时 router.back()，
 * 从深链接直接打开（历史只有这一页）时跳到上一级路径。
 */
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter()
  return (
    <IconButton
      icon="chevron-left"
      label="返回"
      className="-ml-2"
      onClick={() => {
        if (window.history.length > 1) router.back()
        else router.push(fallbackHref)
      }}
    />
  )
}
