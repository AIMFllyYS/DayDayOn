'use client'

import { useRouter } from 'next/navigation'
import { IconButton } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

interface BackButtonProps {
  fallbackHref: string
  showText?: boolean
  className?: string
}

/**
 * 二级页面的返回按钮（routing.md 第 7 节）：有历史时 router.back()，
 * 从深链接直接打开（历史只有这一页）时跳到上一级路径。
 */
export function BackButton({ fallbackHref, showText = false, className }: BackButtonProps) {
  const router = useRouter()

  function handleClick() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  if (showText) {
    return (
      <button
        type="button"
        aria-label="返回"
        onClick={handleClick}
        className={cn(
          'text-muted hover:text-foreground text-caption -ml-1.5 flex items-center gap-0.5 py-1 pr-2 font-medium transition-colors select-none active:scale-95',
          className,
        )}
      >
        <Icon name="chevron-left" size={18} lineOnly />
        <span>返回</span>
      </button>
    )
  }

  return (
    <IconButton
      icon="chevron-left"
      label="返回"
      className={cn('-ml-2', className)}
      onClick={handleClick}
    />
  )
}
