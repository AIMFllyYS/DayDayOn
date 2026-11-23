# 接口规范（/api/v1）

> 日期：2026-10-31（2026-11-16 对齐最新实现） · 状态：已按最新服务端代码核对同步。踩坑经验见 [lessons/hono.md](../lessons/hono.md)。
> 依据：[ADR-0016](../adr/0016-api-layer.md)（Hono + @hono/zod-openapi）、[ADR-0002](../adr/0002-account-quota-risk.md)（额度、风控）、[routing.md](./routing.md) 第 6 节（路径命名）。
> 官方资料（2026-10-31 抓取）：Hono 的 Next.js 指南、`@hono/zod-openapi` README、`@asteasolutions/zod-to-openapi` README、Next 16.4 自带文档 Route Handlers 一节。

## 1. 范围

| 路径 | 由谁处理 | 说明 |
|---|---|---|
| `/api/v1/*` | Hono（`src/server/api/`） | 全部业务接口。Web、APK 壳、Kotlin 客户端共用 |
| `/api/auth/*` | Better Auth 处理器 + 自托管人机验证 | 登录、会话、管理员操作，见 [auth.md](./auth.md)。不在 Hono 里重复实现 |
| `/api/health` | 原生 Route Handler | 部署健康检查，返回 commit |

- 业务写操作只走 `/api/v1`。禁止用 Server Actions 写业务数据。
- Server Component 读首屏数据时直接调 `src/server/services/`，不通过 HTTP 请求自己的 `/api/v1`。

## 2. 目录与挂载

```
src/app/api/v1/[[...route]]/route.ts   转发请求给 Hono；非生产环境拦截 GET /api/v1/doc 输出 OpenAPI JSON
src/server/api/
├── app.ts            根应用：basePath('/api/v1')、csrf()、defaultHook、onError、notFound，链式挂载各领域并导出 AppType
├── errors.ts         ERROR_STATUS 错误码表、ErrorExtras / ErrorBody 与 ApiError
├── openapi.ts        OPENAPI_DOC_PATH 与 buildOpenApiDocument()（供导出脚本与开发环境文档路由调用）
├── schemas.ts        跨领域的通用 schema：ErrorSchema、errorResponses()、AUTH_ERRORS、IdempotencyHeadersSchema、分页与 OkSchema
├── middleware/       auth.ts（requireUser / requireOnboarded / requireAdmin）、rate-limit.ts、idempotency.ts
└── routes/<领域>.ts  每个领域一个 OpenAPIHono 子应用：me.ts、goals.ts、checkins.ts、ai.ts、agent.ts、referee.ts、admin.ts…
```

挂载不需要 `@hono/vercel`、`hono/vercel` 或 `@hono/node-server`。Hono 的 `app.fetch` 本身就是 `Request → Response`：

```ts
// src/app/api/v1/[[...route]]/route.ts
import { app } from '@/server/api/app'

const handler = async (request: Request): Promise<Response> => {
  if (process.env.NODE_ENV !== 'production' && request.method === 'GET') {
    const { OPENAPI_DOC_PATH, buildOpenApiDocument } = await import('@/server/api/openapi')
    if (new URL(request.url).pathname === OPENAPI_DOC_PATH) {
      return Response.json(buildOpenApiDocument())
    }
  }
  return app.fetch(request)
}

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT }
```

- 处理器读取了 `request`，所以 `GET` 在 Cache Components 下不会被预渲染（Next 文档：读取 `req.url`、`request.headers` 会停止预渲染）。
- 每个领域一个小的 `OpenAPIHono` 子应用，在 `routes/<领域>.ts` 里写完整路径（如 `path: '/goals'`、`path: '/goals/{goalId}'`），再由 `app.ts` 链式调用 `.route('/', ...)` 挂在根上并 `export type AppType = typeof app`。不要在一个实例上注册全部路由，也不要断开链式赋值（否则 `hc<AppType>` 类型检查变慢或丢失路由类型）。
- 若使用带前缀的 `.route('/prefix', sub)` 挂载，挂载路径里的参数用 Hono 的 `:param` 写法，而 `createRoute` 的 `path` 里用 OpenAPI 的 `{param}` 写法。
- 上下文变量（当前用户、请求 IP）的类型在 `app.ts` 定义一次：`type AppEnv = { Variables: { user: SessionUser; ip: string } }`，子应用都用 `new OpenAPIHono<AppEnv>()`。

