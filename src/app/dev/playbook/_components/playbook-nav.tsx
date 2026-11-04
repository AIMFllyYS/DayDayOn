'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Icon, type IconName } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

export interface PlaybookNavChild {
  href: string
  label: string
  icon: IconName
}

export interface PlaybookNavItem {
  href: string
  label: string
  children?: readonly PlaybookNavChild[]
}

export const playbookModuleChildren: readonly PlaybookNavChild[] = [
  { href: '/dev/playbook/modules/diet', label: '好好吃饭 · 饮食', icon: 'diet' },
  { href: '/dev/playbook/modules/exercise', label: '动一动 · 运动', icon: 'exercise' },
  { href: '/dev/playbook/modules/sleep', label: '早点睡 · 睡眠', icon: 'sleep' },
  { href: '/dev/playbook/modules/study', label: '学一点 · 学习', icon: 'study' },
  { href: '/dev/playbook/modules/custom', label: '我的小目标 · 自定义', icon: 'custom' },
] as const

export const playbookPages: readonly PlaybookNavItem[] = [
  { href: '/dev/playbook', label: '总览' },
  { href: '/dev/playbook/foundations', label: '色彩与字体' },
  { href: '/dev/playbook/motion', label: '动效' },
  { href: '/dev/playbook/components', label: '原子组件' },
  { href: '/dev/playbook/primitives', label: '交互原语' },
  { href: '/dev/playbook/data', label: '数据与时间' },
  { href: '/dev/playbook/navigation', label: '导航与布局' },
  { href: '/dev/playbook/pet', label: '小宠物' },
  { href: '/dev/playbook/social', label: '消息与社交' },
  { href: '/dev/playbook/smart-checkin', label: '智能打卡' },
  {
    href: '/dev/playbook/modules',
    label: '打卡板块',
    children: playbookModuleChildren,
  },
  { href: '/dev/playbook/agent', label: 'Agent 组件' },
  { href: '/dev/playbook/rendering', label: 'AI 输出渲染' },
  { href: '/dev/playbook/pages', label: '页面预览' },
] as const

/** 手机端横向滚动的标签，桌面端竖排在左侧（支持「打卡板块」文件夹树结构） */
export function PlaybookNav() {
  const pathname = usePathname()
  const inModules = pathname.startsWith('/dev/playbook/modules')
  const [treeOpen, setTreeOpen] = useState(true)
  const expanded = treeOpen || inModules

  return (
    <nav aria-label="Playbook 目录" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1.5 md:flex-col">
        {playbookPages.map((p) => {
          const active = pathname === p.href
          const hasChildren = p.children && p.children.length > 0
          const branchActive = hasChildren && pathname.startsWith(p.href)

          if (!hasChildren) {
            return (
              <li key={p.href} className="shrink-0">
                <Link
                  href={p.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'text-caption flex h-10 items-center rounded-full px-4 font-semibold whitespace-nowrap transition-colors duration-(--dur-fast) md:rounded-xl',
                    active
                      ? 'bg-primary-soft text-primary-ink'
                      : 'text-muted hover:bg-surface-sunken hover:text-foreground',
                  )}
                >
                  {p.label}
                </Link>
              </li>
            )
          }

          return (
            <li
              key={p.href}
              className="flex shrink-0 items-center gap-1.5 md:flex-col md:items-stretch md:gap-1"
            >
              <div className="flex items-center gap-1">
                <Link
                  href={p.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'text-caption flex h-10 flex-1 items-center gap-2 rounded-full px-4 font-semibold whitespace-nowrap transition-colors duration-(--dur-fast) md:rounded-xl',
                    active
                      ? 'bg-primary-soft text-primary-ink'
                      : branchActive
                        ? 'bg-surface-sunken text-foreground font-bold'
                        : 'text-muted hover:bg-surface-sunken hover:text-foreground',
                  )}
                >
                  <Icon name="check" size={15} className="text-primary-ink shrink-0" />
                  <span>{p.label}</span>
                </Link>
                <button
                  type="button"
                  aria-label={expanded ? '收起打卡板块目录' : '展开打卡板块目录'}
                  aria-expanded={expanded}
                  onClick={() => setTreeOpen((v) => !v)}
                  className="text-muted hover:bg-surface-sunken hover:text-foreground hidden size-8 shrink-0 items-center justify-center rounded-lg transition-colors md:inline-flex"
                >
                  <Icon
                    name="chevron-down"
                    size={14}
                    className={cn(
                      'transition-transform duration-(--dur-fast)',
                      !expanded && '-rotate-90',
                    )}
                  />
                </button>
              </div>

              {/* 桌面端树形子层级 + 手机端横向平铺子胶囊 */}
              {expanded && p.children && (
                <ul className="border-border flex gap-1 md:ml-4 md:flex-col md:border-l md:pl-2.5">
                  {p.children.map((child) => {
                    const childActive = pathname === child.href
                    return (
                      <li key={child.href} className="shrink-0">
                        <Link
                          href={child.href}
                          aria-current={childActive ? 'page' : undefined}
                          className={cn(
                            'text-tiny flex h-8 items-center gap-2 rounded-full px-3 font-semibold whitespace-nowrap transition-colors duration-(--dur-fast) md:rounded-lg',
                            childActive
                              ? 'bg-primary-soft text-primary-ink font-bold'
                              : 'text-muted hover:bg-surface-sunken hover:text-foreground',
                          )}
                        >
                          <Icon name={child.icon} size={13} className="shrink-0" />
                          <span>{child.label}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
