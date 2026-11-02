'use client'

import { useEffect, useState } from 'react'
import { MascotSvg } from '@/components/mascot/mascot-svg'
import { cn } from '@/lib/cn'
import type { PetDrag } from '../use-pet-drag'

/*
 * 悬浮团团的形象与状态动画：静止呼吸、长按晃悠、双击转圈、顶部吸附倒立 + 探头。
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
}: {
  pet: Pick<PetDrag, 'position' | 'swaying' | 'spinning' | 'peeking' | 'dragging'>
  size: number
  className?: string
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
          'bg-surface/90 shadow-float flex items-center justify-center rounded-full p-1',
          pet.spinning && 'animate-pet-spin',
          pet.swaying && 'animate-pet-sway',
          pet.peeking && 'animate-pet-nod',
          pet.dragging && 'scale-105',
          className,
        )}
      >
        <MascotSvg
          mood={pet.swaying ? 'shy' : 'happy'}
          size={size - 10}
          blink={blink}
          character="tuan"
        />
      </span>
    </span>
  )
}
