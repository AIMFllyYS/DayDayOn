# 接口规范（/api/v1）

> 日期：2026-10-31 · 状态：初版。本文档由初始化时联网调研生成，条目未经实战验证，踩坑后按 [lessons 机制](../lessons/README.md)修订。
> 依据：[ADR-0016](../adr/0016-api-layer.md)（Hono + @hono/zod-openapi）、[ADR-0002](../adr/0002-account-quota-risk.md)（额度、风控）、[routing.md](./routing.md) 第 6 节（路径命名）。
> 官方资料（2026-10-31 抓取）：Hono 的 Next.js 指南、`@hono/zod-openapi` README、`@asteasolutions/zod-to-openapi` README、Next 16.4 自带文档 Route Handlers 一节。库的坑见 [lessons/hono.md](../lessons/hono.md)。

## 1. 范围

| 路径 | 由谁处理 | 说明 |
|---|---|---|
| `/api/v1/*` | Hono（`src/server/api/`） | 全部业务接口。Web、APK 壳、Kotlin 客户端共用 |
| `/api/auth/*` | Better Auth 处理器 | 登录、会话、管理员操作，见 [auth.md](./auth.md)。不在 Hono 里重复实现 |
| `/api/health` | 原生 Route Handler | 部署健康检查，返回 commit |

- 业务写操作只走 `/api/v1`。禁止用 Server Actions 写业务数据。
- Server Component 读首屏数据时直接调 `src/server/services/`，不通过 HTTP 请求自己的 `/api/v1`。

## 2. 目录与挂载

```
src/app/api/v1/[[...route]]/route.ts   只把请求转给 Hono，不写任何逻辑
src/server/api/
├── app.ts            根应用：basePath('/api/v1')、全局中间件、onError、notFound、defaultHook，挂载各领域
├── errors.ts         错误码表与 ApiError
├── openapi.ts        生成 OpenAPI 文档的函数（供导出脚本调用）
├── schemas.ts        跨领域的通用 schema：错误体、分页、通用响应
├── middleware/       auth.ts（requireUser / requireAdmin）、rate-limit.ts、idempotency.ts
└── routes/<领域>.ts  每个领域一个 OpenAPIHono 子应用：goals.ts、checkins.ts、ai.ts、me.ts、admin.ts…
```

挂载不需要 `@hono/vercel`、`hono/vercel` 或 `@hono/node-server`。Hono 的 `app.fetch` 本身就是 `Request → Response`：

```ts
// src/app/api/v1/[[...route]]/route.ts
import { app } from '@/server/api/app'

const handler = (request: Request) => app.fetch(request)

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT }
```

- 处理器读取了 `request`，所以 `GET` 在 Cache Components 下不会被预渲染（Next 文档：读取 `req.url`、`request.headers` 会停止预渲染）。
- 子应用用 `.route()` 挂到根应用上。挂载路径里有参数时用 Hono 的 `:param` 写法（`/goals/:goalId`），`createRoute` 的 `path` 里用 OpenAPI 的 `{goalId}` 写法。
- 每个领域一个小的 `OpenAPIHono` 实例，再挂到根应用。不要在一个实例上链式注册全部路由，否则 `hc` 客户端的类型检查会明显变慢（官方 README）。
- 上下文变量（当前用户、请求 IP）的类型在 `app.ts` 定义一次：`type AppEnv = { Variables: { user: SessionUser; ip: string } }`，子应用都用 `new OpenAPIHono<AppEnv>()`。

## 3. 一个接口的写法

handler 只做四件事：取校验后的入参 → 取当前用户 → 调 service → 返回响应。业务规则写在 `src/server/services/`。

```ts
// src/server/api/routes/goals.ts（示意）
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { CreateGoalSchema, GoalSchema } from '@/features/goal/schemas'
import * as goals from '@/server/services/goals'
import type { AppEnv } from '../app'
import { requireUser } from '../middleware/auth'
import { errorResponses } from '../schemas'

const createGoal = createRoute({
  method: 'post',
  path: '/goals',
  middleware: [requireUser] as const,
  request: {
    body: { content: { 'application/json': { schema: CreateGoalSchema } }, required: true },
  },
  responses: {
    201: { content: { 'application/json': { schema: GoalSchema } }, description: '已创建' },
    ...errorResponses(400, 401, 409),
  },
})

export const goalRoutes = new OpenAPIHono<AppEnv>().openapi(createGoal, async (c) => {
  const goal = await goals.create(c.get('user').id, c.req.valid('json'))
  return c.json(goal, 201)
})
```

规则：

