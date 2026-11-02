'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remend from 'remend'
import { markdownComponents } from './elements'

/*
 * Agent / AI 输出的 Markdown 渲染（低耦合、模块清晰，任何界面都可复用）。
 * 三级懒加载：
 *   1. 普通 Markdown（react-markdown + remark-gfm）常驻；
 *   2. 文本含 $ / $$ 时才加载 KaTeX（./math）；
 *   3. 代码块是 mermaid 时才加载 Mermaid（./diagram）。
 * 流式时用 remend 补全没写完的 **、代码块、公式，避免渲染跳动。
 */

const MathMarkdown = dynamic(() => import('./math').then((m) => m.MathMarkdown), {
  ssr: false,
  loading: () => <RenderPlain text="" />,
})

function hasMath(text: string): boolean {
  return /\$\$|\$[^$\n]+[^$]\$/.test(text)
}

function RenderPlain({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {text}
    </ReactMarkdown>
  )
}

export function Markdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const healed = useMemo(
    () => (streaming ? remend(text, { inlineKatex: true }) : text),
    [text, streaming],
  )
  if (hasMath(healed)) return <MathMarkdown text={healed} />
  return <RenderPlain text={healed} />
}
