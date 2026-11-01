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
      className="grid items-center gap-8 pt-6 pb-10 @3xl:grid-cols-[1.1fr_1fr] @3xl:pt-12"
    >
      <div className="animate-fade-up flex flex-col items-start gap-4">
        <span className="bg-primary-soft text-primary-ink text-tiny rounded-full px-3 py-1 font-semibold">
          和朋友一起的打卡手账
        </span>
        <h1 id="welcome-title" className="text-display font-bold">
          每天一点点，
          <br />
          有人陪着就不难
        </h1>
        <p className="text-subhead text-muted max-w-md">
          运动、饮食、睡眠、学习，还有你自己的小目标。拍张照让 AI 帮你记，和朋友一起看谁更坚持。
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">{cta}</div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-72 w-full max-w-sm items-end justify-center overflow-visible rounded-3xl bg-[radial-gradient(ellipse_at_50%_40%,var(--surface)_0%,transparent_70%)] pb-4">
          {thumb ? (
            <Mascot size={200} character={character} />
          ) : (
            <InteractivePet ref={pet} size={200} character={character} idleSleepMs={0} />
          )}
        </div>
        <SegmentedControl
          options={mascotCharacters.map((c) => ({ value: c.id, label: c.name }))}
          value={character}
          onValueChange={setCharacter}
          label="选一只陪你的小伙伴"
          size="sm"
          className="w-48"
        />
        <p className="text-caption text-muted flex items-center gap-1.5">
          <Icon name="hand" size={16} />
          戳一戳、双击、长按或者摸摸它
        </p>
      </div>
    </section>
  )
}
