import type { Metadata } from 'next'
import { PageHeader, Section } from '../_components/section'

export const metadata: Metadata = { title: '数据与时间' }

// 占位页（F1）：P4 在这里演示日历、日期 / 时间输入、图表、空状态与错误态、图片选择、预设头像
export default function DataPage() {
  return (
    <>
      <PageHeader
        title="数据与时间"
        description="日历、日期与时间输入、睡眠区间、图表、空状态、错误态、图片选择与预设头像。"
        docRef="ui-design-system.md"
      />
      <Section ann="playbook.data.pending" title="待补充">
        <p className="text-caption text-muted">P4 落地后在这里加演示。</p>
      </Section>
    </>
  )
}
