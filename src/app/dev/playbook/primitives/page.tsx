import type { Metadata } from 'next'
import { PageHeader, Section } from '../_components/section'

export const metadata: Metadata = { title: '交互原语' }

// 占位页（F1）：P3 在这里演示 ui-primitives.md 第 1 节列出的 Base UI 封装
export default function PrimitivesPage() {
  return (
    <>
      <PageHeader
        title="交互原语"
        description="弹层、抽屉、菜单、表单字段、数字输入、验证码、Toast 等可交互部件。全部基于 Base UI 封装，页面只从 src/components/ui/ 引用。"
        docRef="ui-primitives.md 第 1 节"
      />
      <Section ann="playbook.primitives.pending" title="待补充">
        <p className="text-caption text-muted">P3 落地后在这里加演示。</p>
      </Section>
    </>
  )
}
