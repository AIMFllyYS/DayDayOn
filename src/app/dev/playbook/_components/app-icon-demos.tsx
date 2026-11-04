'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  logoSvg,
  paperPlaneSvg,
  type LogoShape,
  type LogoVariant,
} from '@/components/layout/logo-svg'

/**
 * Playbook 应用图标展示组件
 * - 正式方案：【05 连击热力·五彩织锦 (Streak Heatmap & Mosaic)】作为全站唯一图标（标签页、PWA、APK）
 * - 备选方案：【08 信笺、纸飞机与朋友的回音 (Paper Plane & Resonance)】作为社交呼应与投递备用资产
 */
export function AppIconDemos() {
  const [activeShape, setActiveShape] = useState<LogoShape>('rounded')
  const [activeVariant, setActiveVariant] = useState<LogoVariant>('full')

  const currentSvgHtml = logoSvg(activeVariant, activeShape)
  const markSvgHtml = logoSvg('mark', activeShape)
  const planeSvgHtml = paperPlaneSvg(512)

  return (
    <div className="grid gap-6">
      {/* 1. 正式方案：05 连击热力 */}
      <Card variant="sticker" className="grid gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="primary" size="md">
                正式方案 · #05
              </Badge>
              <h3 className="text-heading font-bold">连击热力·五彩织锦</h3>
            </div>
            <p className="text-caption text-muted mt-1">
              全站唯一图标源（logo-svg.ts）。运动、饮食、睡眠、学习四色板块围绕连击火种，象征日日平衡、持续发光。
            </p>
          </div>

          {/* 切换控件 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-tiny text-muted font-semibold">外形：</span>
            {(['rounded', 'square', 'foreground'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setActiveShape(s)}
                className={`text-tiny rounded-full px-3 py-1 font-semibold transition-colors ${
                  activeShape === s
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-sunken text-muted hover:text-foreground'
                }`}
              >
                {s === 'rounded'
                  ? '圆角方块 (PWA)'
                  : s === 'square'
                    ? '满版 (iOS/Maskable)'
                    : '透明前景 (Android)'}
              </button>
            ))}

            <span className="text-tiny text-muted ml-2 font-semibold">构图：</span>
            {(['full', 'mark'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setActiveVariant(v)}
                className={`text-tiny rounded-full px-3 py-1 font-semibold transition-colors ${
                  activeVariant === v
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-sunken text-muted hover:text-foreground'
                }`}
              >
                {v === 'full' ? 'full (≥96px)' : 'mark (16–48px)'}
              </button>
            ))}
          </div>
        </div>

        {/* 主预览台与全尺寸阶梯标尺 */}
        <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
          {/* 大图预览 */}
          <div className="bg-surface-sunken border-border flex flex-col items-center justify-center rounded-2xl border p-6">
            <div
              className="shadow-float size-44 overflow-hidden rounded-[26%] transition-transform hover:scale-105"
              dangerouslySetInnerHTML={{ __html: currentSvgHtml }}
            />
            <span className="text-tiny text-muted mt-3 font-mono">
              512×512 · {activeVariant} · {activeShape}
            </span>
          </div>

          {/* 尺寸阶梯与真实场景对照 */}
          <div className="flex flex-col justify-between gap-4">
            <div>
              <p className="text-tiny text-muted mb-2 font-bold tracking-wide uppercase">
                尺寸阶梯清晰度测试 (140px → 16px)
              </p>
              <div className="flex flex-wrap items-end gap-5">
                {/* 140px */}
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="shadow-soft size-24 overflow-hidden rounded-2xl"
                    dangerouslySetInnerHTML={{ __html: currentSvgHtml }}
                  />
                  <span className="text-tiny text-muted font-mono">96px</span>
                </div>
                {/* 64px 手机主屏 */}
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="shadow-soft size-16 overflow-hidden rounded-[22%]"
                    dangerouslySetInnerHTML={{ __html: currentSvgHtml }}
                  />
                  <span className="text-tiny text-muted font-mono">64px (桌面)</span>
                </div>
                {/* 48px PWA */}
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="shadow-soft size-12 overflow-hidden rounded-xl"
                    dangerouslySetInnerHTML={{ __html: markSvgHtml }}
                  />
                  <span className="text-tiny text-muted font-mono">48px (快捷)</span>
                </div>
                {/* 32px 标签页 */}
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="shadow-soft size-8 overflow-hidden rounded-lg"
                    dangerouslySetInnerHTML={{ __html: markSvgHtml }}
                  />
                  <span className="text-tiny text-muted font-mono">32px (Favicon)</span>
                </div>
                {/* 16px 极限标签 */}
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="size-4 overflow-hidden rounded-sm"
                    dangerouslySetInnerHTML={{ __html: markSvgHtml }}
                  />
                  <span className="text-tiny text-muted font-mono">16px (微缩)</span>
                </div>
              </div>
            </div>

            <div className="bg-surface border-border text-caption text-muted rounded-xl border p-3">
              <span className="text-foreground font-semibold">应用范围：</span>
              浏览器标签页图标（icon.tsx）、iOS 桌面主屏（apple-icon.tsx）、PWA 192/512
              图标（/icons/[name]）、Android APK 自适应图标、应用外壳 BrandMark。
            </div>
          </div>
        </div>
      </Card>

      {/* 2. 备选方案：08 纸飞机与朋友的回音 */}
      <Card className="border-border grid gap-4 border p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="study" size="md">
                备选资产 · #08
              </Badge>
              <h3 className="text-heading font-bold">信笺、纸飞机与朋友的回音</h3>
            </div>
            <p className="text-caption text-muted mt-1">
              用户特别赞赏 08 号的飞扬朝气与呼应感，在 Playbook
              沉淀为备用视觉资产。可用于朋友动态、打卡投递通知、信笺动画与徽章。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-tiny text-muted font-mono">paperPlaneSvg()</span>
            <Badge tone="exercise" icon="paper-plane">
              可调用
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          {/* 纸飞机完整图 */}
          <div
            className="shadow-soft size-28 shrink-0 overflow-hidden rounded-2xl"
            dangerouslySetInnerHTML={{ __html: planeSvgHtml }}
          />

          {/* 社交/通知场景演示 */}
          <div className="grid flex-1 gap-2.5">
            <div className="bg-surface-sunken border-border flex items-center gap-3 rounded-xl border p-3">
              <span className="bg-study-soft text-study-ink flex size-10 items-center justify-center rounded-full">
                <Icon name="paper-plane" size={20} />
              </span>
              <div className="flex-1">
                <p className="text-caption font-semibold">小飞机动态投递 (示例)</p>
                <p className="text-tiny text-muted">阿柚向你投递了一张「完成了早起打卡」的纸飞机</p>
              </div>
              <Badge tone="study" size="sm">
                刚刚
              </Badge>
            </div>

            <div className="text-tiny text-muted flex items-center gap-3">
              <span>调用入口：</span>
              <code className="bg-surface border-border text-primary-ink rounded border px-2 py-0.5 font-mono">
                import {'{ paperPlaneSvg }'} from &apos;@/components/layout/logo-svg&apos;
              </code>
              <code className="bg-surface border-border text-primary-ink rounded border px-2 py-0.5 font-mono">
                &lt;Icon name=&quot;paper-plane&quot; /&gt;
              </code>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
