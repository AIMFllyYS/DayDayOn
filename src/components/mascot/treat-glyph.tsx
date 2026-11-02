/*
 * 小零食插画与投喂反馈注册表：Playbook 的投喂演示、好友小窝零食架和落地页共用。
 * 能对应 token 的颜色都用 var(--…)；少量描边、海苔色是插画专用色（同 mascot-svg.tsx）。
 * 不同食物投喂给宠物时会触发不同的动作、粒子特效与专属台词。
 */

export interface TreatDef {
  id: 'onigiri' | 'strawberry' | 'cookie' | 'pudding' | 'dango' | 'milk'
  label: string
  /** 零食架上显示的简短风味/效果标签 */
  flavor: string
  /** 投喂后触发的动作类型 */
  action: 'eat' | 'love' | 'jump' | 'spin' | 'shy' | 'nod'
  /** 投喂后冒出的粒子特效 */
  fx: 'crumb' | 'heart' | 'sparkle' | 'note'
  /** 投喂后的专属说话气泡（≤8 字） */
  say: readonly string[]
}

export const treats: readonly TreatDef[] = [
  {
    id: 'onigiri',
    label: '海苔饭团',
    flavor: '饱腹蓄力跳',
    action: 'jump',
    fx: 'sparkle',
    say: ['能量满格！', '吃饱有力气～'],
  },
  {
    id: 'strawberry',
    label: '奶油草莓',
    flavor: '酸甜冒爱心',
    action: 'love',
    fx: 'heart',
    say: ['酸甜好幸福～', '最喜欢草莓！'],
  },
  {
    id: 'cookie',
    label: '黄油曲奇',
    flavor: '酥脆掉饼渣',
    action: 'eat',
    fx: 'crumb',
    say: ['咔嚓咔嚓～', '黄油味好香！'],
  },
  {
    id: 'pudding',
    label: '焦糖布丁',
    flavor: 'Q弹转圈圈',
    action: 'spin',
    fx: 'sparkle',
    say: ['duang～好弹', '甜到转圈圈！'],
  },
  {
    id: 'dango',
    label: '三色团子',
    flavor: '软糯害羞笑',
    action: 'shy',
    fx: 'heart',
    say: ['糯叽叽的…', '像咬了自己～'],
  },
  {
    id: 'milk',
    label: '晚安热奶',
    flavor: '暖胃乖乖点头',
    action: 'nod',
    fx: 'note',
    say: ['咕咚咕咚～', '肚子暖乎乎！'],
  },
] as const

export type TreatId = TreatDef['id']

export function getTreatDef(id?: TreatId): TreatDef {
  return treats.find((t) => t.id === id) ?? treats[1]
}

export function TreatGlyph({ id, size = 34 }: { id: TreatId; size?: number }) {
  switch (id) {
    case 'onigiri':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
          <path
            d="M20 5c5 0 15 15 15 22 0 5-5 8-15 8S5 32 5 27C5 20 15 5 20 5Z"
            fill="var(--surface)"
            stroke="var(--border-strong)"
            strokeWidth="2"
          />
          <path d="M12 25.5h16v9.5H12z" rx="1.5" fill="#4a5a52" />
          {/* 饭粒小高光 */}
          <circle cx="17" cy="15" r="1.2" fill="var(--border-strong)" />
          <circle cx="22.5" cy="18" r="1.2" fill="var(--border-strong)" />
        </svg>
      )
    case 'strawberry':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
          <path
            d="M20 12c8 0 13 4 13 9 0 8-8 15-13 15S7 29 7 21c0-5 5-9 13-9Z"
            fill="var(--custom)"
            stroke="#d97c97"
            strokeWidth="2"
          />
          <path d="M13 11c2-4 5-5 7-2 2-3 5-2 7 2-3 2-11 2-14 0Z" fill="var(--exercise)" />
          <g fill="var(--surface)">
            <circle cx="15" cy="21" r="1.2" />
            <circle cx="24" cy="19" r="1.2" />
            <circle cx="20" cy="27" r="1.2" />
            <circle cx="27" cy="26" r="1.2" />
          </g>
        </svg>
      )
    case 'pudding':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
          {/* 小白瓷盘 */}
          <ellipse
            cx="20"
            cy="31.5"
            rx="15"
            ry="3.8"
            fill="var(--surface)"
            stroke="var(--border-strong)"
            strokeWidth="1.8"
          />
          {/* 布丁主体 */}
          <path
            d="M9.5 30.5 12.5 13c.4-2 2.4-3.5 7.5-3.5s7.1 1.5 7.5 3.5l3 17.5c-6 2-15 2-21 0Z"
            fill="var(--diet)"
            stroke="#d9a93a"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* 焦糖淋面 */}
          <path
            d="M12.2 14.5c.4-2.5 2.6-5 7.8-5s7.4 2.5 7.8 5c-.6 2.8-2.6 3.2-4 1.6-1.2 2.4-3.8 2.4-5 0-1.4 1.8-3.8 1.4-6.6-1.6Z"
            fill="#8f5026"
            stroke="#6e3b19"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M15 20.5v5" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
        </svg>
      )
    case 'dango':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
          {/* 竹签 */}
          <path d="M8 32 32 8" stroke="#c59b6d" strokeWidth="2.4" strokeLinecap="round" />
          {/* 绿团子（抹茶） */}
          <circle
            cx="14"
            cy="26"
            r="5.6"
            fill="var(--exercise)"
            stroke="#569e7d"
            strokeWidth="1.8"
          />
          {/* 白团子（奶香） */}
          <circle
            cx="20"
            cy="20"
            r="5.6"
            fill="var(--surface)"
            stroke="var(--border-strong)"
            strokeWidth="1.8"
          />
          {/* 粉团子（樱花） */}
          <circle cx="26" cy="14" r="5.6" fill="var(--custom)" stroke="#d97c97" strokeWidth="1.8" />
          <circle cx="24.2" cy="12.2" r="1.4" fill="#fff" opacity="0.75" />
        </svg>
      )
    case 'milk':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
          {/* 马克杯把手 */}
          <path
            d="M28 16h3.2a3.8 3.8 0 0 1 0 7.6H28"
            fill="none"
            stroke="var(--study)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* 杯身 */}
          <rect
            x="10"
            y="12"
            width="18"
            height="20"
            rx="4"
            fill="var(--surface)"
            stroke="var(--study)"
            strokeWidth="2"
          />
          {/* 温牛奶液面与小爱心拉花 */}
          <path d="M12 16.5h14" stroke="var(--diet-soft)" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M19 25.5s-3.5-2-3.5-4.4a1.9 1.9 0 0 1 3.5-1.1 1.9 1.9 0 0 1 3.5 1.1c0 2.4-3.5 4.4-3.5 4.4Z"
            fill="var(--custom)"
          />
          {/* 热气 */}
          <path
            d="M15.5 9c0-1.5 1.2-2 1.2-3.5M21.5 9c0-1.5 1.2-2 1.2-3.5"
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
          <circle cx="20" cy="20" r="14" fill="var(--diet)" stroke="#d9a93a" strokeWidth="2" />
          <g fill="#8f5b2a">
            <circle cx="14" cy="16" r="2" />
            <circle cx="24" cy="14" r="1.6" />
            <circle cx="22" cy="24" r="2.2" />
            <circle cx="13" cy="25" r="1.4" />
          </g>
        </svg>
      )
  }
}
