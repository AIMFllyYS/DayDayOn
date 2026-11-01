import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { BackButton } from './back-button'
import { TopBar } from './top-bar'

interface AppPageProps {
  /** 页面标题，和导航文字一致 */
  title: string
  eyebrow?: string
  actions?: ReactNode
  /** 二级页面传上一级路径：顶栏显示返回按钮，没有站内历史时跳到这里 */
  backHref?: string
  children: ReactNode
  className?: string
}

/**
 * (app) 下每个页面的骨架：吸顶 TopBar + 内容区。
 * 内容区是容器查询的根（@container），左右边距和 TopBar 对齐（手机 16px，≥ 768px 32px）。
 */
export function AppPage({ title, eyebrow, actions, backHref, children, className }: AppPageProps) {
  return (
    <>
      <TopBar
        title={title}
        eyebrow={eyebrow}
        actions={actions}
        leading={backHref ? <BackButton fallbackHref={backHref} /> : undefined}
      />
      <div
        className={cn(
          '@container flex w-full max-w-full min-w-0 flex-1 flex-col px-4 md:px-8',
          className,
        )}
      >
        {children}
      </div>
    </>
  )
}
