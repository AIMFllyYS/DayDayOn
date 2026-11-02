import { randomInt } from 'node:crypto'

/*
 * 手账风点选验证码图形生成（自托管、零原生依赖）。
 *
 * 防脚本原理：
 * 1. 6 种高辨识度手账图标（月亮、爱心、星星、太阳、铃铛、小房）以局部 (0..24, 0..24) 矢量指令存储。
 * 2. 服务端每次随机抽取 4 个图标（3 个按顺序作为点击目标 + 1 个干扰项），分配到随机打乱的槽位，
 *    并在服务端直接将旋转、缩放、平移烘焙进全局 Canvas 路径坐标（M / L / C / Z），混入干扰手绘线条后打乱顺序下发。
 * 3. 响应 JSON 中不含任何图标名称与坐标的对应关系，前端直接用 Path2D 绘入单个 <canvas>，
 *    从而同时防御接口直刷脚本（读不出坐标）与无头浏览器 DOM 选择器（无子节点）。
 */

export const CAPTCHA_WIDTH = 280
export const CAPTCHA_HEIGHT = 84
/** 判定点中目标图标的最大欧氏距离（px），兼顾手机大拇指触控容错与防随机盲猜 */
export const CAPTCHA_HIT_RADIUS = 28

export type PathCmd =
  | readonly ['M', number, number]
  | readonly ['L', number, number]
  | readonly ['C', number, number, number, number, number, number]
  | readonly ['Z']

export interface CaptchaStroke {
  /** 已烘焙全局坐标的 SVG path d 字符串 */
  d: string
  /** 着色槽（0..3 对应 4 种板块马卡龙色，4 为浅色手账装饰噪点） */
  tone: 0 | 1 | 2 | 3 | 4
  /** 是否同时绘制错版印刷浅色填充层 */
  fill?: boolean
}

interface ShapeDef {
  label: string
  /** 主闭合轮廓（同时绘制错版印刷浅底与描边） */
  body: readonly PathCmd[]
  /** 附加线条（仅描边） */
  lines?: readonly PathCmd[]
}

const SHAPES: readonly ShapeDef[] = [
  {
    label: '月亮',
    body: [
      ['M', 14.8, 4.2],
      ['C', 7.2, 4.5, 4.2, 13.8, 10.2, 18.2],
      ['C', 11.5, 19.2, 13.2, 19.7, 14.8, 19.8],
      ['C', 10.2, 17.2, 9.6, 9.2, 14.8, 4.2],
      ['Z'],
    ],
  },
  {
    label: '爱心',
    body: [
      ['M', 12, 19.4],
      ['C', 10.1, 17.9, 4.6, 14.1, 4.6, 9.5],
      ['C', 4.6, 6.3, 7.3, 4.5, 9.8, 5.2],
      ['C', 11.0, 5.5, 11.7, 6.6, 12, 7.8],
      ['C', 12.3, 6.6, 13.0, 5.5, 14.2, 5.2],
      ['C', 16.7, 4.5, 19.4, 6.3, 19.4, 9.5],
      ['C', 19.4, 14.1, 13.9, 17.9, 12, 19.4],
      ['Z'],
    ],
  },
  {
    label: '星星',
    body: [
      ['M', 12, 4.0],
      ['L', 14.2, 9.3],
      ['L', 19.9, 9.8],
      ['L', 15.5, 13.5],
      ['L', 16.9, 19.1],
      ['L', 12, 16.0],
      ['L', 7.1, 19.1],
      ['L', 8.5, 13.5],
      ['L', 4.1, 9.8],
      ['L', 9.8, 9.3],
      ['Z'],
    ],
  },
  {
    label: '太阳',
    body: [
      ['M', 12, 7.6],
      ['C', 14.4, 7.6, 16.4, 9.6, 16.4, 12],
      ['C', 16.4, 14.4, 14.4, 16.4, 12, 16.4],
      ['C', 9.6, 16.4, 7.6, 14.4, 7.6, 12],
      ['C', 7.6, 9.6, 9.6, 7.6, 12, 7.6],
      ['Z'],
    ],
    lines: [
      ['M', 12, 3.2],
      ['L', 12, 5.4],
      ['M', 12, 18.6],
      ['L', 12, 20.8],
      ['M', 3.2, 12],
      ['L', 5.4, 12],
      ['M', 18.6, 12],
      ['L', 20.8, 12],
      ['M', 5.8, 5.8],
      ['L', 7.4, 7.4],
      ['M', 16.6, 16.6],
      ['L', 18.2, 18.2],
      ['M', 18.2, 5.8],
      ['L', 16.6, 7.4],
      ['M', 7.4, 16.6],
      ['L', 5.8, 18.2],
    ],
  },
  {
    label: '铃铛',
    body: [
      ['M', 7.2, 11.2],
      ['C', 7.2, 7.8, 9.3, 5.8, 12, 5.8],
      ['C', 14.7, 5.8, 16.8, 7.8, 16.8, 11.2],
      ['L', 16.8, 14.8],
      ['L', 18.6, 16.8],
      ['L', 5.4, 16.8],
      ['L', 7.2, 14.8],
      ['Z'],
    ],
    lines: [
      ['M', 12, 3.8],
      ['L', 12, 5.8],
      ['M', 10.0, 17.2],
      ['C', 10.4, 19.6, 13.6, 19.6, 14.0, 17.2],
    ],
  },
  {
    label: '小房',
    body: [
      ['M', 6.6, 10.4],
      ['L', 12, 5.4],
      ['L', 17.4, 10.4],
      ['L', 17.4, 19.0],
      ['L', 6.6, 19.0],
      ['Z'],
    ],
    lines: [
      ['M', 4.2, 11.6],
      ['L', 12, 4.4],
      ['L', 19.8, 11.6],
      ['M', 10.3, 19.0],
      ['L', 10.3, 14.0],
      ['L', 13.7, 14.0],
      ['L', 13.7, 19.0],
    ],
  },
]

