import { useId } from 'react'
import { cn } from '@/lib/cn'

/*
 * 吉祥物：糯米团子，两个形象共用身体和表情——团团（樱花蝴蝶结）和墩墩（小棒球帽），见 MascotCharacter。
 * 这里只负责按参数画出一帧（表情、视线、眨眼、腮红、手臂姿势），不含任何状态和动画；
 * 静态展示用 <Mascot>，可互动的用 <InteractivePet>。
 *
 * 能对应到设计 token 的颜色都用 var(--…)；团子皮肤、叶子、缎带暗部、泪滴这几种插画专用色只在本文件出现。
 */
export type MascotMood =
  'happy' | 'cheer' | 'sleepy' | 'thinking' | 'love' | 'surprised' | 'shy' | 'sad' | 'eating'

export const mascotMoods: { mood: MascotMood; label: string }[] = [
  { mood: 'happy', label: '开心' },
  { mood: 'cheer', label: '欢呼' },
  { mood: 'love', label: '喜欢' },
  { mood: 'shy', label: '害羞' },
  { mood: 'eating', label: '吃东西' },
  { mood: 'thinking', label: '思考中' },
  { mood: 'surprised', label: '吓一跳' },
  { mood: 'sleepy', label: '犯困' },
  { mood: 'sad', label: '失落' },
]

/**
 * 手臂姿势。rest 自然下垂；wave 右手挥动；up 双手举高；hug 双手抱在胸前；
 * cover 双手捂脸；think 右手托下巴；hold 双手捧到嘴边；startle 双手张开；droop 无力下垂。
 */
export type MascotArm =
  'rest' | 'wave' | 'up' | 'hug' | 'cover' | 'think' | 'hold' | 'startle' | 'droop'

/** 没有指定手臂时，按表情给一个默认姿势 */
const moodArm: Record<MascotMood, MascotArm> = {
  happy: 'rest',
  cheer: 'up',
  love: 'hug',
  shy: 'cover',
  eating: 'hold',
  thinking: 'think',
  surprised: 'startle',
  sleepy: 'rest',
  sad: 'droop',
}

/*
 * 手臂画在身体前面，绕肩膀转动。角度是相对自然下垂的旋转量（顺时针为正）。
 * 之前手臂画在身体后面、转轴在身体里，举起来就被身体挡住了，所以改成前置 + 肩膀转轴。
 */
const SHOULDER_L = { x: 37, y: 90 }
const SHOULDER_R = { x: 123, y: 90 }
const armAngle: Record<MascotArm, [left: number, right: number]> = {
  rest: [0, 0],
  wave: [0, -118],
  up: [112, -112],
  hug: [-72, 72],
  cover: [-108, 108],
  think: [0, 96],
  hold: [-96, 96],
  startle: [58, -58],
  droop: [-14, 14],
}

export interface MascotSvgProps {
  mood?: MascotMood
  /** 视线方向，-1 到 1；思考时会被覆盖成看向右上 */
  look?: { x: number; y: number }
  blink?: boolean
  /** 腮红强度 0–1，被抚摸时变红 */
  blush?: number
  /** 不传时按表情自动选姿势 */
  arm?: MascotArm
  /** 形象：团团（默认）/ 墩墩 */
  character?: MascotCharacter
  size?: number
  /** 读屏名称；不传时作为装饰图形 */
  label?: string
  className?: string
}

/**
 * 两个形象（2026-11-01 评审：用户可以选陪伴自己的小伙伴）。
 * 团团：偏女孩，樱花粉波点蝴蝶结别在头顶左侧，头顶小芽。
 * 墩墩：偏男孩，雾蓝色棒球帽（帽檐朝右）+ 帽顶一片小叶子，眉毛更有精神，腮红淡一些。
 * 身体、表情、手臂两者完全共用，只换头饰和少量细节。
 */
export type MascotCharacter = 'tuan' | 'dun'

export const mascotCharacters: { id: MascotCharacter; name: string; note: string }[] = [
  { id: 'tuan', name: '团团', note: '樱花蝴蝶结，软软糯糯' },
  { id: 'dun', name: '墩墩', note: '小棒球帽，元气满满' },
]

export const characterName = (c: MascotCharacter) =>
  mascotCharacters.find((m) => m.id === c)?.name ?? '团团'

