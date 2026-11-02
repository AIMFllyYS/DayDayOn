'use client'

import { useState } from 'react'
import { Markdown } from '@/components/markdown'
import { cn } from '@/lib/cn'

/*
 * Playbook 演示：AI 输出的 Markdown / KaTeX / Mermaid 渲染。
 * 直接用正式组件 <Markdown text streaming />，流式示例模拟模型逐字吐出的样子。
 */

const BASIC = `## 今天的状态

这周你已经连续打卡 **5 天**，比上周多 2 天。

- 运动：跑步 3 次，共 9.2 公里
- 饮食：有 2 天没记午餐
- 睡眠：平均 6.4 小时，比上周少了 0.8 小时

> 小建议：先把睡眠补到 7 小时，其他目标会轻松很多。

[查看完整记录](/dev/playbook/agent)`

const TABLE = `| 项目 | 本周 | 上周 | 变化 |
|---|---|---|---|
| 运动时长 | 185 分钟 | 140 分钟 | +45 |
| 打卡天数 | 5 天 | 3 天 | +2 |
| 平均睡眠 | 6.4 小时 | 7.2 小时 | -0.8 |`

const MATH = `一碗米饭（150 克）的热量大约这样算：

$$E = m \\times k = 150 \\times 1.16 \\approx 174\\ \\text{kcal}$$

运动消耗用 MET 估算：$\\text{kcal} = \\text{MET} \\times 3.5 \\times \\text{体重(kg)} \\div 200 \\times \\text{分钟}$`

const CODE = `记完打卡后可以在浏览器控制台确认一下：

\`\`\`ts
const today = await fetch('/api/v1/checkins/today').then((r) => r.json())
console.log(today.completion)
\`\`\`

行内代码像这样：\`daydayon:agent-pet:v1\`。`

const MERMAID_FLOW = `\`\`\`mermaid
flowchart TD
  A[说出今天做了什么] --> B[读取目标]
  B --> C[联网查热量与消耗]
  C --> D[生成打卡草稿]
  D --> E{用户确认}
  E -->|确认| F[写入打卡]
  E -->|改一改| D
\`\`\``

const MERMAID_MIND = `\`\`\`mermaid
mindmap
  root((本周计划))
    运动
      跑步 3 次
      拉伸 每天
    饮食
      午餐记全
      少喝奶茶
    睡眠
      23:30 前睡
\`\`\``

const LINKS = `外部图片不会加载，只显示成链接：[图片：example.com](https://example.com/photo.jpg)

![示例图片](https://example.com/photo.jpg)

普通链接在新标签页打开：https://api-docs.deepseek.com`

export function MarkdownBasicDemo() {
  return <Markdown text={BASIC} />
}

export function MarkdownTableDemo() {
  return <Markdown text={TABLE} />
}

export function MarkdownMathDemo() {
  return <Markdown text={MATH} />
}

export function MarkdownCodeDemo() {
  return <Markdown text={CODE} />
}

export function MermaidFlowDemo() {
  return <Markdown text={MERMAID_FLOW} />
}

export function MermaidMindDemo() {
  return <Markdown text={MERMAID_MIND} />
}

export function MarkdownLinksDemo() {
  return <Markdown text={LINKS} />
}

const STREAM_SAMPLE = `今天跑得不错～
**配速** 大约 6 分 10 秒每公里，比上次快了 20 秒。

$\\text{消耗} \\approx 245\\ \\text{kcal}$

要记成一条打卡吗`

/** 流式：逐字出现，未闭合的 ** 由 remend 补全，末尾有光标 */
export function MarkdownStreamingDemo() {
  const [count, setCount] = useState(0)
  const text = STREAM_SAMPLE.slice(0, count)
  const done = count >= STREAM_SAMPLE.length

  return (
    <div className="w-full max-w-md">
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCount(0)}
          className="text-tiny border-border rounded-full border px-2.5 py-1 font-semibold"
        >
          重播
        </button>
        <button
          type="button"
          onClick={() => setCount((c) => Math.min(STREAM_SAMPLE.length, c + 6))}
          className="text-tiny border-border rounded-full border px-2.5 py-1"
        >
          下一帧
        </button>
        <span className={cn('text-tiny font-mono', done ? 'text-success-ink' : 'text-muted')}>
          {count} / {STREAM_SAMPLE.length}
        </span>
      </div>
      <div className="bg-surface shadow-soft text-body rounded-2xl rounded-tl-md px-4 py-3">
        <Markdown text={text} streaming={!done} />
      </div>
    </div>
  )
}