const round1 = (n: number): number => Math.round(n * 10) / 10

/** 将局部 (0..24, 0..24) 路径指令经旋转、缩放、平移变换为全局画布 SVG path 字符串 */
export function transformCmds(
  cmds: readonly PathCmd[],
  cx: number,
  cy: number,
  angleRad: number,
  scale: number,
): string {
  const cos = Math.cos(angleRad) * scale
  const sin = Math.sin(angleRad) * scale
  const pt = (x: number, y: number): string => {
    const dx = x - 12
    const dy = y - 12
    const gx = round1(cx + dx * cos - dy * sin)
    const gy = round1(cy + dx * sin + dy * cos)
    return `${gx} ${gy}`
  }

  const parts: string[] = []
  for (const c of cmds) {
    if (c[0] === 'M') parts.push(`M ${pt(c[1], c[2])}`)
    else if (c[0] === 'L') parts.push(`L ${pt(c[1], c[2])}`)
    else if (c[0] === 'C') {
      parts.push(`C ${pt(c[1], c[2])} ${pt(c[3], c[4])} ${pt(c[5], c[6])}`)
    } else {
      parts.push('Z')
    }
  }
  return parts.join(' ')
}

function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  return arr
}

export interface GeneratedScene {
  /** 按点击顺序排列的 3 个目标中文名 */
  prompt: [string, string, string]
  /** 对应的 3 个目标圆心坐标 */
  targets: [[number, number], [number, number], [number, number]]
  /** 打乱顺序后的全局画布路径 */
  strokes: CaptchaStroke[]
}

/** 生成一幅包含 4 个手账图标（3 目标 + 1 干扰）与装饰噪点的画布场景 */
export function generateCaptchaScene(): GeneratedScene {
  const picked = shuffle(SHAPES).slice(0, 4)
  // 4 个水平槽位中心（保证图标间距 >= 52px，不重叠且不贴边）
  const slotCenters = shuffle([42, 108, 174, 238])
  const tones = shuffle([0, 1, 2, 3] as const)

  const strokes: CaptchaStroke[] = []
  const centers: [number, number][] = []

  for (let i = 0; i < 4; i++) {
    const shape = picked[i]!
    const baseX = slotCenters[i]!
    const cx = baseX + randomInt(-9, 10)
    const cy = 42 + randomInt(-14, 15)
    // 旋转控制在 -18° ~ +18°，缩放 1.28~1.42 倍，饱满清晰且带手账贴纸感
    const angleRad = (randomInt(-18, 19) * Math.PI) / 180
    const scale = randomInt(128, 143) / 100
    const tone = tones[i]!

    centers.push([cx, cy])
    strokes.push({
      d: transformCmds(shape.body, cx, cy, angleRad, scale),
      tone,
      fill: true,
    })
    if (shape.lines) {
      strokes.push({
        d: transformCmds(shape.lines, cx, cy, angleRad, scale),
        tone,
      })
    }
  }

  // 加入 6 条随机手账装饰虚线/小波浪，干扰自动化轮廓分割
  for (let i = 0; i < 6; i++) {
    const x1 = randomInt(16, CAPTCHA_WIDTH - 24)
    const y1 = randomInt(12, CAPTCHA_HEIGHT - 12)
    const dx = randomInt(10, 22) * (randomInt(2) === 0 ? 1 : -1)
    const dy = randomInt(-10, 11)
    const cx = round1(x1 + dx * 0.5 + randomInt(-6, 7))
    const cy = round1(y1 + dy * 0.5 + randomInt(-8, 9))
    strokes.push({
      d: `M ${x1} ${y1} C ${cx} ${cy} ${cx} ${cy} ${x1 + dx} ${y1 + dy}`,
      tone: 4,
    })
  }

  return {
    prompt: [picked[0]!.label, picked[1]!.label, picked[2]!.label],
    targets: [centers[0]!, centers[1]!, centers[2]!],
    strokes: shuffle(strokes),
  }
}
