import type { AppUpdate } from '@/features/app-update/schemas'
import { apiFetch } from '../fetcher'

/*
 * 检查更新（GET /app/update）。用户点「检查更新」时才请求一次，不进 Query 缓存：每次都要最新结果。
 */
export function fetchAppUpdate(input: { web: string; shell?: string | null }): Promise<AppUpdate> {
  const params = new URLSearchParams({ web: input.web })
  if (input.shell) params.set('shell', input.shell)
  return apiFetch<AppUpdate>(`/app/update?${params.toString()}`)
}
