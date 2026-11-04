'use client'

import { useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import type { MascotMood } from '@/components/mascot/mascot-svg'
import { IconTile } from '@/components/ui/badge'
import { moduleMeta, moduleTones, type ModuleTone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'
import { useWelcomeMascot } from './mascot-context'
import { WelcomeSection } from './welcome-section'

const modules: Record<ModuleTone, { example: string; mood: MascotMood; say: string }> = {
  exercise: { example: '跑步 30 分钟、每周三次力量', mood: 'cheer', say: '动起来！' },
  diet: { example: '拍一下午饭，热量自动估好', mood: 'eating', say: '吧唧吧唧' },
  sleep: { example: '几点睡、几点起，一眼看清', mood: 'sleepy', say: '晚安～' },
  study: { example: '背单词、刷题，按时长或次数', mood: 'thinking', say: '让我想想…' },
  custom: { example: '喝八杯水、给家里打电话', mood: 'love', say: '你说了算' },
}

// 板块卡片选中态：类名写完整，Tailwind 才扫描得到
const selectedClass: Record<ModuleTone, string> = {
  exercise: 'ring-exercise bg-exercise-soft',
  diet: 'ring-diet bg-diet-soft',
  sleep: 'ring-sleep bg-sleep-soft',
  study: 'ring-study bg-study-soft',
  custom: 'ring-custom bg-custom-soft',
}

/** 五个板块：点一张（桌面悬停也行），右边的团团换成对应的表情 */
export function WelcomeModules() {
  const { character } = useWelcomeMascot()
  const [active, setActive] = useState<ModuleTone>('exercise')
  const current = modules[active]

  return (
    <WelcomeSection
      id="modules"
      ann="welcome.modules"
      eyebrow="五个板块"
      title="想坚持的事，都能记"
      description="每个目标设好时间和量，打卡时只填关键的几项。"
    >
      <div className="grid gap-3 @2xl:grid-cols-[1fr_220px] @2xl:items-center @2xl:gap-4">
        <ul className="grid grid-cols-2 gap-2 @2xl:grid-cols-1 @4xl:grid-cols-2">
          {moduleTones.map((m) => (
            <li key={m} className={cn(m === 'custom' && 'col-span-2 @2xl:col-span-1')}>
              <button
                type="button"
                aria-pressed={active === m}
                onClick={() => setActive(m)}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') setActive(m)
                }}
                className={cn(
                  'bg-surface shadow-soft ease-spring flex min-h-16 w-full items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left transition-[transform,box-shadow,background-color] duration-(--dur-base) active:scale-[0.98] @2xl:gap-3 @2xl:px-4 @2xl:py-3',
                  active === m && cn('ring-2', selectedClass[m]),
                )}
              >
                <IconTile icon={moduleMeta[m].icon} tone={m} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{moduleMeta[m].label}</span>
                  <span className="text-tiny text-muted block truncate @2xl:whitespace-normal">
                    {modules[m].example}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div
          className="bg-surface/80 border-border shadow-soft order-first flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 @2xl:order-none @2xl:flex-col @2xl:justify-center @2xl:border-none @2xl:bg-transparent @2xl:p-0 @2xl:shadow-none"
          aria-live="polite"
        >
          <div className="flex flex-col items-start gap-1 @2xl:items-center">
            <span className="text-tiny text-muted @2xl:hidden">
              当前预览：{moduleMeta[active].label}
            </span>
            <span
              key={active}
              className="animate-pop-in bg-surface text-caption shadow-card rounded-2xl px-3 py-1.5 font-semibold"
            >
              {current.say}
            </span>
            <span className="text-tiny text-muted mt-0.5 @2xl:hidden">{current.example}</span>
          </div>
          <Mascot
            key={`${active}-m`}
            mood={current.mood}
            size={108}
            character={character}
            className="animate-fade-in shrink-0 @2xl:scale-110"
          />
        </div>
      </div>
    </WelcomeSection>
  )
}
