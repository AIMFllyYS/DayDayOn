import type { ErrorBody, ErrorCode } from '@/server/api/errors'

/*
 * 统一的请求处理（client-data-and-forms.md 第 2 节）：带 cookie、JSON 请求头、
 * 把错误体解析成 ApiError({ status, code, detail, fields… })、401 跳登录页。
 * 本文件只 `import type` 服务端代码。
 */

export const API_BASE = '/api/v1'

/** 接口返回的错误体；code 可能是前端还不认识的新码 */
export type ApiErrorBody = Partial<Omit<ErrorBody, 'code'>> & { code: ErrorCode | (string & {}) }

/** 前端的接口错误：只按 code 分支，文案用 errorMessage(err) */
export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode | (string & {})
  readonly detail: string
  readonly body: ApiErrorBody

  constructor(status: number, body: ApiErrorBody) {
    super(body.detail ?? body.code)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.detail = body.detail ?? body.code
    this.body = body
  }

  /** VALIDATION_FAILED 的字段错误，直接交给 Base UI Form 的 errors */
  get fields(): Record<string, string[]> | undefined {
    return this.body.fields
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

function isErrorBody(v: unknown): v is ApiErrorBody {
  return typeof v === 'object' && v !== null && typeof (v as { code?: unknown }).code === 'string'
}

/** 401 时跳登录页（带回跳地址）；已经在登录页时不跳 */
function redirectToLogin(): void {
  if (typeof window === 'undefined') return
  const { pathname, search } = window.location
  if (pathname === '/login') return
  // fetcher 不在 React 渲染里，拿不到 router；整页跳转同时清掉内存里的查询缓存
  const url = new URL('/login', window.location.origin)
  url.searchParams.set('next', `${pathname}${search}`)
  window.location.replace(url)
}

/**
 * 解析一个已经拿到的 Response：2xx 返回 JSON（204 返回 undefined），否则抛 ApiError。
 * 给 hc 客户端和 apiFetch 共用。
 */
export async function parseResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    if (res.status === 204) return undefined as T
    const type = res.headers.get('content-type') ?? ''
    return (type.includes('application/json') ? await res.json() : await res.text()) as T
  }
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  const retryAfter = Number(res.headers.get('retry-after'))
  const parsed: ApiErrorBody = isErrorBody(body)
    ? { ...body }
    : { code: res.status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL', detail: res.statusText }
  if (parsed.retryAfterSeconds === undefined && Number.isFinite(retryAfter) && retryAfter > 0) {
    parsed.retryAfterSeconds = retryAfter
  }
  const error = new ApiError(res.status, parsed)
  if (res.status === 401) redirectToLogin()
  throw error
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** JSON 请求体：自动序列化并设置 Content-Type */
  json?: unknown
  /** multipart 请求体（图片上传） */
  form?: FormData
  /** 幂等键：写进 idempotency-key 请求头（api-conventions.md 第 9 节） */
  idempotencyKey?: string
}

/** 业务请求：path 相对 /api/v1，如 apiFetch('/goals') */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { json, form, idempotencyKey, headers, ...init } = options
  const h = new Headers(headers)
  let body: BodyInit | undefined
  if (json !== undefined) {
    h.set('Content-Type', 'application/json')
    body = JSON.stringify(json)
  } else if (form) {
    body = form
  }
  if (idempotencyKey) h.set('idempotency-key', idempotencyKey)
  const res = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    credentials: 'same-origin',
    ...init,
    headers: h,
    body,
  })
  return parseResponse<T>(res)
}

/** 每次用户操作生成一个幂等键，重试时复用 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}