const INK = 'var(--foreground)'
const SKIN = '#fbead8'
const SKIN_LINE = '#e1c6a8'
// 腮红、嘴巴是插画专用色，不跟随主题色（主题换成抹茶绿时腮红不能变绿）
const BLUSH = '#f4a091'
const MOUTH = '#9b4a3a'
const TONGUE = '#f28b74'
const EYE_L = { x: 60, y: 80 }
const EYE_R = { x: 100, y: 80 }

export function MascotSvg({
  mood = 'happy',
  look = { x: 0, y: 0 },
  blink = false,
  blush = 0.3,
  arm,
  character = 'tuan',
  size = 96,
  label,
  className,
}: MascotSvgProps) {
  // 同一页面有多只团团时渐变 id 不能重复；useId 的返回值含特殊字符，去掉后才能放进 url(#…)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const gaze = mood === 'thinking' ? { x: 0.7, y: -0.9 } : look
  const dx = Math.max(-1, Math.min(1, gaze.x)) * 3.2
  const dy = Math.max(-1, Math.min(1, gaze.y)) * 2.6
  const cheek =
    mood === 'shy' || mood === 'love'
      ? 1
      : Math.min(1, Math.max(0, blush)) * (character === 'dun' ? 0.6 : 1)
  const cheekScale = mood === 'eating' ? 1.35 : 1
  const pose = arm ?? moodArm[mood]
  const [leftDeg, rightDeg] = armAngle[pose]

  return (
    <svg
      viewBox="0 0 160 160"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('shrink-0 overflow-visible', className)}
    >
      <defs>
        <radialGradient id={`${uid}-body`} cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fffefb" />
          <stop offset="55%" stopColor="#fff4e6" />
          <stop offset="100%" stopColor="#f5dfc6" />
        </radialGradient>
        <radialGradient id={`${uid}-paw`} cx="40%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fffaf3" />
          <stop offset="100%" stopColor={SKIN} />
        </radialGradient>
        <radialGradient id={`${uid}-cheek`}>
          <stop offset="0%" stopColor={BLUSH} stopOpacity="0.85" />
          <stop offset="100%" stopColor={BLUSH} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-leaf`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a6dfc4" />
          <stop offset="100%" stopColor="#5fb48e" />
        </linearGradient>
        <linearGradient id={`${uid}-ribbon`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbc4d3" />
          <stop offset="100%" stopColor="var(--custom)" />
        </linearGradient>
        <linearGradient id={`${uid}-cap`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b9d7f1" />
          <stop offset="100%" stopColor="var(--study)" />
        </linearGradient>
      </defs>

      {/* 地面影子 */}
      <ellipse cx="80" cy="143" rx="40" ry="6" fill={INK} opacity="0.09" />

      {/* 小脚 */}
      <g fill="#f3dcc4" stroke={SKIN_LINE} strokeWidth="2">
        <ellipse cx="62" cy="134" rx="11" ry="6.5" />
        <ellipse cx="98" cy="134" rx="11" ry="6.5" />
      </g>

      {/* 身体 */}
      <path
        d="M80 30c31 0 54 25 54 58 0 28-23 46-54 46S26 116 26 88c0-33 23-58 54-58Z"
        fill={`url(#${uid}-body)`}
        stroke={SKIN_LINE}
        strokeWidth="2.5"
      />
      <ellipse cx="80" cy="110" rx="30" ry="18" fill="#fff" opacity="0.42" />
      <ellipse
        cx="57"
        cy="52"
        rx="14"
        ry="7.5"
        fill="#fff"
        opacity="0.8"
        transform="rotate(-28 57 52)"
      />
      <circle cx="74" cy="43" r="3" fill="#fff" opacity="0.85" />

      {character === 'dun' ? <DunCap uid={uid} /> : <TuanBow uid={uid} />}

      {/* 腮红 */}
      <g opacity={0.45 + cheek * 0.55}>
        <ellipse
          cx="47"
          cy="94"
          rx={10 * cheekScale}
          ry={6.5 * cheekScale}
          fill={`url(#${uid}-cheek)`}
        />
        <ellipse
          cx="113"
          cy="94"
          rx={10 * cheekScale}
          ry={6.5 * cheekScale}
          fill={`url(#${uid}-cheek)`}
        />
      </g>

      <Eyes mood={mood} blink={blink} dx={dx} dy={dy} />
      {character === 'dun' && <DunBrows mood={mood} />}
      <Mouth mood={mood} />
      <Extras mood={mood} />

      {/* 手臂：最后画，保证任何姿势都不会被身体挡住 */}
      <Arm side="left" deg={leftDeg} uid={uid} />
      <Arm side="right" deg={rightDeg} uid={uid} waving={pose === 'wave'} />
    </svg>
  )
}

