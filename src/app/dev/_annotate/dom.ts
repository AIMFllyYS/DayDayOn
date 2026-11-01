import type { Annotation, AnnotationTarget, Rect } from './types'

/** 批注工具自身的界面都带这个属性，拾取时忽略 */
export const ANNOTATOR_UI_ATTR = 'data-annotator-ui'

export function isAnnotatorUi(el: Element): boolean {
  return el.closest(`[${ANNOTATOR_UI_ATTR}]`) !== null
}

/** data-ann 属性选择器。值在引号内，只需转义反斜杠和双引号，导出的 JSON 更好读 */
function annSelector(value: string): string {
  return `[data-ann="${value.replace(/["\\]/g, '\\$&')}"]`
}

/** 拾取目标：优先吸附到最近的 data-ann 区块，让批注落在"组件"上而不是某个 span 上 */
export function pickTarget(el: Element): Element {
  return el.closest('[data-ann]') ?? el
}

export function pageRect(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return {
    x: Math.round(r.left + window.scrollX),
    y: Math.round(r.top + window.scrollY),
    width: Math.round(r.width),
    height: Math.round(r.height),
  }
}

/** 从最近的 data-ann 祖先（不含自身）或 body 开始，用 tag:nth-of-type 拼出路径 */
function cssPath(el: Element): string {
  const parts: string[] = []
  let node: Element | null = el
  while (node && node !== document.body) {
    const parent: Element | null = node.parentElement
    if (node !== el && node.hasAttribute('data-ann')) {
      parts.unshift(annSelector(node.getAttribute('data-ann') ?? ''))
      return parts.join(' > ')
    }
    const tag = node.tagName.toLowerCase()
    if (!parent) {
      parts.unshift(tag)
      break
    }
    const current: Element = node
    const sameTag = Array.from(parent.children).filter((c) => c.tagName === current.tagName)
    parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(current) + 1})` : tag)
    node = parent
  }
  return ['body', ...parts].join(' > ')
}

export function describeElement(el: Element): AnnotationTarget {
  return {
    annId: el.getAttribute('data-ann'),
    selector: cssPath(el),
    tag: el.tagName.toLowerCase(),
    text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
    rect: pageRect(el),
  }
}

/** 找回批注对应的元素；页面结构变了可能找不到，调用方用 rect 兜底 */
export function resolveElement(a: Annotation): Element | null {
  try {
    if (a.target.annId) {
      const byAnn = document.querySelector(annSelector(a.target.annId))
      if (byAnn) return byAnn
    }
    return document.querySelector(a.target.selector)
  } catch {
    return null
  }
}

/** 图钉位置（文档坐标） */
export function pinPosition(a: Annotation): { x: number; y: number; found: boolean } {
  const el = resolveElement(a)
  const rect = el ? pageRect(el) : a.target.rect
  return {
    x: rect.x + rect.width * a.point.rx,
    y: rect.y + rect.height * a.point.ry,
    found: el !== null,
  }
}

export function flashElement(el: Element) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  if (!(el instanceof HTMLElement)) return
  const prev = el.style.outline
  const prevOffset = el.style.outlineOffset
  el.style.outline = '3px solid #f28b74'
  el.style.outlineOffset = '4px'
  window.setTimeout(() => {
    el.style.outline = prev
    el.style.outlineOffset = prevOffset
  }, 1400)
}
