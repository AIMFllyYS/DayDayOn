import { isServer, QueryClient } from '@tanstack/react-query'
import { isApiError } from './fetcher'

/*
 * QueryClient 默认配置（client-data-and-forms.md 第 4 节）：
 * staleTime 30 秒；查询失败重试 1 次，4xx 不重试；mutation 不自动重试；refetchOnWindowFocus 保持默认。
 * 服务端每个请求新建一个，浏览器端单例。
 */

export const STALE_TIME_MS = 30_000

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false
  return failureCount < 1
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: STALE_TIME_MS, retry: shouldRetry },
      mutations: { retry: false },
    },
  })
}

let browserClient: QueryClient | undefined

/** 服务端：每次新建（避免跨请求共享数据）；浏览器：单例 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient()
  browserClient ??= makeQueryClient()
  return browserClient
}