/**
 * 团团的头饰：两片圆叶的小芽 + 樱花粉波点蝴蝶结。
 * 2026-11-01 评审：蝴蝶结从头侧上移到头顶右上，小芽从尖叶改成圆叶，整体更软更像女孩子。
 */
function TuanBow({ uid }: { uid: string }) {
  return (
    <g>
      {/* 小芽：一根短茎 + 两片圆叶 */}
      <path
        d="M78 31c-.4-5 .4-9 2.6-12"
        fill="none"
        stroke="#3f8a69"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M80.6 19c1-6.5 7.5-10 13.5-8.5-.6 6.5-7.5 10.5-13.5 8.5Z"
        fill={`url(#${uid}-leaf)`}
      />
      <path
        d="M79.6 20.5c-3.2-5.6-9.8-7.2-14.6-4.4 2.6 5.4 9.4 7.6 14.6 4.4Z"
        fill={`url(#${uid}-leaf)`}
        opacity="0.85"
      />
      <path
        d="M83 17c2.6-2.2 5.6-3.4 8.6-3.6"
        fill="none"
        stroke="#3f8a69"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* 蝴蝶结：别在头顶右上，樱花粉缎带 + 白色波点 + 两条飘带 */}
      <g transform="translate(104 35) rotate(16) scale(0.95)">
        <g fill={`url(#${uid}-ribbon)`} stroke="#d97c97" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M-1.5 3 -7 14.5l4-1.2 1.6 3.4L1 4Z" />
          <path d="M1.5 3 6.5 14l-3.8-.9-1.4 3.2L-1 4Z" />
          <path d="M0 0C-4-9-16-13-19.5-5.5-21.5-.5-16 7 0 2.5Z" />
          <path d="M0 0C4-9 16-13 19.5-5.5 21.5-.5 16 7 0 2.5Z" />
        </g>
        {/* 缎带折痕 */}
        <g fill="none" stroke="#d97c97" strokeWidth="1.2" strokeLinecap="round" opacity="0.7">
          <path d="M-1.5 1C-6-3.5-11-5-14.5-3.5M1.5 1C6-3.5 11-5 14.5-3.5" />
        </g>
        <g fill="#fff" opacity="0.9">
          <circle cx="-12" cy="-4.5" r="1.4" />
          <circle cx="-7" cy="-1" r="1" />
          <circle cx="12" cy="-4.5" r="1.4" />
          <circle cx="7.5" cy="-7" r="1" />
        </g>
        <ellipse
          cx="0"
          cy="1.2"
          rx="3.8"
          ry="4.4"
          fill="#e889a4"
          stroke="#d97c97"
          strokeWidth="1.4"
        />
        <ellipse cx="-1" cy="-0.3" rx="1.2" ry="1.5" fill="#fff" opacity="0.6" />
      </g>
    </g>
  )
}

/** 墩墩的头饰：雾蓝色棒球帽（帽檐朝右）+ 帽顶一片小叶子 */
function DunCap({ uid }: { uid: string }) {
  return (
    <g strokeLinejoin="round">
      {/* 帽顶小叶子 */}
      <path
        d="M80 21c0-3 .6-5.6 2.2-7.6"
        fill="none"
        stroke="#3f8a69"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M82 13.6c2.4-5.6 8.6-7.6 13.6-6-1.6 5.6-8 8.6-13.6 6Z" fill={`url(#${uid}-leaf)`} />
      {/* 帽檐 */}
      <path
        d="M102 45.5c13-3.6 26-2.2 34 3.4-6.6 6.2-20.4 7.4-33 4Z"
        fill="#6f9bc8"
        stroke="#4f78a3"
        strokeWidth="2"
      />
      {/* 帽身 */}
      <path
        d="M45 50c-1-17 14-29 35-29s36 12 35 29c-21-6.6-49-6.6-70 0Z"
        fill={`url(#${uid}-cap)`}
        stroke="#4f78a3"
        strokeWidth="2.2"
      />
      {/* 分片缝线和顶扣 */}
      <g fill="none" stroke="#4f78a3" strokeWidth="1.3" strokeLinecap="round" opacity="0.55">
        <path d="M80 22c-2.6 7-3 15-1.6 22.4M80 22c8 4.6 12.6 12 13.8 20.4" />
      </g>
      <circle cx="80" cy="21.6" r="2.8" fill="#4f78a3" />
      {/* 帽子正面的小星星徽章 */}
      <path
        d="m64 37.5 1.3 2.7 3 .4-2.2 2 .6 3-2.7-1.4-2.7 1.4.6-3-2.2-2 3-.4z"
        fill="var(--diet)"
        stroke="#d9a93a"
        strokeWidth="0.9"
      />
      {/* 高光 */}
      <path
        d="M54 39c3-7 9-11.5 16-13"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.55"
      />
    </g>
  )
}

