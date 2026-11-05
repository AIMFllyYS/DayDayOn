'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { MascotCharacter } from '@/components/mascot/mascot-svg'
import { useMe } from '@/lib/api/queries/me'

/*
 * 全局只有一个 Agent 形象（悬浮宠物）。这里放两件事：
 * 1. usePetIdentity：形象与名字跟随偏好设置（团团 / 墩墩），所有写到名字的地方都读它，不写死。
 * 2. 页面绑定：打卡页这类「默认在干一件事」的页面，把状态点和点按行为挂到这只宠物身上，
 *    不再自己画第二只。卸载时自动解绑，宠物回到「点一下打开对话」。
 */

export interface PetIdentity {
  character: MascotCharacter
  name: string
}

export function usePetIdentity(): PetIdentity {
  const { data: me } = useMe()
  const character: MascotCharacter = me?.preferences.mascot === 'dun' ? 'dun' : 'tuan'
  return { character, name: character === 'dun' ? '墩墩' : '团团' }
}

export interface PetBinding {
  /** 宠物身上的状态点：分析中呼吸、已完成绿点；null 不显示 */
  status: 'analyzing' | 'done' | null
  /** 点按宠物时做什么；不传就打开对话 */
  onTap?: () => void
  /** 当前页面已经把宠物「展开」成别的样子（如打卡页的分析抽屉），暂时不显示悬浮宠物 */
  hidden?: boolean
  /** 读屏用：点按会发生什么 */
  label?: string
}

let binding: PetBinding | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function usePetBindingState(): PetBinding | null {
  return useSyncExternalStore(
    subscribe,
    () => binding,
    () => null,
  )
}

/** 页面挂载期间把状态挂到悬浮宠物上；卸载即解绑 */
export function useBindPet(next: PetBinding | null): void {
  const status = next?.status ?? null
  const hidden = next?.hidden ?? false
  const label = next?.label
  const onTap = next?.onTap
  const active = next !== null
  useEffect(() => {
    binding = active ? { status, hidden, label, onTap } : null
    emit()
  }, [active, status, hidden, label, onTap])
  useEffect(
    () => () => {
      binding = null
      emit()
    },
    [],
  )
}