- 每个路由都用 `createRoute` 定义，写全 `request` 和 `responses`（包括错误响应）。不进 OpenAPI 的接口不允许存在；开发专用接口用 `hide: true`，并且只在开发环境注册。
- `c.json()` 必须写状态码，200 也要写。
- JSON 请求体写 `required: true`。客户端没带 `Content-Type: application/json` 会得到 415，这是预期行为。
- 请求头 schema 的键一律小写：`'idempotency-key'`，不是 `'Idempotency-Key'`。
- service 函数的入参是普通对象，不接收 Hono 的 `Context`，不 import `hono`。
- service 返回的就是接口响应的 DTO，handler 不再改形状。这样 Server Component 直接调 service 预取的数据，和浏览器从接口拿到的数据形状一致（[client-data-and-forms.md](./client-data-and-forms.md) 第 1 节）。

## 4. Schema 与 OpenAPI

- 领域 schema 写在 `src/features/<领域>/schemas.ts`，前后端共用，统一 `import * as z from 'zod'`。
- 需要出现在 OpenAPI `components/schemas` 里的 schema 用 zod 自带的 `.meta({ id: 'Goal' })` 命名（zod-to-openapi 8 起直接读取 `.meta`）。不用 `.openapi('Goal')`：它要求从 `@hono/zod-openapi` 导入扩展过的 `z`，会把这层依赖带进前端共用的 schema 文件。
- 只有 `src/server/api/` 可以 `import { z } from '@hono/zod-openapi'`，并且只用于路径参数、查询参数的 `.openapi({ param: … })` 元数据（这类元数据只能用 `.openapi` 表达）。
- 数据库行不能直接 `c.json(row)`，先映射成 DTO，只放客户端需要的字段。
- OpenAPI 文档导出为 OpenAPI 3.1（`app.getOpenAPI31Document(...)`），写入 `docs/specs/api/openapi.json` 并提交。CI 重新导出并比对，不一致就失败（M3 落地）。
- 生产环境不暴露文档接口；开发环境可以挂 `/api/v1/doc`。

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

- 响应体固定为 `{ "code": "GOAL_NOT_FOUND", "detail": "…" }`。`code` 是大写蛇形，全部登记在 `src/server/api/errors.ts`。前端只按 `code` 分支。
- `detail` 只给开发者看，不显示给用户。用户看到的文案由前端按 `code` 从 `src/lib/api/error-messages.ts` 取（ADR-0006）。
- 校验失败统一 400 `VALIDATION_FAILED`，额外带 `fields: { 字段名: string[] }`（由 `z.flattenError(error).fieldErrors` 生成），前端直接交给 Base UI `Form` 的 `errors`。在根应用的 `defaultHook` 里统一处理，单个路由不写自己的 hook。
- 根应用的 `onError` 兜底：记录错误（不记请求体），返回 500 `INTERNAL`。异常 message、堆栈、SQL 一律不返回给客户端。

| 状态码 | 用途 | `code` 例子 |
|---|---|---|
| 400 | 入参不合法 | `VALIDATION_FAILED`、`EMAIL_DOMAIN_NOT_ALLOWED` |
| 401 | 未登录或会话过期 | `UNAUTHENTICATED` |
| 402 | AI 额度不足 | `QUOTA_INSUFFICIENT` |
| 403 | 已登录但无权限、账号被封禁 | `FORBIDDEN`、`ACCOUNT_BANNED`、`TWO_FACTOR_REQUIRED` |
| 404 | 资源不存在，或不属于当前用户（两者不区分，防止探测别人的数据） | `GOAL_NOT_FOUND` |
| 409 | 状态冲突、重复操作 | `REDEEM_CODE_USED`、`IDEMPOTENCY_KEY_REUSED`、`REQUEST_IN_PROGRESS` |
| 413 | 请求体太大（图片） | `PAYLOAD_TOO_LARGE` |
| 415 | `Content-Type` 不对（Hono 自动返回） | — |
| 429 | 触发限流 | `RATE_LIMITED` |
| 503 | 全站 AI 暂停（达到每日上限或管理员手动暂停） | `AI_PAUSED` |
| 500 | 未预期的错误 | `INTERNAL` |

## 7. 鉴权

- 默认需要登录。每个路由在 `createRoute` 的 `middleware` 里挂 `requireUser`（或 `requireAdmin`）。不需要登录的接口必须在路由定义旁边注释原因。
- `requireUser` 用 `auth.api.getSession({ headers: c.req.raw.headers })` 取会话：取不到返回 401；账号被封禁返回 403 `ACCOUNT_BANNED`。细节见 [auth.md](./auth.md) 第 4 节。
- 资源归属在 service 的查询条件里校验（`where userId = 当前用户`），不在 handler 里"先查出来再比较"。
- CSRF：浏览器靠 cookie 会话。根应用对写请求挂 `hono/csrf`，允许的来源只有 `NEXT_PUBLIC_APP_URL`（中间件的具体校验范围在 M3 安装后读源码核对，并写进 lessons/hono.md）。APK / Kotlin 阶段改用 bearer token 后不受影响。
- 不开 CORS。Web 前端和接口同源；原生客户端不受 CORS 限制。

