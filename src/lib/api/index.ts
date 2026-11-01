/*
 * 客户端数据请求的唯一出口（client-data-and-forms.md 第 2 节）。
 * 业务组件不直接 fetch('/api/v1/…')、不直接 import @tanstack/react-query，一律从 '@/lib/api' 导入。
 * 服务端预取在 Server Component 里用 getQueryClient() + HydrationBoundary + dehydrate。
 */

export {
  dehydrate,
  HydrationBoundary,
  keepPreviousData,
  queryOptions,
  infiniteQueryOptions,
  useInfiniteQuery,
  useIsFetching,
  useIsMutating,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query'

export { api, unwrap } from './client'
export {
  API_BASE,
  ApiError,
  apiFetch,
  isApiError,
  newIdempotencyKey,
  parseResponse,
} from './fetcher'
export type { ApiErrorBody, ApiFetchOptions } from './fetcher'
export type { InferResponseType, SuccessOf } from './client'
export { errorMessage, errorMessages, FALLBACK_MESSAGE } from './error-messages'
export { afterCheckinChange, keys } from './keys'
export { ApiProvider } from './provider'
export { getQueryClient, makeQueryClient, STALE_TIME_MS } from './query-client'
