import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardToday } from '@/features/dashboard/schemas'
import type { Insights } from '@/features/insights/schemas'
import { ApiProvider } from '@/lib/api'

const mockRequireOnboardedUser = vi.fn()
const mockGetDashboardToday = vi.fn()
const mockGetInsights = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/server/auth', () => ({
  requireOnboardedUser: () => mockRequireOnboardedUser(),
}))

vi.mock('@/server/db/client', () => ({
  db: {},
}))

vi.mock('@/server/services/dashboard', () => ({
  getDashboardToday: (...args: unknown[]) => mockGetDashboardToday(...args),
}))

vi.mock('@/server/services/insights', () => ({
  getInsights: (...args: unknown[]) => mockGetInsights(...args),
}))

vi.mock('@/components/layout/app-page', () => ({
  AppPage: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="app-page" data-title={title}>
      {children}
    </div>
  ),
}))

vi.mock('@/features/dashboard/components/home-dashboard', () => ({
  HomeDashboard: ({ timeZone, insights }: { timeZone: string; insights?: Insights }) => (
    <div
      data-testid="home-dashboard"
      data-tz={timeZone}
      data-insights={insights?.items.length ?? 0}
    />
  ),
}))

import Page from './page'

describe('主页 (app)/page.tsx 首屏服务端预取与防二次骨架', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireOnboardedUser.mockResolvedValue({ id: 'user-1' })
  })

  it('服务端预取成功后通过 HydrationBoundary 脱水，HomeView 首帧直接渲染 HomeDashboard 而不显示 HomeSkeleton', async () => {
    const fakeDashboard = {
      timeZone: 'Asia/Shanghai',
      steps: { todaySteps: 0 },
    } as unknown as DashboardToday
    const fakeInsights = {
      localDate: '2026-11-16',
      days: 7,
      items: [{ goalId: 'g1' }],
    } as unknown as Insights

    mockGetDashboardToday.mockResolvedValue(fakeDashboard)
    mockGetInsights.mockResolvedValue(fakeInsights)

    const element = await Page()
    const html = renderToStaticMarkup(<ApiProvider>{element}</ApiProvider>)

    expect(mockRequireOnboardedUser).toHaveBeenCalledTimes(1)
    expect(mockGetDashboardToday).toHaveBeenCalledTimes(1)
    expect(mockGetInsights).toHaveBeenCalledTimes(1)
    expect(html).toContain('data-testid="app-page"')
    expect(html).toContain('data-testid="home-dashboard"')
    expect(html).toContain('data-tz="Asia/Shanghai"')
    expect(html).toContain('data-insights="1"')
    expect(html).not.toContain('aria-label="加载中"')
  })

  it('服务端预取失败时不阻断页面渲染，安全降级回客户端加载', async () => {
    mockGetDashboardToday.mockRejectedValue(new Error('db timeout'))
    mockGetInsights.mockRejectedValue(new Error('db timeout'))

    const element = await Page()
    const html = renderToStaticMarkup(<ApiProvider>{element}</ApiProvider>)

    expect(html).toContain('data-testid="app-page"')
    expect(html).not.toContain('data-testid="home-dashboard"')
    expect(html).toContain('aria-label="加载中"')
  })
})
