'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { cn } from '@/lib/cn'
import { DesktopFrame, PhoneFrame } from '../../_components/device-frame'
import { AppShell, type ShellForm } from './app-shell'
import { screenById, screenByNav, screens, type ScreenId } from './registry'

/** 一个页面在某种形态下的完整画面（外壳 + 内容） */
function ScreenView({
  id,
  form,
  onNavigate,
  thumb = false,
}: {
  id: ScreenId
  form: ShellForm
  onNavigate: (id: ScreenId) => void
  thumb?: boolean
}) {
  const def = screenById.get(id)
  if (!def) return null
  if (def.shell === 'bare') {
    return <div className="@container h-full overflow-y-auto">{def.render({ thumb })}</div>
  }
  return (
    <AppShell
      form={form}
      navPath={def.navPath}
      title={def.title}
      eyebrow={def.eyebrow}
      actions={def.actions}
      onNavigate={(href) => {
        const next = screenByNav.get(href)
        if (next) onNavigate(next)
      }}
      onBack={() => onNavigate('home')}
    >
      {/* key：切换页面时重新进场，状态也一起重置 */}
      <div key={id} className="animate-fade-up">
        {def.render({ thumb })}
      </div>
    </AppShell>
  )
}

const layoutOptions = [
  { value: 'both', label: '手机 + 桌面' },
  { value: 'phone', label: '只看手机' },
  { value: 'desktop', label: '只看桌面' },
] as const

type LayoutOption = (typeof layoutOptions)[number]['value']

/**
 * 页面预览：上面是全部页面的缩略图墙，点一张在下面同时看手机（360）和桌面（≥1000）两种形态。
 * 预览里可以点底栏 / 侧栏切换页面、点“＋”打开打卡弹层，交互和正式页面一致。
 */
export function ScreenPreview() {
  const [current, setCurrent] = useState<ScreenId>('home')
  const [layout, setLayout] = useState<LayoutOption>('both')
  const def = screenById.get(current)

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <section data-ann="playbook.pages.wall" aria-label="全部页面" className="min-w-0">
        <ScreenWall current={current} onPick={setCurrent} />
      </section>
      <div className="flex flex-wrap items-center gap-3" data-ann="playbook.pages.toolbar">
        <SegmentedControl
          options={layoutOptions}
          value={layout}
          onValueChange={setLayout}
          label="预览形态"
          size="sm"
          className="w-full sm:w-72"
        />
        {def && (
          <p className="text-caption text-muted min-w-0 flex-1">
            <span className="text-heading text-foreground mr-2 font-bold">{def.title}</span>
            <span className="bg-surface-sunken text-tiny text-foreground mr-2 rounded-md px-1.5 py-0.5 font-mono">
              {def.route}
            </span>
            {def.note}
          </p>
        )}
      </div>

      <div
        data-ann={`playbook.pages.screen.${current}`}
        className={cn(
          'grid items-start gap-6',
          layout === 'both' && 'xl:grid-cols-[auto_minmax(0,1fr)]',
        )}
      >
        {layout !== 'desktop' && (
          <PhoneFrame label={`手机 · ${def?.route ?? ''}`} className="h-[720px]">
            <ScreenView id={current} form="phone" onNavigate={setCurrent} />
          </PhoneFrame>
        )}
        {layout !== 'phone' && (
          <DesktopFrame label={`桌面 · ${def?.route ?? ''}`} height={720} minWidth={1000}>
            {/* 手机和桌面同时显示时，桌面里的互动吉祥物换成静态版：一屏只放一只互动的 */}
            <ScreenView
              id={current}
              form="desktop"
              onNavigate={setCurrent}
              thumb={layout === 'both'}
            />
          </DesktopFrame>
        )}
      </div>
    </div>
  )
}

/** 总览墙：所有页面的手机缩略图排成一排，点一张切到下面的详细预览 */
function ScreenWall({ current, onPick }: { current: ScreenId; onPick: (id: ScreenId) => void }) {
  return (
    <ul className="flex gap-5 overflow-x-auto pb-2">
      {screens.map((s) => (
        <li key={s.id} className="shrink-0" data-ann={`playbook.pages.wall.${s.id}`}>
          <div
            className="pointer-events-none origin-top-left"
            style={{ width: 360 * 0.62, height: 720 * 0.62 + 24 }}
            aria-hidden
            inert
          >
            <div className="origin-top-left scale-[0.62]">
              <PhoneFrame label={s.title} className="h-[720px]">
                <ScreenView id={s.id} form="phone" onNavigate={() => {}} thumb />
              </PhoneFrame>
            </div>
          </div>
          <button
            type="button"
            aria-pressed={s.id === current}
            onClick={() => onPick(s.id)}
            className={cn(
              'text-caption -mt-2 h-9 rounded-full px-3 font-semibold transition-colors duration-(--dur-fast)',
              s.id === current
                ? 'bg-primary-soft text-primary-ink'
                : 'text-muted hover:text-foreground',
            )}
          >
            {s.title}
            <span className="text-tiny ml-1.5 font-mono font-normal opacity-70">{s.route}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