## 3. 一个接口的写法

handler 只做四件事：取校验后的入参 → 取当前用户 → 调 service → 返回响应。业务规则写在 `src/server/services/`。

```ts
// src/server/api/routes/goals.ts（示意）
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { CreateGoalSchema, GoalSchema } from '@/features/goal/schemas'
import { db } from '@/server/db/client'
import * as goals from '@/server/services/goals'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import { AUTH_ERRORS, errorResponses, IdempotencyHeadersSchema } from '../schemas'

const createGoal = createRoute({
  method: 'post',
  path: '/goals',
  middleware: [requireUser, requireOnboarded, idempotency()] as const,
  request: {
    headers: IdempotencyHeadersSchema,
    body: { content: { 'application/json': { schema: CreateGoalSchema } }, required: true },
  },
  responses: {
    201: { content: { 'application/json': { schema: GoalSchema } }, description: '已创建' },
    ...errorResponses(
      'VALIDATION_FAILED',
      'GOAL_LIMIT_REACHED',
      'IDEMPOTENCY_KEY_REUSED',
      'REQUEST_IN_PROGRESS',
      ...AUTH_ERRORS,
    ),
  },
})

export const goalRoutes = new OpenAPIHono<AppEnv>().openapi(createGoal, async (c) => {
  const goal = await db.transaction((tx) =>
    goals.createGoal(tx, c.get('user').id, c.req.valid('json'), new Date()),
  )
  return c.json(goal, 201)
})
```

规则：

- 每个路由都用 `createRoute` 定义，写全 `request` 和 `responses`（包括错误响应，统一用 `schemas.ts` 的 `errorResponses()`、`AUTH_ONLY_ERRORS` / `AUTH_ERRORS` / `ADMIN_ERRORS`）。不进 OpenAPI 的接口不允许存在；开发专用接口用 `hide: true`，并且只在开发环境注册。
- `c.json()` 必须写状态码，200 也要写。
- JSON 请求体写 `required: true`。客户端没带 `Content-Type: application/json` 会得到 415，这是预期行为。
- 请求头 schema 的键一律小写：`'idempotency-key'`，不是 `'Idempotency-Key'`。
- service 函数的入参是普通对象，不接收 Hono 的 `Context`，不 import `hono`。
- service 返回的就是接口响应的 DTO，handler 不再改形状。这样 Server Component 直接调 service 预取的数据，和浏览器从接口拿到的数据形状一致（[client-data-and-forms.md](./client-data-and-forms.md) 第 1 节）。

## 4. Schema 与 OpenAPI

- 领域 schema 写在 `src/features/<领域>/schemas.ts`，前后端共用，统一 `import * as z from 'zod'`。
- 需要出现在 OpenAPI `components/schemas` 里的 schema 用 zod 自带的 `.meta({ id: 'Goal' })` 命名（zod-to-openapi 8 起直接读取 `.meta`）。不用 `.openapi('Goal')`：它要求从 `@hono/zod-openapi` 导入扩展过的 `z`，会把这层依赖带进前端共用的 schema 文件。
- 只有 `src/server/api/` 可以 `import { z } from '@hono/zod-openapi'`，并且只用于路径参数、查询参数的 `.openapi({ param: … })` 元数据，以及 `multipart/form-data` 文件字段的 `z.unknown().openapi({ type: 'string', format: 'binary' })`（这类元数据只能用 `.openapi` 表达）。
- 数据库行不能直接 `c.json(row)`，先映射成 DTO，只放客户端需要的字段。
- OpenAPI 文档导出为 OpenAPI 3.1（`app.getOpenAPI31Document(...)`），由 `pnpm openapi:export`（`scripts/dev/export-openapi.ts`）写入 `docs/specs/api/openapi.json` 并提交。修改 `/api/v1` 路由或 schema 后必须重新导出并保持同步。
- 生产环境不暴露文档接口（请求落到 Hono 404）；非生产环境（`NODE_ENV !== 'production'`）由 `src/app/api/v1/[[...route]]/route.ts` 拦截 `GET /api/v1/doc` 直接输出 OpenAPI 3.1 JSON。

## 5. 数据格式

