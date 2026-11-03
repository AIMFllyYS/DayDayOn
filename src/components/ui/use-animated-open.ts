'use client'

import { useEffect, useState } from 'react'

/*
 * Base UI 的 Drawer / Dialog / AlertDialog 内部调用 useTransitionStatus(open, false, false, false)。
 * 当弹层在 open === true 状态下首次挂载（如 next/dynamic 懒加载首次打开、条件挂载）时，
 * Base UI 会将首次挂载已打开的节点视为默认初始展开内容，跳过 'starting' 阶段（不生成 data-starting-style），
 * 导致抽屉或弹窗失去从底部缓慢拉出 / 缩放淡入的进场过渡，直接瞬移出现。
 *
 * 本 Hook 在组件以 open === true 首次挂载时，首帧先返回 false 让 Base UI 以关闭态完成初始化，
 * 随后在下一动画帧切为 true，驱动 Base UI 走标准的 false → true 状态转换，
 * 100% 触发 data-starting-style 进场动画。已挂载组件的后续开关与关闭退场均零延迟同步响应。
 */

/** 计算挂载首帧是否已具备进场前置关闭态：首帧即 open=true 时需先置为 false 经历一次 false → true 转换 */
export function initialAnimatedEntered(initialOpen: boolean): boolean {
  return !initialOpen
}

/** 合成传给 Base UI Root 的受控 open 值 */
export function resolveAnimatedOpen(open: boolean, entered: boolean): boolean {
  return open && entered
}

export function useAnimatedOpen(open: boolean): boolean {
  const [entered, setEntered] = useState(() => initialAnimatedEntered(open))

  useEffect(() => {
    if (open && !entered) {
      const frame = window.requestAnimationFrame(() => {
        setEntered(true)
      })
      return () => window.cancelAnimationFrame(frame)
    }
    return undefined
  }, [open, entered])

  return resolveAnimatedOpen(open, entered)
}
