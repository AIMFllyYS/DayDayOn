import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/cn'
import { CodeBlockPre, InlineCode } from './code'

/*
 * react-markdown 的自定义元素映射：把标准 Markdown 结构映射到设计系统 token（ui-design-system.md）。
 * 安全：只允许 http/https/mailto 链接；外部图片不加载，转成"图片：域名"链接（避免暴露用户 IP）。
 */

function safeHref(href: string | undefined): string | undefined {
  if (!href) return undefined
  try {
    const url = new URL(href, 'https://daydayon.local')
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:')
      return href
  } catch {
    return undefined
  }
  return undefined
}

function hostOf(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return '图片'
  }
}

function Link(props: ComponentPropsWithoutRef<'a'>) {
  const href = safeHref(typeof props.href === 'string' ? props.href : undefined)
  if (!href) return <span className="text-muted">{props.children}</span>
  return (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('text-primary-ink underline underline-offset-2', props.className)}
    />
  )
}

/** 外部图片转成链接（不加载，避免把用户 IP 暴露给第三方） */
function Image(props: ComponentPropsWithoutRef<'img'>) {
  const src = typeof props.src === 'string' ? props.src : ''
  const href = safeHref(src)
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-caption text-primary-ink bg-primary-soft inline-block rounded-lg px-2 py-1 underline underline-offset-2"
    >
      图片：{props.alt || hostOf(src)}
    </a>
  )
}

const headingBase = 'mt-4 mb-2 font-display font-semibold text-foreground first:mt-0'

export const markdownComponents = {
  h1: (p: ComponentPropsWithoutRef<'h1'>) => (
    <h1 {...p} className={cn(headingBase, 'text-title', p.className)} />
  ),
  h2: (p: ComponentPropsWithoutRef<'h2'>) => (
    <h2 {...p} className={cn(headingBase, 'text-heading', p.className)} />
  ),
  h3: (p: ComponentPropsWithoutRef<'h3'>) => (
    <h3 {...p} className={cn(headingBase, 'text-subhead', p.className)} />
  ),
  h4: (p: ComponentPropsWithoutRef<'h4'>) => (
    <h4 {...p} className={cn(headingBase, 'text-body', p.className)} />
  ),
  h5: (p: ComponentPropsWithoutRef<'h5'>) => (
    <h5 {...p} className={cn(headingBase, 'text-body', p.className)} />
  ),
  h6: (p: ComponentPropsWithoutRef<'h6'>) => (
    <h6 {...p} className={cn(headingBase, 'text-body', p.className)} />
  ),
  p: (p: ComponentPropsWithoutRef<'p'>) => (
    <p {...p} className={cn('text-body leading-relaxed', p.className)} />
  ),
  a: Link,
  img: Image,
  ul: (p: ComponentPropsWithoutRef<'ul'>) => (
    <ul {...p} className={cn('text-body my-2 list-disc space-y-1 pl-5', p.className)} />
  ),
  ol: (p: ComponentPropsWithoutRef<'ol'>) => (
    <ol {...p} className={cn('text-body my-2 list-decimal space-y-1 pl-5', p.className)} />
  ),
  li: (p: ComponentPropsWithoutRef<'li'>) => (
    <li {...p} className={cn('leading-relaxed', p.className)} />
  ),
  blockquote: (p: ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote
      {...p}
      className={cn('border-border-strong text-muted my-2 border-l-2 pl-3', p.className)}
    />
  ),
  hr: () => <hr className="border-border my-3" />,
  strong: (p: ComponentPropsWithoutRef<'strong'>) => (
    <strong {...p} className={cn('text-foreground font-semibold', p.className)} />
  ),
  em: (p: ComponentPropsWithoutRef<'em'>) => <em {...p} />,
  del: (p: ComponentPropsWithoutRef<'del'>) => (
    <del {...p} className={cn('text-muted line-through', p.className)} />
  ),
  table: (p: ComponentPropsWithoutRef<'table'>) => (
    <div className="my-2 overflow-x-auto">
      <table {...p} className={cn('text-body w-full border-collapse', p.className)} />
    </div>
  ),
  thead: (p: ComponentPropsWithoutRef<'thead'>) => <thead {...p} />,
  tbody: (p: ComponentPropsWithoutRef<'tbody'>) => <tbody {...p} />,
  tr: (p: ComponentPropsWithoutRef<'tr'>) => <tr {...p} />,
  th: (p: ComponentPropsWithoutRef<'th'>) => (
    <th
      {...p}
      className={cn(
        'border-border bg-surface-sunken border px-3 py-1.5 text-left font-semibold',
        p.className,
      )}
    />
  ),
  td: (p: ComponentPropsWithoutRef<'td'>) => (
    <td {...p} className={cn('border-border border px-3 py-1.5', p.className)} />
  ),
  pre: CodeBlockPre,
  code: InlineCode,
}
