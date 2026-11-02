'use client'

import dynamic from 'next/dynamic'
import { useState, type ComponentPropsWithoutRef, type ReactElement } from 'react'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/*
 * 代码块：等宽字体 + 凹陷底色 + 语言标签 + 复制按钮（不做语法高亮，见 ADR-0025）。
 * react-markdown v10 的 <code> 不再区分行内 / 块级，块级统一在 <pre> 上处理：
 *   pre → CodeBlockPre（语言、mermaid 切换、复制按钮）；code → InlineCode（行内样式）。
 */

const MermaidDiagram = dynamic(() => import('./diagram').then((m) => m.MermaidDiagram), {
  ssr: false,
  loading: () => (
    <div className="bg-surface-sunken text-caption text-muted my-2 flex items-center gap-2 rounded-xl px-4 py-6">
      <span className="bg-primary-soft animate-breathe h-2 w-2 rounded-full" />
      正在渲染图示…
    </div>
  ),
})

/** React 子节点 → 纯文本（代码块的内容都是字符串） */
export function plainText(node: unknown): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(plainText).join('')
  if (typeof node === 'object' && 'props' in (node as Record<string, unknown>)) {
    return plainText((node as { props: { children?: unknown } }).props.children)
  }
  return ''
}

/** 行内代码；块级代码由 CodeBlockPre 接管，不会走到这里 */
export function InlineCode(props: ComponentPropsWithoutRef<'code'>) {
  return (
    <code
      {...props}
      className="bg-surface-sunken text-foreground rounded-md px-1.5 py-0.5 font-mono text-[0.9em]"
    />
  )
}

export function CodeBlockPre(props: ComponentPropsWithoutRef<'pre'>) {
  const child = props.children as
    ReactElement<{ className?: string; children?: unknown }> | undefined
  const language = /language-(\w+)/.exec(child?.props?.className ?? '')?.[1] ?? ''
  const code = plainText(child?.props?.children)
  if (language === 'mermaid') return <MermaidDiagram code={code} />
  return <CodeBlockBox language={language} code={code} />
}

function CodeBlockBox({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 剪贴板不可用（如非安全上下文）时静默失败
    }
  }

  return (
    <div className="border-border bg-surface-sunken my-2 overflow-hidden rounded-xl border">
      <div className="border-border flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-tiny text-muted font-mono">{language || 'code'}</span>
        <button
          type="button"
          onClick={copy}
          className={cn(
            'text-tiny text-muted hover:text-foreground flex items-center gap-1 transition-colors',
          )}
        >
          <Icon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" />
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2">
        <code className="text-body text-foreground font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  )
}