/** 墩墩的眉毛：短而粗，显得有精神；失落表情自带眉毛，不重复画 */
function DunBrows({ mood }: { mood: MascotMood }) {
  if (mood === 'sad') return null
  const lift = mood === 'surprised' ? -3 : 0
  return (
    <g
      fill="none"
      stroke={INK}
      strokeWidth="3"
      strokeLinecap="round"
      transform={`translate(0 ${lift})`}
    >
      <path d="M53 66.5q6-3 12.5-1.2M94.5 65.3q6.5-1.8 12.5 1.2" />
    </g>
  )
}

/** 一只小手：从肩膀垂下的圆润小臂，末端有一点肉垫高光 */
function Arm({
  side,
  deg,
  uid,
  waving = false,
}: {
  side: 'left' | 'right'
  deg: number
  uid: string
  waving?: boolean
}) {
  const s = side === 'left' ? SHOULDER_L : SHOULDER_R
  // 自然下垂时稍微向外张开
  const tilt = side === 'left' ? 24 : -24
  return (
    <g
      className={cn(waving && 'animate-pet-wave')}
      style={{
        transform: `rotate(${deg}deg)`,
        transformOrigin: `${s.x}px ${s.y}px`,
        transformBox: 'view-box',
        transition: 'transform 360ms var(--ease-spring)',
      }}
    >
      <g transform={`rotate(${tilt} ${s.x} ${s.y})`}>
        <path
          d={`M${s.x - 9} ${s.y + 2}c-1.5 9-1 17 1.5 22.5 2 4.4 5.2 6.5 7.5 6.5s5.5-2.1 7.5-6.5c2.5-5.5 3-13.5 1.5-22.5-1-5-4.2-7-9-7s-8 2-9 7Z`}
          fill={`url(#${uid}-paw)`}
          stroke={SKIN_LINE}
          strokeWidth="2.2"
        />
        <ellipse cx={s.x} cy={s.y + 24} rx="4.2" ry="2.6" fill="var(--custom)" opacity="0.45" />
      </g>
    </g>
  )
}

function OpenEye({ x, y, big = false }: { x: number; y: number; big?: boolean }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={big ? 7.5 : 6.5} ry={big ? 9.5 : 8} fill={INK} />
      <circle cx={x + 2.3} cy={y - 3} r={big ? 2.8 : 2.4} fill="#fff" />
      <circle cx={x - 2} cy={y + 3.2} r="1.2" fill="#fff" opacity="0.8" />
    </g>
  )
}

