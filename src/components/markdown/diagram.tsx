'use client'

import { useEffect, useId, useState } from 'react'

/*
 * Mermaid 图示（懒加载）：代码块写完整后渲染成 SVG，出错降级显示源码。
 * securityLevel 用 strict（默认），配色从 token 映射到 themeVariables。
 */

let initialized = false

async function ensureMermaid() {
  const mermaid = (await import('mermaid')).default
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: {
        background: '#fffdf9',
        primaryColor: '#f3e2cf',
        primaryTextColor: '#4a3f35',
        primaryBorderColor: '#93603f',
        lineColor: '#7a6a5b',
        secondaryColor: '#e1f4ea',
        tertiaryColor: '#ece8fb',
        fontSize: '14px',
      },
    })
    initialized = true
  }
  return mermaid
}

export function MermaidDiagram({ code }: { code: string }) {
  const id = useId().replace(/:/g, '')
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const mermaid = await ensureMermaid()
        const { svg: out } = await mermaid.render(`mmd-${id}`, code)
        if (!cancelled) setSvg(out)
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, id])

  if (error) {
    return (
      <details className="bg-surface-sunken text-caption text-muted my-2 rounded-xl px-3 py-2">
        <summary>图示渲染失败，点开看源码</summary>
        <pre className="text-tiny mt-2 overflow-x-auto font-mono whitespace-pre">{code}</pre>
      </details>
    )
  }

  if (!svg) {
    return (
      <div className="bg-surface-sunken text-caption text-muted my-2 rounded-xl px-4 py-6 text-center">
        渲染图示中…
      </div>
    )
  }

  return (
    <div
      className="border-border bg-surface my-2 overflow-x-auto rounded-xl border p-3 [&>svg]:mx-auto [&>svg]:h-auto [&>svg]:max-w-full"
      // mermaid 输出的 SVG 已经过 DOMPurify（securityLevel strict），这里按可信 SVG 渲染
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
