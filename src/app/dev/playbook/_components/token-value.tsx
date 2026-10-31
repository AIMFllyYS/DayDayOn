'use client'

import { useSyncExternalStore } from 'react'

const subscribeNothing = () => () => {}

/** 运行时读取 CSS 变量的实际值，避免 playbook 里手写的色值和 globals.css 不一致 */
export function TokenValue({ name }: { name: `--${string}` }) {
  const value = useSyncExternalStore(
    subscribeNothing,
    () => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    () => '',
  )
  return <span className="text-tiny text-muted font-mono">{value || '…'}</span>
}
