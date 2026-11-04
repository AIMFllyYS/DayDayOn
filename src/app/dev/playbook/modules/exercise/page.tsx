import type { Metadata } from 'next'
import { PageHeader, Rules, Section } from '../../_components/section'
import {
  ExerciseFullPageSandbox,
  ExerciseThresholdMatrix,
  ExerciseVerdictComparisonMatrix,
} from './_components/exercise-demos'

export const metadata: Metadata = { title: '运动板块 · 动一动' }

export default function ExerciseModulePlaybookPage() {
  return (
    <>
      <PageHeader
        title="动一动 · 运动板块深度设计"
        description="按运动品类的代谢当量（MET）与运动生理特征建立分级有效阈值：快走必须「≥ 20–30 分钟 且 ≥ 2.0–3.0 公里」双达标以拒绝散步糊弄打卡；跑步高 MET 满 10–15 分钟或 2 公里即认定有效；力量与蹲起切换为抗阻时长或组数容量核验。"
        docRef="ui-design-system.md · ai-and-quota.md · ADR-0002"
      />

      <Section
        ann="playbook.modules.exercise.threshold-matrix"
        title="01 · 运动品类分级有效阈值矩阵（ExerciseThresholdMatrix & GoalVerificationRuleCard）"
        description="每行 2 张卡片（md:grid-cols-2）展示快走/健步走、跑步、力量训练/蹲起、球类/骑行/游泳/跳绳 4 大品类的 Agent 自动判决基线，并支持用户根据个人目标周期微调覆盖。"
      >
        <ExerciseThresholdMatrix />
      </Section>

      <Section
        ann="playbook.modules.exercise.verdict-comparison"
        title="02 · 运动有效性判决反馈卡对比（ExerciseVerdictCard · 每行 2 卡）"
        description="对比展示达标有效运动（场景 A 户外跑步 25 分钟 4.2 公里、场景 C 深蹲 5 组×15 次）与被拦截的伪运动（场景 B 饭后慢走 10 分钟 0.6 公里、场景 D 骑共享单车通勤 7 分钟 1.2 公里）。未达标时团团温柔拦截并降级为「日常活动备忘」。"
      >
        <ExerciseVerdictComparisonMatrix />
      </Section>

      <Section
        ann="playbook.modules.exercise.full-page-sandbox"
        title="03 · 运动板块完整页面沙盒（PhoneFrame 手机框 + 右侧实时阈值控制台）"
        description="在左侧 360px 手机外框内完整呈现「动一动」打卡页：顶部统一三态 Tab（手动填写 | 智能拍照 | 智能上传）+ 目标检验规则提示条 + 极简扫描镜 + 单列运动表单（品类、时长、里程/组数、强度）+ Agent 有效性实时判决卡 + 底部动态主按钮。"
      >
        <ExerciseFullPageSandbox />
      </Section>

      <Section ann="playbook.modules.exercise.guidelines" title="运动板块设计守则">
        <Rules
          dos={[
            '按运动品类分级核验有效阈值：快走必须「时长 ≥ 20–30 分钟 且 距离 ≥ 2.0–3.0 公里」双达标，跑步「时长 ≥ 10–15 分钟 或 距离 ≥ 2.0 公里」即达标',
            '无氧抗阻训练（力量、核心、蹲起）不看公里数，自动切换为「有效时长 ≥ 15 分钟 或 动作容量（如 4 组×15 次）」核验模型',
            '当运动量低于有效阈值（如慢走 10 分钟 0.6 公里）时，温柔拦截有效打卡，提示「仅可记为日常活动备忘，不计入有效打卡」',
            '在 360px 手机外框内保持表单全单列垂直排布（NumberField 独占一行），确保 0 横向/纵向溢出',
          ]}
          donts={[
            '不要对所有运动一刀切使用同一个分钟数门槛（不能拿快走的 30 分钟门槛去卡高强度的跑步或跳绳）',
            '不要允许下楼取快递散步 10 分钟或骑共享单车通勤 1 公里混入「动一动」有效打卡连击',
            '不要在窄屏卡片中将两个带步进按钮的 NumberField 并排放置导致横向挤压溢出',
            '不要使用深色实底块或非语义字号（text-sm / text-xs / text-lg）',
          ]}
        />
      </Section>
    </>
  )
}
