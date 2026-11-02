import type { Metadata } from 'next'
import { TopBar } from '@/components/layout/top-bar'
import { IconButton } from '@/components/ui/button'
import { DesktopShellDemo, MobileShellDemo } from '../_components/nav-demos'
import { PageHeader, Rules, Section } from '../_components/section'

export const metadata: Metadata = { title: '导航与布局' }

const breakpoints = [
  { range: '< 768px', nav: '底部悬浮导航（5 格，中间"＋"）', add: '底部弹层' },
  { range: '768–1023px', nav: '左侧窄栏，只显示图标', add: '侧栏顶部"＋"，居中对话框' },
  { range: '≥ 1024px', nav: '左侧宽栏，图标 + 文字 + 额度', add: '侧栏顶部"打卡"按钮，居中对话框' },
] as const

export default function NavigationPage() {
  return (
    <>
      <PageHeader
        title="导航与布局"
        description="应用外壳由 src/components/layout/ 下的组件组成。导航项定义在 nav-items.ts，手机和桌面共用。"
        docRef="ui-design-system.md 第 7 节 · routing.md"
      />

      <Section ann="playbook.navigation.breakpoints" title="断点">
        <div className="border-border bg-surface overflow-x-auto rounded-2xl border">
          <table className="text-caption w-full min-w-[520px] text-left">
            <thead className="bg-surface-sunken text-tiny text-muted">
              <tr>
                <th className="px-4 py-2 font-semibold">视口宽度</th>
                <th className="px-4 py-2 font-semibold">主导航</th>
                <th className="px-4 py-2 font-semibold">打卡入口</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {breakpoints.map((b) => (
                <tr key={b.range}>
                  <td className="text-tiny px-4 py-2.5 font-mono">{b.range}</td>
                  <td className="px-4 py-2.5">{b.nav}</td>
                  <td className="px-4 py-2.5">{b.add}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        ann="playbook.navigation.mobile"
        title="手机：底部导航"
        description="点导航项，圆形高亮块以果冻弹性缓动（spring）滑至选中项，包裹图标与文字；点“＋”打开打卡弹层（＋会旋转成 ×）。真实页面里底栏 fixed 在底部，并加上安全区。"
      >
        <MobileShellDemo />
      </Section>

      <Section
        ann="playbook.navigation.desktop"
        title="桌面：侧栏"
        description="auto 模式下 768–1023px 是窄栏、≥1024px 是宽栏。下面强制展示两种形态。"
      >
        <div className="grid gap-6">
          <DesktopShellDemo mode="expanded" label="≥ 1024px · 宽栏" />
          <DesktopShellDemo mode="compact" label="768–1023px · 窄栏" />
        </div>
      </Section>

      <Section ann="playbook.navigation.topbar" title="顶栏">
        <div className="bg-paper border-border grid gap-3 rounded-2xl border p-2">
          <TopBar
            sticky={false}
            eyebrow="10 月 31 日 · 周六"
            title="主页"
            actions={<IconButton icon="bell" label="提醒" />}
          />
          <TopBar
            sticky={false}
            leading={<IconButton icon="chevron-left" label="返回" />}
            title="饮食打卡"
            actions={<IconButton icon="sliders" label="设置" />}
          />
        </div>
      </Section>

      <Section ann="playbook.navigation.rules" title="规则">
        <Rules
          dos={[
            '一级页面（主页 / 待办 / 排行 / 我的）显示主导航；二级页面隐藏底栏，顶栏带返回',
            '导航文字和页面标题一致',
            '当前项用 aria-current="page"',
            '底栏和"＋"之外的悬浮按钮不放在右下角，避免和底栏冲突',
          ]}
          donts={['不要在底栏放第 5 个页面入口', '不要在弹层里再打开弹层']}
        />
      </Section>
    </>
  )
}
