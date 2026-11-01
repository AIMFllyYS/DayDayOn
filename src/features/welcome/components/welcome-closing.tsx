'use client'

import type { ReactNode } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { IconTile } from '@/components/ui/badge'
import type { IconName } from '@/components/ui/icon'
import type { Tone } from '@/components/ui/tone'
import { useWelcomeMascot } from './mascot-context'
import { WelcomeSection } from './welcome-section'

const promises: { icon: IconName; tone: Tone; title: string; body: string }[] = [
  {
    icon: 'camera',
    tone: 'diet',
    title: '照片看完就忘',
    body: '拍的照片只在内存里给 AI 看一眼，只留下识别出的文字，不存图、不进日志。',
  },
  {
    icon: 'trophy',
    tone: 'study',
    title: '上不上榜你决定',
    body: '排行榜只显示昵称、头像和打卡天数，不想公开随时关掉。',
  },
  {
    icon: 'download',
    tone: 'exercise',
    title: '数据随时带走',
    body: '在「我的」里一键导出全部记录；注销账号会删除所有数据。',
  },
]

/** 隐私承诺：都是 ADR-0002 里的真实做法，不是宣传语 */
export function WelcomePrivacy() {
  return (
    <WelcomeSection id="privacy" ann="welcome.privacy" eyebrow="放心用" title="你的记录只属于你">
      <ul className="grid gap-3 @2xl:grid-cols-3">
        {promises.map((p) => (
          <li key={p.title} className="bg-surface shadow-soft flex flex-col gap-2 rounded-2xl p-4">
            <IconTile icon={p.icon} tone={p.tone} />
            <p className="font-semibold">{p.title}</p>
            <p className="text-caption text-muted">{p.body}</p>
          </li>
        ))}
      </ul>
    </WelcomeSection>
  )
}

/** 收尾：静态团团 + 主按钮（按钮由页面根据是否登录传入） */
export function WelcomeClosing({ cta }: { cta: ReactNode }) {
  const { character } = useWelcomeMascot()
  return (
    <section
      data-ann="welcome.closing"
      aria-labelledby="closing-title"
      className="bg-surface shadow-sticker my-10 flex flex-col items-center gap-3 rounded-3xl px-6 py-10 text-center"
    >
      <Mascot mood="sleepy" size={96} floating character={character} />
      <h2 id="closing-title" className="text-title font-bold">
        团团在等你
      </h2>
      <p className="text-body text-muted max-w-sm">
        用学校邮箱收个验证码就能开始，第一天从一件小事打起。
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">{cta}</div>
    </section>
  )
}
