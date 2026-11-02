'use client'

import { cn } from '@/lib/cn'
import { useAgentUi } from '../agent-store'
import { PET_SIZE, usePetDrag } from '../use-pet-drag'
import { PetAvatar } from './pet-avatar'

/*
 * 悬浮团团：应用内常驻的 Agent 入口。
 * 手势与吸附规则在 use-pet-drag.ts，形象与状态动画在 pet-avatar.tsx（Playbook 演示共用同一套）。
 * 底部受 Dock 栏阻挡：手机预留 96px，桌面 24px。
 */

const STORAGE_KEY = 'daydayon:agent-pet:v1'

function dockInset(): number {
  if (typeof window === 'undefined') return 0
  return window.matchMedia('(max-width: 767px)').matches ? 96 : 24
}

export function FloatingPet({ className }: { className?: string }) {
  const ui = useAgentUi()
  const pet = usePetDrag({
    size: PET_SIZE,
    bottomInset: dockInset(),
    storageKey: STORAGE_KEY,
    onTap: () => ui.openPanel(),
  })

  return (
    <button
      type="button"
      aria-label="打开团团对话"
      className={cn(
        'fixed z-40 flex touch-none items-center justify-center outline-none select-none',
        className,
      )}
      style={{ left: pet.position.left, top: pet.position.top, width: PET_SIZE, height: PET_SIZE }}
      {...pet.handlers}
    >
      <PetAvatar pet={pet} size={PET_SIZE} />
    </button>
  )
}
