'use client'

import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { setTheme, themes, useTheme } from '@/lib/theme'

/*
 * 配色说明：旧方案（珊瑚实底 + 深棕字）和新方案并排对比，说明"为什么徽章舒服、按钮廉价"。
 * 旧方案的色值只在这个演示里出现，用来对比，正式代码不要用。
 */
const legacyCoral = {
  bg: '#f28b74',
  ink: '#3f1d14',
  soft: '#fde4dc',
  softInk: '#8f3b28',
}

const reasons = [
  {
    title: '面积越大，颜色越要退后',
    body: '徽章是"浅底 + 同色深字"，饱和度只在小面积的字和图标上。珊瑚实底把高饱和色铺满整个按钮，再压一个深棕字，像促销标签。',
  },
  {
    title: '实底只用深而柔的颜色',
    body: '主色改成低饱和的深色（奶茶焦糖 #93603F），上面用奶油色字，对比度 5.1:1，比原来的 2.3:1（白字）稳得多，也不再需要黑字硬撑。',
  },
  {
    title: '同一个色相，三档明度',
    body: 'soft 底 / base 图形 / ink 字是同一色相的浅、中、深，像水彩叠色。一屏里只有一个实底主按钮，其他操作用 soft 或描边。',
  },
] as const

export function PaletteRationale() {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <figure
          data-ann="playbook.foundations.palette-why.before"
          className="border-border bg-surface flex flex-col gap-3 rounded-2xl border p-4"
        >
          <figcaption className="text-tiny text-muted font-semibold">之前 · 珊瑚实底</figcaption>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-body inline-flex h-11 items-center rounded-full px-5 font-semibold"
              style={{ background: legacyCoral.bg, color: legacyCoral.ink }}
            >
              确认记录
            </span>
            <span
              className="font-display inline-flex size-11 items-center justify-center rounded-full font-semibold"
              style={{ background: legacyCoral.bg, color: legacyCoral.ink }}
            >
              10
            </span>
            <span
              className="text-tiny inline-flex h-6 items-center rounded-full px-2.5 font-semibold"
              style={{ background: legacyCoral.soft, color: legacyCoral.softInk }}
            >
              连续 12 天
            </span>
          </div>
          <p className="text-tiny text-muted">大面积高饱和 + 深棕字：显得廉价、刺眼</p>
        </figure>
        <figure
          data-ann="playbook.foundations.palette-why.after"
          className="border-border bg-surface flex flex-col gap-3 rounded-2xl border p-4"
        >
          <figcaption className="text-tiny text-muted font-semibold">现在 · 当前主题</figcaption>
          <div className="flex flex-wrap items-center gap-2">
            <Button icon="check">确认记录</Button>
            <IconButton icon="plus" label="新建" variant="primary" />
            <Button variant="soft">稍后提醒</Button>
            <Badge tone="primary" icon="flame">
              连续 12 天
            </Badge>
          </div>
          <p className="text-tiny text-muted">深而柔的实底 + 奶油字；次要操作退到 soft</p>
        </figure>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {reasons.map((r, i) => (
          <li key={r.title} className="bg-surface shadow-soft rounded-2xl p-4">
            <p className="font-display text-tiny text-primary-ink font-semibold">0{i + 1}</p>
            <p className="font-semibold">{r.title}</p>
            <p className="text-caption text-muted mt-1">{r.body}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** 每个主题一张小卡：卡片自己带 data-theme，所以五个主题能同时并排显示 */
export function ThemeGallery() {
  const current = useTheme()
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {themes.map((t) => {
        const selected = t.id === current
        return (
          <li key={t.id} data-theme={t.id} data-ann={`playbook.foundations.theme.${t.id}`}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => setTheme(t.id)}
              className={cn(
                'bg-surface ease-spring flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition-[transform,box-shadow,border-color] duration-(--dur-base) hover:-translate-y-0.5',
                selected ? 'border-primary shadow-float' : 'border-border shadow-soft',
              )}
            >
              <span className="flex items-center gap-2">
                <span className="flex h-8 overflow-hidden rounded-lg">
                  <span className="bg-primary w-8" />
                  <span className="bg-primary-soft w-5" />
                  <span className="bg-primary-ink w-3" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.label}</span>
                  <span className="text-tiny text-muted block">{t.note}</span>
                </span>
                {selected && (
                  <Badge tone="primary" dot>
                    使用中
                  </Badge>
                )}
              </span>
              {/* 这里是展示用的假按钮（外层已经是 button，不能再嵌套 button） */}
              <span className="flex flex-wrap items-center gap-2" aria-hidden>
                <span className="bg-primary text-on-primary shadow-primary text-caption inline-flex h-9 items-center rounded-full px-3.5 font-semibold">
                  确认记录
                </span>
                <span className="bg-primary-soft text-primary-ink text-caption inline-flex h-9 items-center rounded-full px-3.5 font-semibold">
                  稍后
                </span>
                <IconTile icon="bell" tone="primary" size="sm" />
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
