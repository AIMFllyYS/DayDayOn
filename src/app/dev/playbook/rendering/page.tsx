import type { Metadata } from 'next'
import {
  MarkdownBasicDemo,
  MarkdownCodeDemo,
  MarkdownLinksDemo,
  MarkdownMathDemo,
  MarkdownStreamingDemo,
  MarkdownTableDemo,
  MermaidFlowDemo,
  MermaidMindDemo,
} from '../_components/markdown-demos'
import { PageHeader, Rules, Section } from '../_components/section'

export const metadata: Metadata = { title: 'AI 输出渲染' }

/*
 * AI 输出渲染（ADR-0025）：src/components/markdown/ 是低耦合的独立模块，
 * 任何界面都能用 <Markdown text streaming />，不在 Agent 里各写一套。
 */

const tokens = [
  { name: 'h1 / h2 / h3', rule: 'text-title / text-heading / text-subhead，font-display' },
  { name: '正文 p', rule: 'text-body，行高 1.6' },
  { name: '列表', rule: '圆点 / 数字，项间距 4px' },
  { name: '表格', rule: '横向可滚动，表头 bg-surface-sunken' },
  { name: '引用', rule: '左侧 2px border-strong 描边，文字用 muted' },
  { name: '代码块', rule: 'surface-sunken 底 + 语言标签 + 复制按钮，不高亮' },
  { name: '公式', rule: 'KaTeX，出现 $ 才加载' },
  { name: 'Mermaid', rule: '只有 mermaid 代码块才加载，失败降级显示源码' },
]

export default function RenderingPage() {
  return (
    <>
      <PageHeader
        title="AI 输出渲染"
        description="Markdown、KaTeX 公式、Mermaid 图示统一走一个模块：<Markdown text streaming />。普通回复零额外体积，公式和图按需加载。"
        docRef="ADR-0025、ui-design-system.md 第 8 节"
      />

      <Section
        ann="playbook.rendering.anatomy"
        title="元素映射"
        description="所有元素用设计系统 token，不写死色值和新字号。正文重点仍然是文字，格式只是辅助。"
      >
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {tokens.map((t) => (
            <li key={t.name} className="border-border bg-surface rounded-2xl border p-3">
              <p className="text-caption font-semibold">{t.name}</p>
              <p className="text-tiny text-muted mt-0.5">{t.rule}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        ann="playbook.rendering.markdown"
        title="Markdown"
        description="标题、列表、加粗、引用、链接。链接只允许 http / https / mailto，新标签页打开。"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div
            data-ann="playbook.rendering.markdown.basic"
            className="bg-surface shadow-soft rounded-2xl px-4 py-3"
          >
            <MarkdownBasicDemo />
          </div>
          <div
            data-ann="playbook.rendering.markdown.table"
            className="bg-surface shadow-soft rounded-2xl px-4 py-3"
          >
            <MarkdownTableDemo />
          </div>
        </div>
      </Section>

      <Section
        ann="playbook.rendering.math"
        title="公式（KaTeX）"
        description="文本里出现 $ 或 $$ 才懒加载 KaTeX（JS 约 270KB）。字体随制品打包，不走外部 CDN。"
      >
        <div
          data-ann="playbook.rendering.math.demo"
          className="bg-surface shadow-soft max-w-2xl rounded-2xl px-4 py-3"
        >
          <MarkdownMathDemo />
        </div>
      </Section>

      <Section
        ann="playbook.rendering.mermaid"
        title="图示（Mermaid）"
        description="只有 mermaid 代码块才懒加载 Mermaid（浏览器端约 1–2MB）。代码块闭合后才渲染，渲染前显示骨架，失败降级为源码。"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div
            data-ann="playbook.rendering.mermaid.flow"
            className="bg-surface shadow-soft rounded-2xl px-4 py-3"
          >
            <MermaidFlowDemo />
          </div>
          <div
            data-ann="playbook.rendering.mermaid.mind"
            className="bg-surface shadow-soft rounded-2xl px-4 py-3"
          >
            <MermaidMindDemo />
          </div>
        </div>
      </Section>

      <Section
        ann="playbook.rendering.code"
        title="代码块"
        description="不做语法高亮（打卡场景代码少），保留等宽字体、语言标签和复制按钮。"
      >
        <div
          data-ann="playbook.rendering.code.demo"
          className="bg-surface shadow-soft max-w-2xl rounded-2xl px-4 py-3"
        >
          <MarkdownCodeDemo />
        </div>
      </Section>

      <Section
        ann="playbook.rendering.safety"
        title="安全与隐私"
        description="不渲染原始 HTML；外部图片不加载（避免把用户 IP 暴露给第三方），显示成「图片：域名」链接。"
      >
        <div
          data-ann="playbook.rendering.safety.demo"
          className="bg-surface shadow-soft max-w-2xl rounded-2xl px-4 py-3"
        >
          <MarkdownLinksDemo />
        </div>
      </Section>

      <Section
        ann="playbook.rendering.streaming"
        title="流式"
        description="模型逐字吐出时，未闭合的 **、代码块、公式由 remend 补全，避免渲染跳动；末尾有闪烁光标。"
      >
        <div
          data-ann="playbook.rendering.streaming.demo"
          className="bg-paper border-border flex justify-center rounded-2xl border p-6"
        >
          <MarkdownStreamingDemo />
        </div>
      </Section>

      <Section ann="playbook.rendering.rules" title="规则">
        <Rules
          dos={[
            '所有 AI 输出都走 <Markdown>，不要各写一套解析',
            '对比用表格、计算用公式、计划用 mindmap、流程用 flowchart、安排用 timeline',
            '简单问题不画图，格式服务于内容',
            '链接、图片都走白名单与降级',
          ]}
          donts={[
            '不要用 innerHTML 渲染模型输出',
            '不要加载外部图片',
            '不要在 Markdown 里写死色值或非语义字号',
            '不要为了展示图示而使用 Mermaid',
          ]}
        />
      </Section>
    </>
  )
}
