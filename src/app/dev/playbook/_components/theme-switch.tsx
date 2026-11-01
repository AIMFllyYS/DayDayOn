'use client'

import { useEffect } from 'react'
import { ThemePicker } from '@/components/ui/theme-picker'
import { restoreTheme, setTheme, themes, useTheme } from '@/lib/theme'

/** Playbook 侧栏里的全局主题切换：改的是 <html data-theme>，所有页面跟着变 */
export function ThemeSwitch() {
  const theme = useTheme()
  useEffect(restoreTheme, [])
  const current = themes.find((t) => t.id === theme)
  return (
    <div className="border-border bg-surface/80 rounded-2xl border p-2.5">
      <p className="text-tiny text-muted mb-1.5 px-1 font-semibold">
        主题色 · <span className="text-foreground">{current?.label}</span>
      </p>
      <ThemePicker value={theme} onValueChange={setTheme} compact />
    </div>
  )
}
