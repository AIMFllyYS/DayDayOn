import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { markdownComponents } from './elements'

/*
 * 含公式的 Markdown 渲染（懒加载）：文本里出现 $ / $$ 才加载，KaTeX 字体随制品打包（不走外部 CDN）。
 * 经 remark-math 解析 → rehype-katex 渲染，和普通 Markdown 共用同一套元素映射。
 */

export function MathMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={markdownComponents}
    >
      {text}
    </ReactMarkdown>
  )
}