| 内容 | 格式 | 例子 |
|---|---|---|
| 字段名 | camelCase | `goalId`、`createdAt` |
| ID | 字符串（UUID v7，生成方式见 [database.md](./database.md) 第 4 节） | `"0193f6b2-…"` |
| 时间点 | ISO 8601 UTC 字符串，带 `Z` | `"2026-10-31T08:30:00.000Z"` |
| 本地日期（打卡日） | `YYYY-MM-DD` | `"2026-10-31"` |
| 时长 | 整数秒，字段名以 `Seconds` 结尾 | `durationSeconds: 1800` |
| 金额 | 整数微元，字段名以 `Micros` 结尾 | `costMicros: 7000` |
| 热量 | 整数千卡，字段名以 `Kcal` 结尾 | `intakeKcal: 650` |
| 体重 | 整数克，字段名以 `Grams` 结尾 | `weightGrams: 62500` |
| 枚举 | 小写 kebab-case 字符串字面量 | `"sign-in"`、`"low-intensity"` |
| 没有值 | 字段存在，值为 `null` | `note: null` |

- 单位换算（克 ↔ 千克一位小数、秒 ↔ 时分）只在界面层做，接口和数据库都用整数。
- 时间规则见 [time-and-dates.md](./time-and-dates.md)。

## 6. 错误

- 响应体固定为 `{ "code": "GOAL_NOT_FOUND", "detail": "…", ...extras }`。`code` 是大写蛇形，全部登记在 `src/server/api/errors.ts`（`ERROR_STATUS`）与 `src/server/api/schemas.ts`（`ErrorSchema`）。前端只按 `code` 分支。
- `detail` 只给开发者看，不显示给用户。用户看到的文案由前端按 `code` 从 `src/lib/api/error-messages.ts` 取（ADR-0006）。
- 校验失败统一 400 `VALIDATION_FAILED`，额外带 `fields: { 字段名: string[] }`（由 `z.flattenError(error).fieldErrors` 生成），前端直接交给 Base UI `Form` 的 `errors`。在根应用 `app.ts` 的 `defaultHook` 里统一处理，单个路由不写自己的 hook。
- 根应用 `app.ts` 的 `onError` 兜底：
  - `ApiError`：按 `err.status` 返回 `err.toBody()`；若带 `retryAfterSeconds` 同步写 `Retry-After` 响应头；
  - Hono `HTTPException`：按 `HTTP_STATUS_CODE` 表（`400`/`401`/`403`/`404`/`413`/`415`/`429`）映射为对应 `ErrorCode`；
  - 其他未预期异常：只记录方法、路径和错误本身（不记请求体），返回 500 `INTERNAL`。异常 message、堆栈、SQL 一律不返回给客户端。

| 状态码 | 用途 | `ERROR_STATUS` 中的 `code` |
|---|---|---|
| 400 | 入参或业务前提不合法 | `VALIDATION_FAILED`、`EMAIL_DOMAIN_NOT_ALLOWED`、`MAKEUP_NOT_ALLOWED`、`REDEEM_CODE_INVALID`、`FRIEND_INVITE_INVALID`、`FRIEND_SELF_INVITE` |
| 401 | 未登录或会话过期 | `UNAUTHENTICATED` |
| 402 | AI 额度不足 | `QUOTA_INSUFFICIENT` |
| 403 | 已登录但无权限、账号受限或未完成引导/2FA | `FORBIDDEN`、`ACCOUNT_BANNED`、`USER_MUTED`、`FRIEND_RELATION_FROZEN`、`CHECKIN_LOCKED`、`TWO_FACTOR_REQUIRED`、`ONBOARDING_REQUIRED` |
| 404 | 资源或路由不存在，或不属于当前用户（不区分以防探测） | `NOT_FOUND`、`GOAL_NOT_FOUND`、`CHECKIN_NOT_FOUND`、`TODO_NOT_FOUND`、`USER_NOT_FOUND`、`REDEEM_CODE_NOT_FOUND`、`FRIEND_NOT_FOUND` |
| 409 | 状态冲突、重复操作 | `ALREADY_ONBOARDED`、`GOAL_LIMIT_REACHED`、`TODO_LIMIT_REACHED`、`CHECKIN_EXISTS`、`WEIGHT_CHANGE_UNCONFIRMED`、`REDEEM_CODE_USED`、`IDEMPOTENCY_KEY_REUSED`、`REQUEST_IN_PROGRESS`、`FRIEND_ALREADY_EXISTS` |
| 413 | 请求体太大（图片或内联附件） | `PAYLOAD_TOO_LARGE` |
| 415 | `Content-Type` 不对（Hono 抛 `HTTPException(415)`，经 `onError` 映射） | `UNSUPPORTED_MEDIA_TYPE` |
| 422 | 语义或业务规则无法处理 | `AI_RECOGNITION_FAILED`、`FRIEND_LIMIT_REACHED`、`INTERACTION_DAILY_LIMIT_EXCEEDED`、`REMIND_NOT_APPLICABLE`、`CONTENT_SENSITIVE` |
| 429 | 触发限流或冷却锁定 | `RATE_LIMITED`、`REDEEM_LOCKED`、`INTERACTION_COOLDOWN` |
| 500 | 未预期的错误 | `INTERNAL` |
| 501 | 契约已定、实现未落地的接口或中间件（桩） | `NOT_IMPLEMENTED` |
| 503 | 全站 AI 暂停（达到每日上限或管理员手动暂停） | `AI_PAUSED` |

