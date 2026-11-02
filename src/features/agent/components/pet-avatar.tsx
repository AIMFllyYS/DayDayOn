'use client'

import { useEffect, useState } from 'react'
import { MascotSvg, type MascotCharacter } from '@/components/mascot/mascot-svg'
import { cn } from '@/lib/cn'
import type { PetDrag } from '../use-pet-drag'

/*
 * 悬浮团团/墩墩的形象与状态动画：静止呼吸、眨眼、长按晃悠、双击转圈、顶部吸附倒立 + 探头。
 * IP 本身直接作为悬浮按钮，无圆形底盘/圈圈，靠自然轮廓与立体阴影独立悬浮在页面上。
 * 正式外壳与 Playbook 演示共用（外面套容器和手势即可）。
 */

/** 眨眼是唯一的自发动作（ui-design-system.md 第 9 节） */
export function useBlink(intervalMs = 3600) {
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    const t = setInterval(() => {
      setBlink(true)
      setTimeout(() => setBlink(false), 140)
    }, intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return blink
}

export function PetAvatar({
  pet,
  size,
  className,
  character = 'tuan',
}: {
  pet: Pick<PetDrag, 'position' | 'swaying' | 'spinning' | 'peeking' | 'dragging'>
  size: number
  className?: string
  character?: MascotCharacter
}) {
  const blink = useBlink()
  return (
    // 顶部吸附时整只倒过来（外层静态翻转，内层动画互不干扰）
    <span
      className="flex size-full items-center justify-center"
      style={{ transform: pet.position.edge === 'top' ? 'scaleY(-1)' : undefined }}
    >
      <span
        className={cn(
          // IP 形象直接作为悬浮按钮，无圆形底盘背景，由 SVG 轮廓柔和投影呈现轻盈悬浮质感
          'flex items-center justify-center transition-transform duration-150',
          'drop-shadow-[0_4px_12px_rgba(0,0,0,0.12)] filter',
          pet.spinning && 'animate-pet-spin',
          pet.swaying && 'animate-pet-sway',
          pet.peeking && 'animate-pet-nod',
          pet.dragging
            ? 'scale-110 drop-shadow-[0_8px_20px_rgba(0,0,0,0.2)]'
            : 'hover:scale-105 active:scale-95',
          className,
        )}
      >
        <MascotSvg
          mood={pet.swaying ? 'shy' : 'happy'}
          size={size}
          blink={blink}
          character={character}
        />
      </span>
    </span>
  )
}
