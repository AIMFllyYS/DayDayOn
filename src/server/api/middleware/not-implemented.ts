import 'server-only'
import type { Context } from 'hono'
import type { ErrorBody } from '../errors'

/** F1 桩：契约已定、实现未落地时统一返回 501（实现方落地后删除对它的引用） */
export function notImplemented(c: Context, owner: string): Response {
  const body: ErrorBody = { code: 'NOT_IMPLEMENTED', detail: `not implemented: ${owner}` }
  return c.json(body, 501)
}
