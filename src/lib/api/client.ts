import { hc, type InferResponseType } from 'hono/client'
import type { AppType } from '@/server/api/app'
import { parseResponse } from './fetcher'

/*
 * 类型化客户端（client-data-and-forms.md 第 2 节）：hono/client 的 hc，类型来自服务端 AppType。
 * 只 `import type` 服务端代码，不引入任何服务端运行时。
 *
 * 用法（queries/<领域>.ts 里）：
 *   queryFn: () => unwrap(api.api.v1.goals.$get({ query: { status: 'active' } }))
 * 需要幂等键时：api.api.v1.redeem-codes.redeem.$post({ json, header: { 'idempotency-key': key } })
 */

/** 同源请求，带 cookie。服务端渲染时不用它（Server Component 直接调 service） */
export const api = hc<AppType>('/', {
  init: { credentials: 'same-origin' },
})

/** 成功响应的类型（只取 2xx 分支） */
export type SuccessOf<F> = F extends (...args: never[]) => Promise<infer R>
  ? R extends { ok: true; json(): Promise<infer T> }
    ? T
    : never
  : never

export type { InferResponseType }

/** hc 的响应 → 数据；非 2xx 抛 ApiError（fetcher.ts） */
export async function unwrap<R extends Response>(
  res: R | Promise<R>,
): Promise<R extends { ok: true; json(): Promise<infer T> } ? T : unknown> {
  return parseResponse(await res)
}