`ErrorExtras` / `ErrorSchema` 允许携带的附加字段：

| 字段 | 类型 | 适用错误码 | 说明 |
|---|---|---|---|
| `fields` | `Record<string, string[]>` | `VALIDATION_FAILED` | 字段级校验错误（`z.flattenError(error).fieldErrors`） |
| `ban` | `{ reason: string \| null; expiresAt: string \| null }` | `ACCOUNT_BANNED` | 封号原因与截止 ISO 时刻（`null` 表示永久） |
| `previousWeightGrams` | `number`（整数） | `WEIGHT_CHANGE_UNCONFIRMED` | 上次记录的体重（克），供二次确认弹窗展示 |
| `aiRunId` | `string` | `AI_RECOGNITION_FAILED` | 已产生的 AI 调用记录 ID（费用照常结算） |
| `retryAfterSeconds` | `number`（整数） | `RATE_LIMITED`、`REDEEM_LOCKED`、`USER_MUTED` | 需等待秒数；同步写入 `Retry-After` 响应头 |
| `draft` | `string` | `CONTENT_SENSITIVE` | 触发敏感词拦截时保留用户原草稿输入内容 |

## 7. 鉴权

- 默认需要登录。业务路由在 `createRoute` 的 `middleware` 里挂 `[requireUser, requireOnboarded]`；免引导路由（`GET /me`、`POST /me/onboarding`、`DELETE /me`、`GET /me/export`）只挂 `requireUser`；后台路由（`/admin/*`）只挂 `requireAdmin`。不需要登录的接口（如 `GET /app/update`）必须在路由定义旁边注释原因。
- `requireUser` 从 `auth.api.getSession({ headers: c.req.raw.headers })` 取会话后，实时查库 `loadAccountState()`（封禁状态不信任会话缓存）：取不到会话或用户已注销返回 401 `UNAUTHENTICATED`；账号被封禁返回 403 `ACCOUNT_BANNED`（带 `ban`）。细节见 [auth.md](./auth.md) 第 5、6 节。
- 资源归属在 service 的查询条件里校验（`where userId = 当前用户`），不在 handler 里"先查出来再比较"。好友只读接口（`/friends/{friendUserId}/...`）必须先校验双向好友关系（非好友或本人均返回 404 `FRIEND_NOT_FOUND`），再以 `friendUserId` 作为资源归属条件查询，防止越权窥探非好友或他人资源。
- CSRF：浏览器靠 cookie 会话。根应用 `app.ts` 全局挂 `csrf({ origin: (origin) => origin === new URL(env.NEXT_PUBLIC_APP_URL).origin })`（懒读取 `env`，构建期不触发环境变量校验）。`hono/csrf` 对非安全方法且 `Content-Type` 为表单类或缺失时（默认视为 `text/plain`，含 `DELETE`）校验 `sec-fetch-site: same-origin` 或允许的 `origin`，不通过抛 `HTTPException(403)` 并由 `onError` 转为 `403 FORBIDDEN`（实测细节见 [lessons/hono.md](../lessons/hono.md)）。APK / Kotlin 阶段改用 bearer token 后不受影响。
- 不开 CORS。Web 前端和接口同源；原生客户端不受 CORS 限制。

