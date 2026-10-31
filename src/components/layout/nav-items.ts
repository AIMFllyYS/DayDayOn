import type { IconName } from '@/components/ui/icon'

export interface NavItem {
  href: string
  label: string
  icon: IconName
}

/*
 * 应用主导航。手机底栏：前两项 + 中间"＋" + 后两项；桌面侧栏按顺序排列。
 * 路由路径见 docs/conventions/routing.md，改这里要同步改那份文档。
 */
export const appNavItems: readonly NavItem[] = [
  { href: '/', label: '主页', icon: 'home' },
  { href: '/todo', label: '待办', icon: 'todo' },
  { href: '/rank', label: '排行', icon: 'trophy' },
  { href: '/me', label: '我的', icon: 'user' },
]

/** 判断导航项是否高亮：主页只精确匹配，其余按前缀匹配（/todo/123 也高亮"待办"） */
export function isNavActive(itemHref: string, currentPath: string): boolean {
  if (itemHref === '/') return currentPath === '/'
  return currentPath === itemHref || currentPath.startsWith(`${itemHref}/`)
}
