'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useTheme } from '@/lib/theme'

/*
 * Mermaid 图示（懒加载）：代码块写完整后渲染成 SVG，出错降级显示源码。
 * securityLevel 用 strict（默认），每次渲染实时读取根元素 CSS 变量并监听主题变化，确保切换主题后色彩同步。
 */

function readCssVar(
  style: CSSStyleDeclaration,
  names: readonly string[],
  fallback: string,
): string {
  for (const name of names) {
    const value = style.getPropertyValue(name).trim()
    if (value) return value
  }
  return fallback
}

function getMermaidThemeVariables() {
  if (typeof window === 'undefined') {
    return {
      background: '#fffdf9',
      primaryColor: '#f3e2cf',
      primaryTextColor: '#4a3f35',
      primaryBorderColor: '#93603f',
      lineColor: '#7a6a5b',
      secondaryColor: '#e1f4ea',
      tertiaryColor: '#ece8fb',
      fontSize: '14px',
    }
  }

  const style = getComputedStyle(document.documentElement)
  const surface = readCssVar(style, ['--surface', '--color-surface'], '#fffdf9')
  const surfaceMuted = readCssVar(
    style,
    ['--surface-sunken', '--color-surface-sunken', '--color-surface-muted'],
    '#f8eee2',
  )
  const ink = readCssVar(style, ['--foreground', '--color-foreground', '--color-ink'], '#4a3f35')
  const primary = readCssVar(style, ['--primary', '--color-primary'], '#93603f')
  const primarySoft = readCssVar(style, ['--primary-soft', '--color-primary-soft'], '#f3e2cf')
  const muted = readCssVar(style, ['--muted', '--color-muted'], '#7a6a5b')
  const border = readCssVar(style, ['--border', '--color-border'], '#eadccb')
  const secondary = readCssVar(style, ['--exercise-soft', '--color-exercise-soft'], '#e1f4ea')
  const tertiary = readCssVar(style, ['--sleep-soft', '--color-sleep-soft'], '#ece8fb')

  return {
    background: surface,
    mainBkg: primarySoft,
    primaryColor: primarySoft,
    primaryTextColor: ink,
    primaryBorderColor: primary,
    lineColor: muted,
    secondaryColor: secondary,
    tertiaryColor: tertiary,
    clusterBkg: surfaceMuted,
    clusterBorder: border,
    textColor: ink,
    fontSize: '14px',
  }
}

export function MermaidDiagram({ code }: { code: string }) {
  const id = useId().replace(/:/g, '')
  const seqRef = useRef(0)
  const theme = useTheme()
  const [domThemeRevision, setDomThemeRevision] = useState(0)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(() => {
      setDomThemeRevision((n) => n + 1)
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    seqRef.current += 1
    const renderId = `mmd-${id}-${seqRef.current}`
    void (async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: getMermaidThemeVariables(),
        })
        const { svg: out } = await mermaid.render(renderId, code)
        if (!cancelled) {
          setError(false)
          setSvg(out)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, id, theme, domThemeRevision])

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
      className="border-border bg-surface my-2 w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border p-3 [&>svg]:mx-auto [&>svg]:h-auto [&>svg]:min-w-[280px] sm:[&>svg]:min-w-[320px]"
      // mermaid 输出的 SVG 已经过 DOMPurify（securityLevel strict），这里按可信 SVG 渲染
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
