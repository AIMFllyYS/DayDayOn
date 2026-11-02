import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { BackButton } from './back-button'
import { TopBar } from './top-bar'
import { TopBarActions, TopBarUserAvatar } from './top-bar-nav'

interface AppPageProps {
  /** 页面标题，和导航文字一致 */
  title: ReactNode
  eyebrow?: string
  leading?: ReactNode
  actions?: ReactNode
  /** 二级页面传上一级路径：顶栏显示返回按钮，没有站内历史时跳到这里 */
  backHref?: string
  /** 返回按钮是否显示文字"返回" */
  showBackText?: boolean
  children: ReactNode
  className?: string
  /** 是否占满视口且贴合底部（如 Agent 全屏页） */
  fitViewport?: boolean
  /** 是否隐藏顶栏（如"我的"页卡片直接置顶） */
  hideTopBar?: boolean
  /** 是否为主导航一级页面（主页、待办、排行）：左侧展示用户头像，右侧展示通知与加号快捷操作 */
  primaryNav?: boolean
}

/**
 * (app) 下每个页面的骨架：吸顶 TopBar + 内容区。
 * 内容区是容器查询的根（@container），左右边距和 TopBar 对齐（手机 16px，≥ 768px 32px）。
 */
export function AppPage({
  title,
  eyebrow,
  leading,
  actions,
  backHref,
  showBackText = false,
  children,
  className,
  fitViewport = false,
  hideTopBar = false,
  primaryNav = false,
}: AppPageProps) {
  const resolvedLeading =
    leading ??
    (backHref ? (
      <BackButton fallbackHref={backHref} showText={showBackText} />
    ) : primaryNav ? (
      <TopBarUserAvatar />
    ) : undefined)

  const resolvedActions = actions ?? (primaryNav ? <TopBarActions /> : undefined)

  const content = (
    <>
      {!hideTopBar && (
        <TopBar
          title={title}
          eyebrow={eyebrow}
          actions={resolvedActions}
          leading={resolvedLeading}
        />
      )}
      <div
        className={cn(
          '@container flex w-full max-w-full min-w-0 flex-1 flex-col px-4 md:px-8',
          hideTopBar && 'pt-[calc(var(--safe-top)+0.75rem)] md:pt-6',
          fitViewport && 'min-h-0 overflow-hidden pb-0',
          className,
        )}
      >
        {children}
      </div>
    </>
  )

  if (fitViewport) {
    return (
      <div className="-mb-[calc(var(--safe-bottom)+6.5rem)] flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-hidden md:-mb-8">
        {content}
      </div>
    )
  }

  return content
}