## 8. 限流

- `/api/auth/*` 由 Better Auth 内置限流负责（[auth.md](./auth.md) 第 2 节）。
- `/api/v1/*` 用中间件 `middleware/rate-limit.ts`。底层计数函数 `consume()` 放在 `src/server/rate-limit.ts`，Better Auth 的 hook 也调用它。计数存 PostgreSQL（`rate_limit_counters` 表，`INSERT … ON CONFLICT … DO UPDATE … RETURNING` 一条语句完成计数和判断），不引入 Redis。键为 `<规则名>:<userId 或 ip>:<窗口起点>`。
- 初始规则见 ADR-0002 第 6 节；阈值放配置表，后台可调。
- 超限返回 429 `RATE_LIMITED`，带 `Retry-After` 头（秒）。
- 客户端 IP 只取 `x-real-ip`（Nginx 写入，见 `scripts/deploy/nginx-daydayon.conf`）。本地开发没有这个头时记为 `127.0.0.1`。不读 `x-forwarded-for`。

## 9. 幂等

- 会扣额度或创建资源的 POST 必须带 `idempotency-key` 请求头（客户端为每次用户操作生成一个 `crypto.randomUUID()`，重试时复用）。包括：AI 调用、兑换码兑换、创建打卡（含确认 AI 草稿后的创建）。
- 服务端在 `idempotency_keys` 表记录 `(userId, key) → 请求摘要、状态、响应`，保留 24 小时。同一个键再次到达时：
  - 摘要相同、已完成 → 原样返回第一次的响应；
  - 摘要相同、还在处理 → 409 `REQUEST_IN_PROGRESS`；
  - 摘要不同 → 409 `IDEMPOTENCY_KEY_REUSED`。
- AI 额度的预占、结算使用同一个键（ADR-0002 第 5.2 节）。

## 10. 列表与分页

- 列表接口默认分页，用游标：`?cursor=&limit=`，`limit` 默认 20、最大 100。响应为 `{ items: [...], nextCursor: string | null }`。
- 游标是服务端编码的不透明字符串，客户端不解析、不拼。
- 后台表格可以用偏移分页 `?offset=&limit=`（数据量小，需要跳页）。
- 筛选参数名用小写单词。接口收到非法值返回 400（页面的查询参数是静默回落到默认值，接口不这样做）。

## 11. 上传

- 图片接口用 `multipart/form-data`，字段名 `image`，只接受 `image/jpeg`（浏览器已压缩成 JPEG，见 [ai-and-quota.md](./ai-and-quota.md) 第 5 节）。
- 路由挂 `hono/body-limit`，上限 4 MB。Nginx 的 `client_max_body_size` 是 12m，比应用宽松，以应用的上限为准。
- 服务端只在内存里处理，规则见 ai-and-quota.md 第 5 节。

## 12. 流式响应

- AI 回复用 AI SDK 的 UI message stream 响应，前端用 `@ai-sdk/react` 消费（具体方法名以安装版本的文档为准）。
- Nginx 已为本站设置 `proxy_buffering off` 和 `proxy_read_timeout 180s`，流式响应不会被缓冲。
- 流式接口同样先预占额度，流结束或中断时结算。

## 13. 版本演进

- 兼容的改动（加可选字段、加新接口）直接加。
- 不兼容的改动升级为 `/api/v2/`，旧版本保留到客户端全部迁移完。
- 删除字段前，先在 schema 里标 `deprecated`（`.meta({ deprecated: true })`）并保留至少一个发布周期。

## 14. 工具强制（待落地）

| 规则 | 形式 | 何时 |
|---|---|---|
| `hono`、`@hono/zod-openapi` 只在 `src/server/api/`、`src/app/api/v1/`、`src/lib/api/client.ts` 出现 | ESLint `no-restricted-imports` | M3 |
| `import { z } from '@hono/zod-openapi'` 只在 `src/server/api/` | ESLint `no-restricted-imports` | M3 |
| OpenAPI 文件与代码一致 | CI 重新导出并 `git diff --exit-code` | M3 |
| 关键接口的鉴权与错误码 | Vitest + `app.request()` | M3 起逐个补 |