function HeartEye({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x} ${y + 7}s-8-4.8-8-10.2a4.4 4.4 0 0 1 8-2.5 4.4 4.4 0 0 1 8 2.5c0 5.4-8 10.2-8 10.2Z`}
      fill="#e0705a"
    />
  )
}

function Eyes({
  mood,
  blink,
  dx,
  dy,
}: {
  mood: MascotMood
  blink: boolean
  dx: number
  dy: number
}) {
  const line = { fill: 'none', stroke: INK, strokeWidth: 3.2, strokeLinecap: 'round' as const }
  if (mood === 'sleepy') {
    return (
      <g {...line}>
        <path d="M53 80q7 6 14 0M93 80q7 6 14 0" />
      </g>
    )
  }
  if (mood === 'cheer' || mood === 'eating') {
    return (
      <g {...line}>
        <path d="M53 83q7-9 14 0M93 83q7-9 14 0" />
      </g>
    )
  }
  if (mood === 'shy') {
    return (
      <g {...line}>
        <path d="m55 75 9 5-9 5M105 75l-9 5 9 5" />
      </g>
    )
  }
  if (mood === 'love') {
    return (
      <g transform={`translate(${dx} ${dy})`}>
        <HeartEye x={EYE_L.x} y={EYE_L.y} />
        <HeartEye x={EYE_R.x} y={EYE_R.y} />
      </g>
    )
  }
  if (blink) {
    return (
      <g {...line} transform={`translate(${dx} ${dy})`}>
        <path d="M54 81q6 3.5 12 0M94 81q6 3.5 12 0" />
      </g>
    )
  }
  return (
    <g transform={`translate(${dx} ${dy})`}>
      {mood === 'sad' && (
        <g {...line} strokeWidth={2.6}>
          <path d="M51 67.5 61 71M109 67.5 99 71" />
        </g>
      )}
      <OpenEye x={EYE_L.x} y={EYE_L.y} big={mood === 'surprised'} />
      <OpenEye x={EYE_R.x} y={EYE_R.y} big={mood === 'surprised'} />
    </g>
  )
}

function Mouth({ mood }: { mood: MascotMood }) {
  const line = { fill: 'none', stroke: INK, strokeWidth: 3, strokeLinecap: 'round' as const }
  switch (mood) {
    case 'cheer':
    case 'love':
      return (
        <g>
          <path d="M70 94q10 13 20 0Z" fill={MOUTH} />
          <path d="M75.5 99.5q4.5 3.8 9 0" fill={TONGUE} />
        </g>
      )
    case 'surprised':
      return <ellipse cx="80" cy="100" rx="4.5" ry="5.5" fill={MOUTH} />
    case 'sleepy':
      return <path d="M76 98.5q4 2.5 8 0" {...line} />
    case 'thinking':
      return <path d="M75 99q5-2 10 0" {...line} />
    case 'shy':
      return <path d="M72 98q2-2.5 4 0t4 0 4 0 4 0" {...line} strokeWidth={2.6} />
    case 'sad':
      return <path d="M73 101q7-6 14 0" {...line} />
    case 'eating':
      return (
        <g
          className="animate-pet-chew"
          style={{ transformOrigin: '80px 98px', transformBox: 'view-box' }}
        >
          <path d="M73 96q7 6 14 0" {...line} />
        </g>
      )
    default:
      return <path d="M72 95q4 4.5 8 0 4 4.5 8 0" {...line} />
  }
}

function Extras({ mood }: { mood: MascotMood }) {
  switch (mood) {
    case 'cheer':
      return (
        <g fill="var(--diet)">
          <path d="m20 34 2.6 6 6 2.6-6 2.6-2.6 6-2.6-6-6-2.6 6-2.6z" />
          <path d="m140 26 1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z" />
          <circle cx="132" cy="52" r="2.5" fill="var(--study)" />
          <circle cx="28" cy="62" r="2" fill="var(--custom)" />
        </g>
      )
    case 'love':
      return (
        <path
          d="M134 40s-7-4-7-9a3.8 3.8 0 0 1 7-2 3.8 3.8 0 0 1 7 2c0 5-7 9-7 9Z"
          fill="var(--custom)"
        />
      )
    case 'sleepy':
      return (
        <g>
          <circle
            cx="97"
            cy="99"
            r="5"
            fill="var(--study-soft)"
            stroke="var(--study)"
            strokeWidth="1.5"
            opacity="0.9"
          />
          <text
            x="118"
            y="44"
            fill="var(--sleep-ink)"
            fontSize="20"
            fontWeight="700"
            fontFamily="var(--font-display)"
          >
            z
          </text>
          <text
            x="132"
            y="28"
            fill="var(--sleep-ink)"
            fontSize="14"
            fontWeight="700"
            fontFamily="var(--font-display)"
            opacity="0.6"
          >
            z
          </text>
        </g>
      )
    case 'thinking':
      return (
        <g fill="var(--surface)" stroke="var(--border-strong)" strokeWidth="2">
          <circle cx="128" cy="48" r="4" />
          <circle cx="139" cy="33" r="6.5" />
        </g>
      )
    case 'surprised':
      return (
        <path
          d="M120 54c3 4 4.5 7 4.5 9a4.5 4.5 0 0 1-9 0c0-2 1.5-5 4.5-9Z"
          fill="#a8d4f2"
          stroke="var(--study)"
          strokeWidth="1.2"
        />
      )
    case 'sad':
      return <path d="M56 91c2 3 3 5 3 6.4a3 3 0 0 1-6 0c0-1.4 1-3.4 3-6.4Z" fill="#a8d4f2" />
    case 'eating':
      return (
        <g fill="var(--diet)">
          <circle cx="66" cy="112" r="2" />
          <circle cx="93" cy="115" r="1.6" />
          <circle cx="86" cy="120" r="1.3" />
        </g>
      )
    default:
      return null
  }
}
