import type { Metadata } from 'next'
import { PageHeader, Rules, Section } from '../../_components/section'
import {
  SleepDualThresholdRulesDemo,
  SleepModulePhoneSandbox,
  SleepRefereeComparisonMatrix,
} from './_components/sleep-module-demos'

export const metadata: Metadata = { title: '睡眠板块 · 早点睡' }

export default function SleepModulePlaybookPage() {
  return (
    <>
      <PageHeader
        title="早点睡 · 睡眠板块深度设计"
        description="拒绝「凌晨两点半睡、上午十点半起」用补觉时长混充早睡打卡：引入「入睡时刻红线（如 ≤ 23:30）+ 有效睡眠时长（6.5–9.5 小时）」双门槛科学裁判机制，搭配手环睡眠截图扫描与跨午夜时间区间控件。"
        docRef="ui-design-system.md · time-and-dates.md · ADR-0007"
      />

      <Section
        ann="playbook.modules.sleep.threshold"
        title="01 · 睡眠双门槛科学裁判规则（入睡红线 + 有效时长）"
        description="为什么「凌晨 2:30 睡、上午 10:30 起（睡满 8 小时）」不算有效「早点睡」打卡？人体褪黑素分泌高峰与慢波深睡修复窗口集中在前半夜，必须同时满足「入睡时刻不晚于设定红线」与「有效时长 6.5–9.5 小时」才计入早睡连击。"
      >
        <SleepDualThresholdRulesDemo />
      </Section>

      <Section
        ann="playbook.modules.sleep.verdict"
        title="02 · 睡眠裁判反馈卡对比（每行 2 卡 · 达标盖章 vs 熬夜补觉拦截）"
        description="对比场景 A（23:15 按时入睡 · 7h55m · 有效打卡盖章）与场景 B（02:15 凌晨入睡 · 8h15m · 熬夜补觉温柔拦截）：团团会清晰说明拦截原因，并将数据诚实归档至睡眠趋势图。"
      >
        <SleepRefereeComparisonMatrix />
      </Section>

      <Section
        ann="playbook.modules.sleep.sandbox"
        title="03 · 睡眠板块完整页面沙盒（手机外框实机展示 + 右侧场景切换器）"
        description="在左侧 360px 手机外框中展示完整的「早点睡」打卡二级页：顶部三态 Tab（手动填写 | 智能拍照 | 智能上传）+ 入睡红线目标条 + 手环截图扫描镜 + 跨午夜 TimeRangeField + 睡眠质量评分 + 实时 AI 节律裁判卡。"
      >
        <SleepModulePhoneSandbox />
      </Section>

      <Section ann="playbook.modules.sleep.rules" title="04 · 早点睡板块设计守则">
        <Rules
          dos={[
            '必须同时校验「入睡时刻 ≤ 设定红线（如 23:30）」与「有效睡眠时长 ∈ [6.5h, 9.5h]」双门槛，缺一不可',
            '遇到凌晨熬夜补觉（如 02:15 → 10:30）时，用团团温和提示“属于熬夜补觉，仅记录睡眠数据，不计入早点睡有效打卡”，主按钮切换为 soft 变体「仅保存睡眠记录」',
            '跨午夜起止时间统一使用原生 <TimeRangeField />（ADR-0007），起床早于入睡时自动标「次日」胶囊并实时计算时长',
            '睡眠监测截图与估算分析底部注明「估算结果，非医疗建议」',
          ]}
          donts={[
            '不要只按睡眠总时长（≥ 7 小时）就判定「早点睡」打卡成功，否则凌晨 3 点睡到中午 11 点也会拿到早睡印章',
            '不要在用户晚睡时报错阻止提交——允许用户诚实归档晚睡数据，在周趋势柱状图中以浅色未达标柱呈现',
            '不要在卡片内部使用深色夜空黑底，全站浅色模式下统一使用薰衣草浅底 bg-sleep-soft 与深字 text-sleep-ink',
          ]}
        />
      </Section>
    </>
  )
}
