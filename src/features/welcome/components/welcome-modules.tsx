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
      <div className="grid gap-4 @2xl:grid-cols-[1fr_220px] @2xl:items-center">
        <ul className="grid gap-2 @md:grid-cols-2 @2xl:grid-cols-1 @4xl:grid-cols-2">
          {moduleTones.map((m) => (
            <li key={m}>
              <button
                type="button"
                aria-pressed={active === m}
                onClick={() => setActive(m)}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') setActive(m)
                }}
                className={cn(
                  'bg-surface shadow-soft ease-spring flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-[transform,box-shadow,background-color] duration-(--dur-base) active:scale-[0.98]',
                  active === m && cn('ring-2', selectedClass[m]),
                )}
              >
                <IconTile icon={moduleMeta[m].icon} tone={m} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{moduleMeta[m].label}</span>
                  <span className="text-tiny text-muted block">{modules[m].example}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-col items-center gap-2" aria-live="polite">
          <span
            key={active}
            className="animate-pop-in bg-surface text-caption shadow-card rounded-2xl px-3 py-1.5 font-semibold"
          >
            {current.say}
          </span>
          <Mascot
            key={`${active}-m`}
            mood={current.mood}
            size={140}
            character={character}
            className="animate-fade-in"
          />
        </div>
      </div>
    </WelcomeSection>
  )
}
