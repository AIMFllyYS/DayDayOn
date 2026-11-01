'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { getQueryClient } from './query-client'

/** QueryClientProvider，挂在 (app) 布局（client-data-and-forms.md 第 2 节） */
export function ApiProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
