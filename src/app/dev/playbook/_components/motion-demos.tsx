'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Mascot } from '@/components/mascot/mascot'
import { Stamp } from '@/components/ui/stamp'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Splash } from '@/components/layout/splash'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import type { SplashGreeting } from '@/lib/splash'
import { PhoneFrame } from './device-frame'

const presets = [
  { cls: 'animate-fade-in', name: 'fade-in', use: '内容替换、展开区' },
  { cls: 'animate-fade-up', name: 'fade-up', use: '页面和卡片进场（可错开 60ms）' },
  { cls: 'animate-pop-in', name: 'pop-in', use: '弹出层、气泡、新出现的徽章' },
  { cls: 'animate-sheet-up', name: 'sheet-up', use: '手机底部弹层' },
  { cls: 'animate-stamp', name: 'stamp', use: '打卡成功盖章（庆祝时刻）' },
  { cls: 'animate-wiggle', name: 'wiggle', use: '提醒注意：输入有误、未完成' },
  { cls: 'animate-breathe', name: 'breathe', use: 'AI 思考中的呼吸点（循环）' },
  { cls: 'animate-float', name: 'float', use: '吉祥物待机、空状态（循环）' },
  { cls: 'animate-shimmer bg-shimmer', name: 'shimmer', use: '骨架屏、进行中的扫光（循环）' },
] as const

/** 动画预设：点"重播"换 key，让元素重新挂载 */
export function PresetGallery() {
  const [round, setRound] = useState(0)
  return (
    <div>
      <Button variant="secondary" size="sm" icon="loader" onClick={() => setRound((r) => r + 1)}>
        全部重播
      </Button>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {presets.map((p) => (
          <li
            key={p.name}
            data-ann={`playbook.motion.preset.${p.name}`}
            className="border-border bg-surface flex flex-col overflow-hidden rounded-2xl border"
          >
            <div className="bg-paper flex h-28 items-center justify-center overflow-hidden">
              {p.name === 'stamp' ? (
                <Stamp key={round} caption="10.31" animate size={72} />
              ) : (
                <span
                  key={round}
                  className={cn('bg-primary shadow-primary block size-14 rounded-2xl', p.cls)}
                />
              )}
            </div>
            <div className="border-border border-t px-3 py-2">
              <p className="text-tiny font-mono font-semibold">{p.cls.split(' ')[0]}</p>
              <p className="text-tiny text-muted">{p.use}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

const easings = [
  { cls: 'ease-standard', name: 'standard', use: '颜色、透明度等普通过渡' },
  { cls: 'ease-out-soft', name: 'out-soft', use: '进场：快出慢停' },
  { cls: 'ease-in-soft', name: 'in-soft', use: '退场：慢起快走' },
  { cls: 'ease-spring', name: 'spring', use: '按压回弹、开关、选中（有过冲）' },
] as const

/** 缓动对比：为了看清曲线，演示统一放慢到 700ms */
export function EasingDemo() {
  const [on, setOn] = useState(false)
  return (
    <div className="border-border bg-surface rounded-2xl border p-4">
      <Button size="sm" variant="soft" onClick={() => setOn((v) => !v)}>
        {on ? '回到起点' : '播放'}
      </Button>
      <ul className="mt-4 grid gap-3">
        {easings.map((e) => (
          <li key={e.name} data-ann={`playbook.motion.ease.${e.name}`} className="grid gap-1">
            <div className="text-tiny flex items-baseline justify-between">
              <span className="font-mono font-semibold">{e.cls}</span>
              <span className="text-muted">{e.use}</span>
            </div>
            <div className="bg-surface-sunken relative h-8 rounded-full">
              <span
                className={cn(
                  'bg-primary shadow-primary absolute top-1 left-1 size-6 rounded-full transition-[left] duration-700',
                  e.cls,
                )}
                style={{ left: on ? 'calc(100% - 1.75rem)' : '0.25rem' }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

const greetingOptions = [
  { value: 'morning', label: '早上' },
  { value: 'day', label: '白天' },
  { value: 'night', label: '深夜' },
] as const satisfies readonly { value: SplashGreeting; label: string }[]

/** 开屏（ADR-0022）：放在手机框里，点"重播"重新挂载；真实环境只在 APK / 已安装 PWA 冷启动时出现 */
export function SplashDemo() {
  const [round, setRound] = useState(0)
  const [greeting, setGreeting] = useState<SplashGreeting>('morning')
  return (
    <div className="flex flex-col gap-3" data-ann="playbook.motion.splash">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" icon="loader" onClick={() => setRound((r) => r + 1)}>
          重播开屏
        </Button>
        <SegmentedControl
          options={greetingOptions}
          value={greeting}
          onValueChange={(g) => {
            setGreeting(g)
            setRound((r) => r + 1)
          }}
          label="问候时段"
          size="sm"
          className="w-56"
        />
      </div>
      <PhoneFrame label="开屏 · 约 1.7 秒">
        <div className="text-caption text-muted flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-heading text-foreground font-bold">开屏下面是页面</p>
          <p>开屏挖开以后露出这里：未登录是落地页，已登录是主页</p>
        </div>
        <Splash key={round} preview greeting={greeting} />
      </PhoneFrame>
    </div>
  )
}

/** 交互反馈：全站统一的按压、悬停、开关、庆祝 */
export function FeedbackDemo() {
  const [checked, setChecked] = useState(true)
  const [stampKey, setStampKey] = useState(0)
  const [done, setDone] = useState(false)
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card
        variant="outline"
        data-ann="playbook.motion.feedback.press"
        className="flex flex-col gap-2"
      >
        <p className="text-caption font-semibold">按压回弹</p>
        <p className="text-tiny text-muted">active:scale-[0.96] + ease-spring + dur-fast</p>
        <div className="flex gap-2">
          <Button>按住我</Button>
          <Button variant="secondary">次按钮</Button>
        </div>
      </Card>
      <Card
        variant="outline"
        interactive
        data-ann="playbook.motion.feedback.hover"
        className="flex flex-col gap-1"
      >
        <p className="text-caption font-semibold">可点卡片</p>
        <p className="text-tiny text-muted">悬停上浮 2px + float 阴影；按下缩到 0.98</p>
      </Card>
      <Card
        variant="outline"
        data-ann="playbook.motion.feedback.switch"
        className="flex items-center gap-3"
      >
        <div className="flex-1">
          <p className="text-caption font-semibold">开关</p>
          <p className="text-tiny text-muted">滑块用 spring，轨道颜色用 standard</p>
        </div>
        <Switch checked={checked} onCheckedChange={setChecked} label="演示开关" />
      </Card>
      <Card
        variant="outline"
        data-ann="playbook.motion.feedback.celebrate"
        className="flex items-center gap-3"
      >
        <div className="relative">
          <Mascot mood={done ? 'cheer' : 'happy'} size={64} />
          {done && <Stamp key={stampKey} animate size={52} className="absolute -top-2 -right-6" />}
        </div>
        <div className="flex-1">
          <p className="text-caption font-semibold">打卡成功</p>
          <p className="text-tiny text-muted">盖章 + 吉祥物欢呼，只在完成打卡的那一刻出现</p>
        </div>
        <Button
          size="sm"
          icon="check"
          onClick={() => {
            setDone(true)
            setStampKey((k) => k + 1)
          }}
        >
          打卡
        </Button>
      </Card>
    </div>
  )
}
