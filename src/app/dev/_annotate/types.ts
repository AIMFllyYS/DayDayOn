import type { Sketch } from './sketch/types'

export const annotationCategories = [
  { value: 'visual', label: '视觉' },
  { value: 'layout', label: '布局' },
  { value: 'interaction', label: '交互' },
  { value: 'motion', label: '动效' },
  { value: 'copy', label: '文案' },
  { value: 'bug', label: '缺陷' },
] as const

export const annotationPriorities = [
  { value: 'P0', label: 'P0 必须改' },
  { value: 'P1', label: 'P1 应该改' },
  { value: 'P2', label: 'P2 可以改' },
] as const

export type AnnotationCategory = (typeof annotationCategories)[number]['value']
export type AnnotationPriority = (typeof annotationPriorities)[number]['value']
export type AnnotationStatus = 'open' | 'resolved'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 被批注的区块。优先用 data-ann 定位，找不到再用 selector，都找不到时用 rect 兜底 */
export interface AnnotationTarget {
  /** 区块上的 data-ann 值，例如 playbook.components.button */
  annId: string | null
  /** 从最近的 data-ann 祖先（或 body）开始的 CSS 路径 */
  selector: string
  tag: string
  /** 区块文字的前 80 个字符，帮助人读懂指的是哪里 */
  text: string
  /** 批注时区块在页面中的位置（文档坐标，单位 px） */
  rect: Rect
}

export interface Annotation {
  id: string
  /** pathname，不含查询参数 */
  route: string
  viewport: { width: number; height: number; dpr: number }
  target: AnnotationTarget
  /** 点击位置在区块内的相对坐标（0–1），区块移动后图钉仍落在同一处 */
  point: { rx: number; ry: number }
  comment: string
  category: AnnotationCategory
  priority: AnnotationPriority
  status: AnnotationStatus
  /** 附带的草图 id（见 sketches） */
  sketchId?: string | null
  createdAt: string
  updatedAt: string
}

/** v2 在 v1 基础上增加 sketches；导入时两个版本都接受 */
export const ANNOTATION_SCHEMA = 'daydayon.annotations/v2'

export interface AnnotationExport {
  schema: typeof ANNOTATION_SCHEMA
  app: 'DayDayOn'
  exportedAt: string
  /** 导出时浏览器的 UA，方便区分手机 / 桌面批注 */
  userAgent: string
  items: Annotation[]
  sketches: Sketch[]
}

/** 编辑器的输入：新建时只有 target 和 point，编辑时带上已有内容 */
export interface AnnotationDraft {
  editingId: string | null
  target: AnnotationTarget
  point: { rx: number; ry: number }
  /** 编辑器弹出的位置（视口坐标） */
  anchor: { x: number; y: number }
  comment: string
  category: AnnotationCategory
  priority: AnnotationPriority
  sketchId: string | null
}