## 8. 限流

- `/api/auth/*` 由 Better Auth 内置限流与 `hooks.ts` 负责（[auth.md](./auth.md) 第 2、3 节）。
- `/api/v1/*` 的计数函数 `consume()` 放在 `src/server/rate-limit.ts`，Better Auth 的 `hooks.ts` 也调用它。计数存 PostgreSQL（`rate_limit_counters` 表，`INSERT … ON CONFLICT … DO UPDATE … RETURNING` 一条语句完成计数和判断，键为 `<规则名>:<subject>:<窗口起点秒>`），不引入 Redis。
- 实际限流分层：
  1. **后台可调参数（`app_settings` 表 / `src/server/settings-schema.ts`）**：由对应服务或 auth hook 读取 `getSettings()` 动态生效——包括 AI 每小时次数 `aiHourlyLimit`（默认 60）、AI 并发 `aiConcurrency`（默认 2）、兑换码失败锁定阈值 `redeemFailLockThreshold`（默认 5），以及登录/注册的 `otpPerIpDaily`（默认 500）、`otpPerEmailDaily`（默认 100）、`signupPerIpDaily`（默认 100）。
  2. **路由内置限流（`src/server/api/middleware/rate-limit.ts`）**：在路由 `middleware` 声明固定短窗口规则，防连点与接口爆破，包括：
     - `POST /ai/diet-recognitions`、`POST /ai/smart-recognitions`：`ai-recognition-minute`（`by: 'user'`，60 秒 6 次）
     - `POST /agent/chat`：`agent-chat-minute`（`by: 'user'`，60 秒 6 次）
     - `POST /goals/{goalId}/referee`：`referee-minute`（`by: 'user'`，60 秒 8 次）
     - `POST /redeem-codes/redeem`：`redeem-ip-hourly`（`by: 'ip'`，3600 秒 30 次）
     - `GET /app/update`：`app-update-minute`（`by: 'ip'`，60 秒 30 次）
- 超限返回 429 `RATE_LIMITED`，带 `retryAfterSeconds` 与 `Retry-After` 头（秒）。
- 客户端 IP 由 `src/server/auth/ip.ts` 的 `clientIp()` 提取，只取 `x-real-ip`（Nginx 写入，见 `scripts/deploy/nginx-daydayon.conf`）。本地开发没有这个头时记为 `127.0.0.1`。不读 `x-forwarded-for`。

## 9. 幂等

- 会扣额度或创建资源（含发送交互/消息）的写操作必须校验幂等键，包括：引导完成、创建目标、创建打卡、创建待办、非流式 AI 识别、兑换码兑换、好友邀请/接受/宠物互动/私聊消息、后台调整额度与批量生成兑换码。
- **普通（非流式）写操作**：统一在路由 `middleware` 挂 `idempotency()`（批量生成兑换码 `POST /admin/redeem-codes` 传 `idempotency({ storeBody: false })`，不落库明文兑换码），并在 `request.headers` 声明 `IdempotencyHeadersSchema`，校验小写的 `'idempotency-key'` UUID 请求头（客户端为每次用户操作生成一个 `crypto.randomUUID()`，重试时复用）。
  - 服务端在 `idempotency_keys` 表记录 `(userId, key) → requestHash、status、response`，保留 24 小时。同一个键再次到达时：
    - 摘要相同、已完成 → 原样返回第一次的响应（并附带 `Idempotent-Replayed: true` 头）；`storeBody: false` 时返回 409 `IDEMPOTENCY_KEY_REUSED`；
    - 摘要相同、还在处理 → 409 `REQUEST_IN_PROGRESS`；
    - 摘要不同 → 409 `IDEMPOTENCY_KEY_REUSED`。
  - 5xx、`402 QUOTA_INSUFFICIENT`、`429 RATE_LIMITED` 或非 `ApiError` 异常时会清理占位记录允许同键重试；其余状态码（含 `422 AI_RECOGNITION_FAILED`，因已发生计费）均会被记住并重放。
- **流式接口（`POST /agent/chat`、`POST /goals/{goalId}/referee`）**：流式响应体无法缓存在 `idempotency_keys` 里重放，因此不挂 `idempotency()` 中间件，而是在 JSON 请求体传 `idempotencyKey: z.uuid()`，并在额度账本层（`ai_runs` 表的 `(user_id, idempotency_key)` + `rejectReusedKey()`）校验幂等：进行中返回 409 `REQUEST_IN_PROGRESS`，已结束返回 409 `IDEMPOTENCY_KEY_REUSED`。

