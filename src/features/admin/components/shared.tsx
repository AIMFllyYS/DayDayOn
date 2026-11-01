'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import { errorMessage, FALLBACK_MESSAGE, isApiError } from '@/lib/api'

/*
 * 后台各面板共用的小件：页头、错误文案、懒加载的弹层（ui-primitives.md 第 3 节）。
 */

export const Sheet = dynamic(() => import('@/components/ui/sheet').then((m) => m.Sheet))
export const ConfirmDialog = dynamic(() =>
  import('@/components/ui/confirm-dialog').then((m) => m.ConfirmDialog),
)

/** 任意错误 → 用户文案（只来自 error-messages.ts） */
export function messageOf(error: unknown): string {
  return isApiError(error) ? errorMessage(error) : FALLBACK_MESSAGE
}

export function AdminHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-title font-bold">{title}</h1>
        {description && <p className="text-caption text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
