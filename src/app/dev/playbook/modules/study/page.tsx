import type { Metadata } from 'next'
import { PageHeader, Rules, Section } from '../../_components/section'
import {
  StudyDualMechanismDemo,
  StudyModulePhoneSandbox,
  StudyRefereeComparisonMatrix,
} from './_components/study-module-demos'

export const metadata: Metadata = { title: '学习板块 · 学一点' }

export default function StudyModulePlaybookPage() {
  return (
    <>
      <PageHeader
        title="学一点 · 学习板块深度设计"
        description="拒绝「看了 3 分钟书糊弄打卡」：引入「单次最低专注时长（如 ≥ 25 分钟番茄钟）+ 实质学习内容语义核验」双机制，支持上传 HTML / TXT / Markdown 笔记或错题本截图自動提纯核心知识点摘要。"
        docRef="ui-design-system.md · ai-and-quota.md · ADR-0002"
      />

      <Section
        ann="playbook.modules.study.mechanism"
        title="01 · 专注时长与实质内容核验双机制（番茄钟底线 + 笔记正文提纯）"
        description="支持设置单次最低专注时长（默认 ≥ 25 分钟标准番茄钟）并配合笔记/题库附件智能解析：前端先过滤 HTML 标签噪声，再由 Agent 提炼核心知识点摘要并核验是否与学习目标匹配。"
      >
        <StudyDualMechanismDemo />
      </Section>

      <Section
        ann="playbook.modules.study.verdict"
        title="02 · 学习裁判反馈卡对比（每行 2 卡 · 有效打卡 vs 低时长敷衍拦截）"
        description="对比场景 A（上传二叉树笔记 HTML · 专注 45 分钟 · 有效打卡盖章）与场景 B（仅填「背单词」且时长 5 分钟 · 门槛拦截）：团团会鼓励用户继续专注凑满一个番茄钟或补充具体收获要点。"
      >
        <StudyRefereeComparisonMatrix />
      </Section>

      <Section
        ann="playbook.modules.study.sandbox"
        title="03 · 学习板块完整页面沙盒（手机外框实机展示 + 右侧场景切换器）"
        description="在左侧 360px 手机外框中展示完整的「学一点」打卡页：顶部三态 Tab（手动填写 | 智能拍照 | 智能上传）+ 番茄钟门槛进度条 + HTML/错题截图扫描镜 + 单列学习表单 + 实时 AI 学习裁判卡。"
      >
        <StudyModulePhoneSandbox />
      </Section>

      <Section ann="playbook.modules.study.rules" title="04 · 学一点板块设计守则">
        <Rules
          dos={[
            '必须同时核验「专注时长 ≥ 设定番茄钟门槛（默认 25 分钟）」与「要点摘录含实质知识收获」，防止 3 分钟翻书糊弄连击',
            '支持智能上传 HTML / TXT / Markdown 笔记：客户端先剥离 <script>、<style> 与冗余标签，仅把纯净正文发给 deepseek-flash 提炼摘要',
            '未满最低专注门槛时，提供「暂存碎片学习记录」soft 按钮，允许同日多次碎片学习累加达标后再盖章',
            '表单内部控件（学了什么 Input、专注时长 NumberField、要点摘录 Textarea）严格采用单列垂直排布，零横向挤压',
          ]}
          donts={[
            '不要允许仅填“看书”“背单词”且时长 2–5 分钟的记录直接盖下有效打卡印章',
            '不要把未去噪的原始长篇 HTML 源码直接渲染在扫描镜里，应展示提纯后的知识点摘要',
            '不要在页面上暴露 token 消耗数字或模型内部 prompt，保持手账朋友的温和反馈语气',
          ]}
        />
      </Section>
    </>
  )
}
