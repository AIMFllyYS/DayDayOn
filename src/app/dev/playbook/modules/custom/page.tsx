import type { Metadata } from 'next'
import { PageHeader, Rules, Section } from '../../_components/section'
import {
  CustomGoalRuleDesignerDemo,
  CustomModulePhoneSandbox,
  CustomRefereeComparisonMatrix,
} from './_components/custom-module-demos'

export const metadata: Metadata = { title: '自定义板块 · 我的小目标' }

export default function CustomModulePlaybookPage() {
  return (
    <>
      <PageHeader
        title="我的小目标 · 自定义板块深度设计"
        description="支持用户创建带独立期限的个性化目标（如「戒糖饮水 21 天挑战」「考研英语每日精读 2 篇」「每日硬笔练字 1 页」），自由组装 7 类动态字段，并由用户自己设定 AI 裁判的有效打卡检验条件。"
        docRef="ui-design-system.md · client-data-and-forms.md · ADR-0003"
      />

      <Section
        ann="playbook.modules.custom.designer"
        title="01 · 多目标自定义期限与个性化检验规则设计器"
        description="展示用户如何完全自定义一个目标：设定起止日期与冲刺天数、勾选所需的动态字段（数字、文本、单选、多选、布尔、时长、评分），并设定达到什么条件才算有效打卡（如「每日饮水 ≥ 6 杯 且 含糖饮料 = 0 杯」）。"
      >
        <CustomGoalRuleDesignerDemo />
      </Section>

      <Section
        ann="playbook.modules.custom.verdict"
        title="02 · 自定义目标 AI 裁判对比（每行 2 卡 · 满足自定义规则 vs 未达阈值拦截）"
        description="对比「满足全部自定义检验规则 · 有效打卡盖章」与「违反某项一票否决红线（如偷喝 1 杯三分糖奶茶）· 诚实存档不盖章」的双轨制反馈。"
      >
        <CustomRefereeComparisonMatrix />
      </Section>

      <Section
        ann="playbook.modules.custom.sandbox"
        title="03 · 自定义板块完整页面沙盒（手机外框实机展示 + 右侧多目标切换控制台）"
        description="在左侧 360px 手机外框中展示完整的「我的小目标」打卡页：顶部目标期限进度条 + 三态输入 Tab + 智能扫描镜 + 动态单列表单渲染 + 个性化规则 AI 裁判卡。可通过右侧控制台一键切换 3 个不同目标。"
      >
        <CustomModulePhoneSandbox />
      </Section>

      <Section ann="playbook.modules.custom.rules" title="04 · 我的小目标板块设计守则">
        <Rules
          dos={[
            '每个自定义目标支持独立配置开始日期与截止日期（冲刺天数），并在打卡页顶栏下方展示剩余天数与周期进度条',
            '支持数字、时长、布尔、单选、多选、评分、文本 7 类动态字段，所有动态字段在表单内一律采用单列垂直流排布',
            '允许用户为自定义目标配置多条件组合检验规则（如「饮水 ≥ 6 杯 且 含糖饮料 = 0 杯」），由 AI 裁判在打卡时逐项打勾核验',
            '当用户诚实记录了“破戒”或未达自定义阈值的数据时，温柔归档当日记录但不盖有效章，鼓励次日继续坚持',
          ]}
          donts={[
            '不要把多个自定义目标混用同一个固定表单，应根据当前目标定义的动态字段列表按需渲染控件',
            '不要将两个 NumberField 或复杂控件并排塞在同一行内，避免在 360px 手机视口下发生横向挤压',
            '不要在卡片里使用深色实底或写死 hex 色值，统一使用樱花粉板块语义色 bg-custom-soft 与 text-custom-ink',
          ]}
        />
      </Section>
    </>
  )
}
