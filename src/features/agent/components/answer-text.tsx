import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * 只支持两种格式：空行分段、**加粗**。AI 输出按纯文本渲染成 React 节点，不使用 innerHTML。
 * 以后需要列表、表格时再换成 Markdown 渲染器（并做 XSS 过滤）。
 */
function renderInline(line: string): ReactNode[] {
  return line.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
    seg.startsWith('**') && seg.endsWith('**') && seg.length > 4 ? (
      <strong key={i} className="font-display text-foreground font-semibold">
        {seg.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{seg}</Fragment>
    ),
  )
}

export function AnswerText({
  text,
  streaming = false,
  className,
}: {
  text: string
  streaming?: boolean
  className?: string
}) {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0)
  return (
    <div
      className={cn(
        'bg-surface text-body shadow-soft w-fit max-w-full rounded-2xl rounded-tl-md px-4 py-3',
        className,
      )}
    >
      {paragraphs.map((p, i) => (
        <p key={i} className={cn(i > 0 && 'mt-2')}>
          {p.split('\n').map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {renderInline(line)}
            </Fragment>
          ))}
          {streaming && i === paragraphs.length - 1 && (
            <span
              aria-hidden
              className="animate-caret bg-primary ml-0.5 inline-block h-4 w-1 translate-y-0.5 rounded-full"
            />
          )}
        </p>
      ))}
    </div>
  )
}
