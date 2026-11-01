import type { Metadata } from 'next'
import { PageHeader, Rules, Section } from '../_components/section'
import { ScreenPreview } from './_screens/screen-preview'

export const metadata: Metadata = { title: '页面预览' }

/*
 * 页面预览：用 Playbook 里的组件拼出每个真实页面（路由见 routing.md 第 2 节），
 * 检查组件放在一起是否协调，也是正式页面的对标样式。只用假数据，不接后端。
 */
export default function PagesPreviewPage() {
  return (
    <>
      <PageHeader
        title="页面预览"
        description="用现有组件拼出的真实页面，手机和桌面两种形态并排。正式页面上线时要和这里长得一样；改样式先改这里，再改正式页面。"
        docRef="ui-design-system.md 第 13 节 · routing.md 第 2 节"
      />

      <Section
        ann="playbook.pages.preview"
        title="全部页面"
        description="点缩略图切换页面。预览里的底栏、侧栏、“＋”都能点：切换一级页面、打开打卡弹层。左侧切换主题色，所有页面一起变。"
      >
        <ScreenPreview />
      </Section>

      <Section ann="playbook.pages.rules" title="规则">
        <Rules
          dos={[
            '页面只组合 Playbook 里登记过的组件；预览里出现的新样式先下沉成组件',
            '每个页面同时检查手机 360 和桌面 ≥1000 两种形态',
            '一级页面带主导航；二级页面隐藏底栏、顶栏带返回',
            '新增路由时在 _screens/registry.tsx 登记一页预览',
          ]}
          donts={[
            '不要在预览里写只此一处的样式，那会让正式页面没有对照',
            '不要在一屏里放两只互动吉祥物（缩略图墙用静态版）',
          ]}
        />
      </Section>
    </>
  )
}
