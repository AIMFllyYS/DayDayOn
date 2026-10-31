import { arrowHead, bbox, strokePath } from './geometry'
import { componentLabel } from './registry'
import { frameSize, sketchColors, type Sketch } from './types'

/** 批注列表里的草图缩略图：组件画成带名称的虚线框，不渲染真实组件 */
export function SketchThumb({ sketch, height = 96 }: { sketch: Sketch; height?: number }) {
  const { width: w, height: h } = frameSize[sketch.frame]
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      height={height}
      width={(height * w) / h}
      role="img"
      aria-label={`草图：${sketch.title}`}
      className="bg-background ring-surface/20 shrink-0 rounded-lg ring-1"
    >
      {sketch.items.map((it) => {
        const stroke = sketchColors[it.color]
        switch (it.kind) {
          case 'stroke':
            return (
              <path
                key={it.id}
                d={strokePath(it.points)}
                fill="none"
                stroke={stroke}
                strokeWidth={it.width * 2}
                strokeLinecap="round"
              />
            )
          case 'rect':
          case 'ellipse': {
            const b = bbox(it)
            return it.kind === 'rect' ? (
              <rect
                key={it.id}
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={10}
                fill="none"
                stroke={stroke}
                strokeWidth={it.width * 2}
              />
            ) : (
              <ellipse
                key={it.id}
                cx={b.x + b.w / 2}
                cy={b.y + b.h / 2}
                rx={b.w / 2}
                ry={b.h / 2}
                fill="none"
                stroke={stroke}
                strokeWidth={it.width * 2}
              />
            )
          }
          case 'arrow':
            return (
              <g
                key={it.id}
                fill="none"
                stroke={stroke}
                strokeWidth={it.width * 2}
                strokeLinecap="round"
              >
                <path d={`M${it.x} ${it.y}l${it.w} ${it.h}`} />
                <path d={arrowHead(it.x, it.y, it.x + it.w, it.y + it.h, 18)} />
              </g>
            )
          case 'text':
            return (
              <text
                key={it.id}
                x={it.x}
                y={it.y + it.size}
                fontSize={it.size * 1.6}
                fill={stroke}
                fontWeight={700}
              >
                {it.text.split('\n')[0]}
              </text>
            )
          case 'image':
            return (
              <image
                key={it.id}
                href={it.src}
                x={it.x}
                y={it.y}
                width={it.w}
                height={it.h}
                preserveAspectRatio="none"
              />
            )
          case 'component':
            return (
              <g key={it.id}>
                <rect
                  x={it.x}
                  y={it.y}
                  width={it.w}
                  height={it.h}
                  rx={12}
                  fill="var(--primary-soft)"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  strokeDasharray="10 6"
                />
                <text
                  x={it.x + 10}
                  y={it.y + 30}
                  fontSize={26}
                  fontWeight={700}
                  fill="var(--primary-ink)"
                >
                  {componentLabel(it.ref)}
                </text>
              </g>
            )
        }
      })}
    </svg>
  )
}
