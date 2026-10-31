'use client'

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react'
import { cn } from '@/lib/cn'
import { MascotSvg, type MascotArm, type MascotMood } from './mascot-svg'

export type PetAction =
  | 'hop'
  | 'jump'
  | 'spin'
  | 'nod'
  | 'shake'
  | 'wave'
  | 'shy'
  | 'love'
  | 'eat'
  | 'think'
  | 'surprise'
  | 'cheer'
  | 'sleep'

type Fx = 'heart' | 'sparkle' | 'crumb' | 'note'

interface ActionDef {
  label: string
  anim?: string
  mood?: MascotMood
  arm?: MascotArm
  ms: number
  say: string[]
  fx?: Fx
}

/** 动作表：动画类名都定义在 globals.css 的 pet-* 预设里 */
export const petActions: Record<PetAction, ActionDef> = {
  hop: { label: '蹦一下', anim: 'animate-pet-hop', ms: 520, say: ['嘿！', '在呢～'] },
  jump: {
    label: '大跳',
    anim: 'animate-pet-jump',
    mood: 'cheer',
    arm: 'up',
    ms: 900,
    say: ['飞～', '蓄力完成！'],
    fx: 'sparkle',
  },
  spin: {
    label: '转圈',
    anim: 'animate-pet-spin',
    mood: 'cheer',
    ms: 900,
    say: ['转圈圈～'],
    fx: 'sparkle',
  },
  nod: { label: '点头', anim: 'animate-pet-nod', ms: 700, say: ['嗯嗯！', '收到～'] },
  shake: {
    label: '摇头',
    anim: 'animate-pet-shake',
    mood: 'shy',
    arm: 'rest',
    ms: 650,
    say: ['不要不要～'],
  },
  wave: { label: '挥手', arm: 'wave', ms: 1500, say: ['你好呀！', '回来啦～'] },
  shy: {
    label: '害羞',
    // 缩成一小团 + 双手捂脸（捂脸姿势由 shy 表情自动带出）
    anim: 'animate-pet-shrink',
    mood: 'shy',
    ms: 1400,
    say: ['不好意思…', '嘿嘿…'],
    fx: 'heart',
  },
  love: {
    label: '比心',
    anim: 'animate-pet-hop',
    mood: 'love',
    ms: 1500,
    say: ['最喜欢你了'],
    fx: 'heart',
  },
  eat: { label: '吃东西', mood: 'eating', ms: 1800, say: ['好吃！', '吧唧吧唧'], fx: 'crumb' },
  think: {
    label: '思考',
    anim: 'animate-pet-sway',
    mood: 'thinking',
    ms: 2200,
    say: ['让我想想…'],
  },
  surprise: { label: '吓一跳', anim: 'animate-pet-hop', mood: 'surprised', ms: 900, say: ['哇！'] },
  cheer: {
    label: '庆祝打卡',
    anim: 'animate-pet-jump',
    mood: 'cheer',
    arm: 'up',
    ms: 1300,
    say: ['今天也打卡啦！'],
    fx: 'sparkle',
  },
  sleep: { label: '睡觉', mood: 'sleepy', ms: 0, say: ['困了…'], fx: 'note' },
}

export type PetEventType =
  | 'click'
  | 'double-click'
  | 'long-press'
  | 'pet'
  | 'hover'
  | 'feed'
  | 'fall-asleep'
  | 'wake-up'
  | 'action'

export interface PetEvent {
  type: PetEventType
  action?: PetAction
}

export interface PetHandle {
  play: (action: PetAction) => void
  /** 判断屏幕坐标是否落在团团身上（投喂用） */
  hitTest: (clientX: number, clientY: number) => boolean
  feed: () => void
}

interface InteractivePetProps {
  size?: number
  ref?: Ref<PetHandle>
  onEvent?: (event: PetEvent) => void
  /** 多久没人理就睡着（毫秒），0 表示不睡 */
  idleSleepMs?: number
  /** 视线跟随鼠标 */
  lookAtPointer?: boolean
  /** 是否显示说话气泡 */
  speech?: boolean
  className?: string
}

interface Particle {
  id: number
  kind: Fx
  left: number
  drift: number
  delay: number
}

const LONG_PRESS_MS = 450
const DOUBLE_CLICK_MS = 300
const RUB_DISTANCE = 140

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T

/**
 * 可互动的团团。手势：悬停看向你、点击蹦一下、双击转圈、长按蓄力大跳、来回抚摸害羞冒爱心；
 * 一段时间没人理会睡着，点一下醒来。外部可以通过 ref.play(action) 触发动作（例如打卡成功时庆祝）。
 * 只对用户的操作做出反应，不会自己突然做大动作打扰用户（眨眼和呼吸除外）。
 */
