import type { ReactNode } from 'react'
import { IconButton } from '@/components/ui/button'
import { AdminScreen } from './admin'
import { CheckinScreen } from './checkin'
import { GoalsScreen } from './goals'
import { HomeScreen } from './home'
import { LoginScreen } from './login'
import { MeScreen } from './me'
import { RankScreen } from './rank'
import { TodoScreen } from './todo'

/*
 * 页面预览登记表：每个真实页面一项，路由与 docs/conventions/routing.md 第 2 节一致。
 * shell：app 用应用外壳（一级页面带主导航，二级页面带返回）；bare 是无导航的独立页面（登录、引导）。
 * 页面上线后，正式页面应该和这里的预览长得一样；改样式先改这里，再改正式页面。
 */
export type ScreenId = 'home' | 'todo' | 'rank' | 'me' | 'goals' | 'checkin' | 'login' | 'admin'

export interface ScreenDef {
  id: ScreenId
  route: string
  title: string
  note: string
  shell: 'app' | 'bare'
  /** 一级页面在主导航里的路径 */
  navPath?: string
  eyebrow?: string
  actions?: ReactNode
  /** thumb：总览墙里的缩略图，互动组件换成静态版（一屏不放两只互动吉祥物） */
  render: (opts: { thumb: boolean }) => ReactNode
}

export const screens: ScreenDef[] = [
  {
    id: 'home',
    route: '/',
    title: '主页',
    note: '仪表盘（固定布局）：今日总览、各板块进度、每日指标、朋友动态',
    shell: 'app',
    navPath: '/',
    eyebrow: '11 月 1 日 · 周日',
    actions: <IconButton icon="bell" label="提醒" />,
    render: () => <HomeScreen />,
  },
  {
    id: 'todo',
    route: '/todo',
    title: '待办',
    note: '清单 + DDL；勾选有回弹动画，完成的移到下方',
    shell: 'app',
    navPath: '/todo',
    render: () => <TodoScreen />,
  },
  {
    id: 'rank',
    route: '/rank',
    title: '排行',
    note: '本周 / 本月；前三名领奖台，“我”固定在底部；只显示公开用户',
    shell: 'app',
    navPath: '/rank',
    render: () => <RankScreen />,
  },
  {
    id: 'me',
    route: '/me',
    title: '我的',
    note: '互动吉祥物只在这里出现；外观里选主题色和形象',
    shell: 'app',
    navPath: '/me',
    actions: <IconButton icon="sliders" label="设置" />,
    render: ({ thumb }) => <MeScreen thumb={thumb} />,
  },
  {
    id: 'goals',
    route: '/goals',
    title: '我的目标',
    note: '列表 / 选板块 / 表单 / 详情 / 动态表单（正式组件 + 演示数据）',
    shell: 'app',
    render: () => <GoalsScreen />,
  },
  {
    id: 'checkin',
    route: '/goals/[goalId]/checkin',
    title: '饮食打卡',
    note: '二级页面：隐藏底栏、顶栏带返回；拍照识别出草稿，确认后盖章',
    shell: 'app',
    render: () => <CheckinScreen />,
  },
  {
    id: 'login',
    route: '/login',
    title: '登录',
    note: '无导航；邮箱验证码，只接受白名单域名',
    shell: 'bare',
    render: () => <LoginScreen />,
  },
  {
    id: 'admin',
    route: '/admin',
    title: '后台',
    note: '桌面优先；额度监控 / 用户 / 兑换码 / 设置 / 两步验证绑定，全部渲染正式组件',
    shell: 'bare',
    render: () => <AdminScreen />,
  },
]

export const screenById = new Map(screens.map((s) => [s.id, s]))

/** 主导航路径 → 预览页面，点底栏 / 侧栏时切换用 */
export const screenByNav = new Map(
  screens.filter((s) => s.navPath !== undefined).map((s) => [s.navPath, s.id]),
)