## 10. 列表与分页

- 列表接口默认分页，用游标：`?cursor=&limit=`，`limit` 默认 20、最大 100。响应为 `{ items: [...], nextCursor: string | null }`。
- 游标是服务端编码的不透明字符串，客户端不解析、不拼。
- 后台表格可以用偏移分页 `?offset=&limit=`（数据量小，需要跳页）。
- 筛选参数名用小写单词。接口收到非法值返回 400（页面的查询参数是静默回落到默认值，接口不这样做）。

## 11. 上传与图片大小限制

- `multipart/form-data` 上传接口（`POST /ai/diet-recognitions`、`POST /ai/smart-recognitions`）：
  - 文件字段名为 `image`（及可选 `image2`），只接受 `image/jpeg`（浏览器已压缩成 JPEG，见 [ai-and-quota.md](./ai-and-quota.md) 第 5 节）。
  - 在 `createRoute` 的 schema 里通过 `import { z } from '@hono/zod-openapi'` 写 `z.unknown().openapi({ type: 'string', format: 'binary' })`，handler 内用 `c.req.valid('form')` 取出后在内存校验文件类型、JPEG 文件头（`FF D8 FF`）与大小（≤ 4 MB）。
  - 路由挂 `hono/body-limit`，上限 `4 MB + 64 KB`（`IMAGE_MAX_BYTES + MULTIPART_OVERHEAD_BYTES`），超限返回 413 `PAYLOAD_TOO_LARGE`。Nginx 的 `client_max_body_size` 是 `12m`，比应用宽松，以应用的上限为准。
- Agent 内联图片对话路由（`POST /agent/chat`）：
  - 请求体为 JSON，支持在 `message.parts` 中内联最多 2 张 `data:image/jpeg;base64,...` 文件片段（每张解码后 ≤ 4 MB，由 `validateInlineJpegDataUrl()` 在内存校验）。
  - 考虑 Base64 编码约 33% 膨胀及上下文余量，路由挂 `bodyLimit({ maxSize: 11 * 1024 * 1024 })`（`11 MB`），超限返回 413 `PAYLOAD_TOO_LARGE`。
- 服务端只在内存里处理图片，禁止落盘、入库或记入日志，规则见 [ai-and-quota.md](./ai-and-quota.md) 第 5 节。

## 12. 流式响应

- 流式接口（`POST /agent/chat`、`POST /goals/{goalId}/referee`）均已用 `createRoute` 纳入 OpenAPI（200 响应声明 `content: { 'text/event-stream': { schema: z.string() } }`）。
- AI 回复使用 AI SDK 的 UI message stream（SSE），前端通过 `@ai-sdk/react` 消费。
- Nginx 已为本站设置 `proxy_buffering off` 和 `proxy_read_timeout 180s`，流式响应不会被缓冲。
- 流式接口同样先预占额度，流结束或中断时结算，幂等性在额度账本层（`ai_runs` + `rejectReusedKey()`）保证。

## 13. 版本演进

- 兼容的改动（加可选字段、加新接口）直接加。
- 不兼容的改动升级为 `/api/v2/`，旧版本保留到客户端全部迁移完。
- 删除字段前，先在 schema 里标 `deprecated`（`.meta({ deprecated: true })`）并保留至少一个发布周期。

## 14. 工具强制

| 规则 | 形式 | 状态 |
|---|---|---|
| `hono`、`@hono/zod-openapi` 只在 `src/server/api/`、`src/app/api/v1/`、`src/lib/api/client.ts` 出现 | ESLint `no-restricted-imports`（`eslint.config.mjs`） | 已落地 |
| `import { z } from '@hono/zod-openapi'` 只在 `src/server/api/` | ESLint `no-restricted-imports`（`eslint.config.mjs`） | 已落地 |
| 关键接口的鉴权、错误码与 OpenAPI 契约一致性 | Vitest + `app.request()`（`src/server/api/app.test.ts` 与 `routes/*.test.ts`） | 已落地 |
| OpenAPI 文件与代码一致 | CI 重新导出并 `git diff --exit-code` | 待补入 `.github/workflows/ci.yml` |


