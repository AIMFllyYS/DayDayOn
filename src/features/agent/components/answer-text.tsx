import { Markdown } from '@/components/markdown'
import { cn } from '@/lib/cn'

/*
 * AI 回复正文：气泡容器 + Markdown 全量渲染（标题、列表、表格、KaTeX、Mermaid）。
 * 流式时末尾加闪烁光标；Markdown 组件内部用 remend 补全没写完的语法。
 */

export function AnswerText({
  text,
  streaming = false,
  className,
}: {
  text: string
  streaming?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-surface text-body shadow-soft w-fit max-w-full rounded-2xl rounded-tl-md px-4 py-3',
        className,
      )}
    >
      <Markdown text={text} streaming={streaming} />
      {streaming && (
        <span
          aria-hidden
          className="bg-primary animate-caret ml-0.5 inline-block h-4 w-1 translate-y-0.5 rounded-full"
        />
      )}
    </div>
  )
}
