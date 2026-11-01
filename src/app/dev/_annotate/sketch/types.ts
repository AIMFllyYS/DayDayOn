export type SketchTool = 'select' | 'pen' | 'rect' | 'ellipse' | 'arrow' | 'text' | 'eraser'

export const sketchColors = {
  ink: 'var(--foreground)',
  primary: 'var(--primary)',
  exercise: 'var(--exercise-ink)',
  study: 'var(--study-ink)',
  sleep: 'var(--sleep)',
} as const

export type SketchColor = keyof typeof sketchColors

/** 导出 SVG 时 CSS 变量不可用，用这份固定色值 */
export const sketchColorHex: Record<SketchColor, string> = {
  ink: '#4a3f35',
  primary: '#f28b74',
  exercise: '#2c6a50',
  study: '#24578a',
  sleep: '#a99de6',
}

export interface Pt {
  x: number
  y: number
}

interface Base {
  id: string
  color: SketchColor
}

export interface StrokeItem extends Base {
  kind: 'stroke'
  points: Pt[]
  width: number
}

/** 矩形、椭圆用左上角 + 宽高；箭头从 (x, y) 指向 (x + w, y + h)，w / h 可以为负 */
export interface ShapeItem extends Base {
  kind: 'rect' | 'ellipse' | 'arrow'
  x: number
  y: number
  w: number
  h: number
  width: number
}

export interface TextItem extends Base {
  kind: 'text'
  x: number
  y: number
  text: string
  size: number
}

/** 引用的真实组件：ref 对应 registry.tsx 里的条目 */
export interface ComponentItem extends Base {
  kind: 'component'
  x: number
  y: number
  w: number
  h: number
  ref: string
  props: Record<string, string>
  /** 对这个组件的说明，例如"这里换成大号按钮" */
  note?: string
}

/** 截图：data URL（WebP / JPEG），放在组件层，可移动、改尺寸 */
export interface ImageItem extends Base {
  kind: 'image'
  x: number
  y: number
  w: number
  h: number
  src: string
  /** 截图时页面的路由和区域，方便对照 */
  source?: { route: string; rect: { x: number; y: number; w: number; h: number } }
}

export type SketchItem = StrokeItem | ShapeItem | TextItem | ComponentItem | ImageItem

export type SketchFrame = 'phone' | 'desktop' | 'free'

export const frameSize: Record<SketchFrame, { width: number; height: number; label: string }> = {
  phone: { width: 390, height: 844, label: '手机 390' },
  desktop: { width: 1280, height: 800, label: '桌面 1280' },
  free: { width: 1200, height: 900, label: '自由画布' },
}

export interface Sketch {
  id: string
  title: string
  /** 画草图时所在的页面 */
  route: string
  frame: SketchFrame
  items: SketchItem[]
  createdAt: string
  updatedAt: string
}