export function InteractivePet({
  size = 160,
  ref,
  onEvent,
  idleSleepMs = 15000,
  lookAtPointer = true,
  speech = true,
  className,
}: InteractivePetProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [action, setAction] = useState<{ name: PetAction; seq: number } | null>(null)
  const [sleeping, setSleeping] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [charging, setCharging] = useState(false)
  const [blink, setBlink] = useState(false)
  const [blush, setBlush] = useState(0.3)
  const [look, setLook] = useState({ x: 0, y: 0 })
  const [bubble, setBubble] = useState<{ text: string; seq: number } | null>(null)
  const [particles, setParticles] = useState<Particle[]>([])

  const seq = useRef(0)
  const lastActive = useRef(0)
  const timers = useRef(new Set<number>())
  const press = useRef<{ x: number; y: number; moved: number; rubbed: boolean } | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const lastClick = useRef(0)
  const lastRub = useRef(0)

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, ms)
    timers.current.add(id)
  }

  const say = (text: string) => {
    if (!speech) return
    const n = ++seq.current
    setBubble({ text, seq: n })
    later(() => setBubble((b) => (b?.seq === n ? null : b)), 1800)
  }

  const burst = (kind: Fx, count = 5) => {
    const base = ++seq.current * 100
    const next = Array.from({ length: count }, (_, i) => ({
      id: base + i,
      kind,
      left: 25 + Math.random() * 50,
      drift: (Math.random() - 0.5) * 40,
      delay: i * 90,
    }))
    setParticles((p) => [...p, ...next])
    later(() => setParticles((p) => p.filter((x) => x.id < base || x.id >= base + count)), 1500)
  }

  const play = (name: PetAction) => {
    lastActive.current = Date.now()
    const def = petActions[name]
    if (name === 'sleep') {
      setSleeping(true)
      setAction(null)
      say(pick(def.say))
      onEvent?.({ type: 'fall-asleep' })
      return
    }
    setSleeping(false)
    const n = ++seq.current
    setAction({ name, seq: n })
    say(pick(def.say))
    if (def.fx) burst(def.fx, def.fx === 'sparkle' ? 7 : 5)
    if (name === 'shy' || name === 'love') setBlush(1)
    later(() => {
      setAction((a) => (a?.seq === n ? null : a))
      setBlush((b) => Math.max(0.3, b - 0.3))
    }, def.ms)
  }

  const rootRect = () => rootRef.current?.getBoundingClientRect()

  useImperativeHandle(ref, () => ({
    play,
    hitTest: (x, y) => {
      const r = rootRect()
      return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    },
    feed: () => {
      play('eat')
      onEvent?.({ type: 'feed', action: 'eat' })
    },
  }))

  // 卸载时清掉所有计时器
  useEffect(() => {
    const set = timers.current
    lastActive.current = Date.now()
    return () => set.forEach((id) => window.clearTimeout(id))
  }, [])

  // 随机眨眼：2.6–5.2 秒一次
  useEffect(() => {
    if (sleeping) return
    let t = 0
    const loop = () => {
      t = window.setTimeout(
        () => {
          setBlink(true)
          window.setTimeout(() => setBlink(false), 140)
          loop()
        },
        2600 + Math.random() * 2600,
      )
    }
    loop()
    return () => window.clearTimeout(t)
  }, [sleeping])

  // 没人理就睡着
  useEffect(() => {
    if (!idleSleepMs) return
    const t = window.setInterval(() => {
      if (!sleeping && !press.current && Date.now() - lastActive.current > idleSleepMs) {
        setSleeping(true)
        setAction(null)
        onEvent?.({ type: 'fall-asleep' })
      }
    }, 1000)
    return () => window.clearInterval(t)
  }, [idleSleepMs, sleeping, onEvent])

  // 视线跟随指针
  useEffect(() => {
    if (!lookAtPointer || sleeping) return
    let raf = 0
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const r = rootRef.current?.getBoundingClientRect()
        if (!r) return
        const cx = r.left + r.width / 2
        const cy = r.top + r.height * 0.45
        const clamp = (v: number) => Math.max(-1, Math.min(1, v))
        setLook({
          x: clamp((e.clientX - cx) / (r.width * 1.5)),
          y: clamp((e.clientY - cy) / (r.height * 1.5)),
        })
      })
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [lookAtPointer, sleeping])

  function clearLongPress() {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current)
    longPressTimer.current = null
  }

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    lastActive.current = Date.now()
    press.current = { x: e.clientX, y: e.clientY, moved: 0, rubbed: false }
    longPressTimer.current = window.setTimeout(() => {
      setCharging(true)
      say('蓄力中…')
    }, LONG_PRESS_MS)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const p = press.current
    if (!p) return
    p.moved += Math.hypot(e.clientX - p.x, e.clientY - p.y)
    p.x = e.clientX
    p.y = e.clientY
    if (p.moved > 10 && !charging) clearLongPress()
    // 来回抚摸：累计移动足够远就害羞，1.2 秒内只触发一次
    if (p.moved > RUB_DISTANCE && !charging && Date.now() - lastRub.current > 1200) {
      p.rubbed = true
      p.moved = 0
      lastRub.current = Date.now()
      setBlush((b) => Math.min(1, b + 0.35))
      play(Math.random() < 0.35 ? 'love' : 'shy')
      onEvent?.({ type: 'pet' })
    }
  }

  function onPointerUp() {
    const p = press.current
    press.current = null
    clearLongPress()
    lastActive.current = Date.now()
    if (charging) {
      setCharging(false)
      play('jump')
      onEvent?.({ type: 'long-press', action: 'jump' })
      return
    }
    if (!p || p.rubbed) return
    if (sleeping) {
      play('surprise')
      onEvent?.({ type: 'wake-up' })
      return
    }
    const now = Date.now()
    if (now - lastClick.current < DOUBLE_CLICK_MS) {
      lastClick.current = 0
      play('spin')
      onEvent?.({ type: 'double-click', action: 'spin' })
    } else {
      lastClick.current = now
      play('hop')
      onEvent?.({ type: 'click', action: 'hop' })
    }
  }

  const def = action ? petActions[action.name] : null
  const mood: MascotMood = def?.mood ?? (sleeping ? 'sleepy' : charging ? 'surprised' : 'happy')
  const bodyAnim = def?.anim ?? (charging ? 'animate-pet-squish' : 'animate-pet-breathe')

  return (
    <div
      ref={rootRef}
      className={cn('relative inline-flex select-none', className)}
      style={{ width: size, height: size }}
    >
      {bubble && (
        <span
          key={bubble.seq}
          className="animate-pop-in bg-surface text-caption shadow-card absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-2xl px-3 py-1.5 font-semibold whitespace-nowrap"
        >
          {bubble.text}
          <span className="bg-surface absolute -bottom-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45" />
        </span>
      )}

      <button
        type="button"
        aria-label="团团：点一下、双击、长按或来回抚摸都会有反应"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          press.current = null
          clearLongPress()
          setCharging(false)
        }}
        onPointerEnter={() => {
          setHovered(true)
          onEvent?.({ type: 'hover' })
        }}
        onPointerLeave={() => setHovered(false)}
        onClick={(e) => {
          // 键盘回车 / 空格触发时没有指针事件，detail 为 0
          if (e.detail === 0) play('hop')
        }}
        onContextMenu={(e) => e.preventDefault()}
        className="size-full touch-none rounded-full [-webkit-touch-callout:none]"
      >
        <div
          key={action?.seq ?? (sleeping ? 'sleep' : 'idle')}
          className={cn(bodyAnim, sleeping && '[animation-duration:4.8s]')}
          style={{
            transformOrigin: '50% 88%',
            // 悬停时朝指针方向微微倾斜
            rotate: hovered && !def ? `${look.x * 4}deg` : undefined,
            transition: 'rotate 200ms ease-out',
          }}
        >
          <MascotSvg
            mood={mood}
            look={look}
            blink={blink && !def?.mood}
            blush={blush}
            arm={def?.arm ?? (charging ? 'hug' : undefined)}
            size={size}
          />
        </div>
      </button>

      {particles.map((p) => (
        <span
          key={p.id}
          aria-hidden
          className="animate-pet-float-up pointer-events-none absolute top-[18%]"
          style={
            {
              left: `${p.left}%`,
              animationDelay: `${p.delay}ms`,
              '--drift': `${p.drift}px`,
            } as CSSProperties
          }
        >
          <FxGlyph kind={p.kind} />
        </span>
      ))}
    </div>
  )
}

function FxGlyph({ kind }: { kind: Fx }) {
  switch (kind) {
    case 'heart':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path
            d="M12 20s-7.5-4.4-7.5-9.8A4 4 0 0 1 12 8a4 4 0 0 1 7.5 2.2C19.5 15.6 12 20 12 20Z"
            fill="var(--custom)"
          />
        </svg>
      )
    case 'sparkle':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path
            d="M12 2c.8 5 3 7.2 8 8-5 .8-7.2 3-8 8-.8-5-3-7.2-8-8 5-.8 7.2-3 8-8Z"
            fill="var(--diet)"
          />
        </svg>
      )
    case 'crumb':
      return <span className="bg-diet block size-2 rounded-full" />
    default:
      return (
        <span className="font-display text-subhead text-sleep-ink font-bold" aria-hidden>
          z
        </span>
      )
  }
}
