'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { InteractivePet, type PetHandle } from '@/components/mascot/interactive-pet'
import { Mascot } from '@/components/mascot/mascot'
import { mascotCharacters } from '@/components/mascot/mascot-svg'
import { Icon } from '@/components/ui/icon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useWelcomeMascot } from './mascot-context'

/**
 * 首屏：互动团团进场挥手，可以切换团团 / 墩墩，提示访客戳一戳。
 * 这是落地页上唯一一只互动团团的首屏位置（一屏只放一只，ui-design-system.md 第 9 节）。
 * thumb：Playbook 缩略图里换成静态版。
 */
export function WelcomeHero({ cta, thumb = false }: { cta: ReactNode; thumb?: boolean }) {
  const { character, setCharacter } = useWelcomeMascot()
  const pet = useRef<PetHandle>(null)

  useEffect(() => {
    // 等进场动画走完再挥手
    const t = window.setTimeout(() => pet.current?.play('wave'), 500)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <section
      data-ann="welcome.hero"
      aria-labelledby="welcome-title"
      className="grid items-center gap-6 pt-3 pb-6 @3xl:grid-cols-[1.1fr_1fr] @3xl:gap-8 @3xl:pt-12 @3xl:pb-10"
    >
      <div className="animate-fade-up flex flex-col items-start gap-3.5 @3xl:gap-4">
        <span className="bg-primary-soft text-primary-ink text-tiny rounded-full px-3 py-1 font-semibold">
          和朋友一起的打卡手账
        </span>
        <h1 id="welcome-title" className="text-display font-bold">
          每天一点点，
          <br />
          有人陪着就不难
        </h1>
        <p className="text-subhead text-muted max-w-md">
          运动、饮食、睡眠、学习，还有你自己的小目标。智能拍照或上传让 AI
          帮你记，和朋友一起看谁更坚持。
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2.5 @3xl:mt-2 @3xl:gap-3">{cta}</div>
        <a
          href="#download"
          className="text-caption text-muted hover:text-foreground inline-flex items-center gap-1.5 pt-0.5 transition-colors"
        >
          <Icon name="download" size={15} className="text-primary-ink" />
          <span>支持 Android 安装包（DayDayOn.apk）与 iOS 添加到主屏幕</span>
        </a>
      </div>

      <div className="bg-surface/80 border-border shadow-soft flex flex-col items-center gap-3 rounded-3xl border px-4 pt-6 pb-4 @3xl:border-none @3xl:bg-transparent @3xl:p-0 @3xl:shadow-none">
        <div className="relative flex h-56 w-full max-w-sm items-end justify-center overflow-visible rounded-3xl bg-[radial-gradient(ellipse_at_50%_40%,var(--surface)_0%,transparent_70%)] pt-4 pb-2 @3xl:h-72 @3xl:pt-0 @3xl:pb-4">
          {thumb ? (
            <Mascot size={184} character={character} />
          ) : (
            <InteractivePet ref={pet} size={184} character={character} idleSleepMs={0} />
          )}
        </div>
        <SegmentedControl
          options={mascotCharacters.map((c) => ({ value: c.id, label: c.name }))}
          value={character}
          onValueChange={setCharacter}
          label="选一只陪你的小伙伴"
          size="sm"
          className="w-full max-w-xs"
        />
        <p className="text-caption text-muted flex items-center gap-1.5">
          <Icon name="hand" size={16} />
          戳一戳、双击、长按或者摸摸它
        </p>
      </div>
    </section>
  )
}
