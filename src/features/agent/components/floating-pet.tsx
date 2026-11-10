'use client'

import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { useAgentUi } from '../agent-store'
import { usePetBindingState, usePetIdentity } from '../pet-binding'
import { PET_SIZE, usePetDrag } from '../use-pet-drag'
import { PetAvatar } from './pet-avatar'

/*
 * 悬浮团团：应用内常驻、全局唯一的 Agent 入口。
 * IP 本身直接作为悬浮按钮（无额外画圈），支持拖动、吸附、双击转圈与长按晃悠。
 * 形象跟随用户偏好设置（团团 / 墩墩）。
 * 页面可以把状态点和点按行为绑到它身上（pet-binding.ts，如打卡页的分析状态），不另画第二只。
 * 底部受 Dock 栏阻挡：手机预留 96px，桌面 24px。
 */

const STORAGE_KEY = 'daydayon:agent-pet:v1'

function dockInset(): number {
  if (typeof window === 'undefined') return 0
  return window.matchMedia('(max-width: 767px)').matches ? 96 : 24
}

export function FloatingPet({ className }: { className?: string }) {
  const ui = useAgentUi()
  const { character, name } = usePetIdentity()
  const binding = usePetBindingState()

  const handleActivate = () => (binding?.onTap ? binding.onTap() : ui.openPanel())

  const pet = usePetDrag({
    size: PET_SIZE,
    bottomInset: dockInset,
    storageKey: STORAGE_KEY,
    onTap: handleActivate,
  })

  const buttonRef = useRef<HTMLButtonElement>(null)
  const status = binding?.status ?? null
  const hidden = binding?.hidden ?? false

  // 隐藏前若自身仍持有焦点，先同步移除焦点再交由 inert 接管，避免浏览器报 Blocked aria-hidden 警告
  useLayoutEffect(() => {
    if (hidden && buttonRef.current && document.activeElement === buttonRef.current) {
      buttonRef.current.blur()
    }
  }, [hidden])

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={binding?.label ?? `打开${name}对话`}
      inert={hidden || undefined}
      onClick={(e) => {
        // 指针点按由 usePetDrag 区分单击/双击；键盘回车/空格或辅助技术触发 click（detail === 0）时走这里
        if (e.detail === 0 && !hidden) handleActivate()
      }}
      className={cn(
        'fixed z-40 flex touch-none items-center justify-center transition-opacity duration-(--dur-fast) outline-none select-none',
        (!pet.ready || hidden) && 'pointer-events-none opacity-0',
        className,
      )}
      style={{ left: pet.position.left, top: pet.position.top, width: PET_SIZE, height: PET_SIZE }}
      {...pet.handlers}
    >
      <PetAvatar pet={pet} size={PET_SIZE} character={character} />
      {status && (
        <span
          aria-hidden
          data-pet-status={status}
          className={cn(
            // 吸附在右边时宠物半藏在屏外，状态点放到朝里的一侧
            'ring-surface absolute top-1 size-3 rounded-full ring-2',
            pet.position.edge === 'right' ? 'left-1' : 'right-1',
            status === 'done' ? 'bg-success' : 'bg-primary animate-pulse',
          )}
        />
      )}
    </button>
  )
}
