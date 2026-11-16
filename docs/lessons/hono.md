# lessons — Hono（hono、@hono/zod-openapi）

> 适用版本：hono@4.13.14、@hono/zod-openapi@1.6.3。以下条目已对照当前源码与 `src/server/api/` 实测核对。

### 照 Next.js 指南安装 @hono/vercel
- 症状：为了一个 `handle()` 多装一个包（`@hono/vercel` 于 2026-09-28 发布）。
- 根因：官方指南为 Vercel 部署写；Next Route Handler 本身接收 `Request`、返回 `Response`。
- 规则：`route.ts` 里写 `const handler = (request: Request) => app.fetch(request)`，不装适配器。
- 元：hono@4.13.14 | 2026-10-31 | 候选毕业方向：无

### 带参数的子应用挂载路径写成 {param}
- 症状：`app.route('/books/{bookId}', sub)` 匹配不到任何请求。
- 根因：`.route()` 的挂载路径用 Hono 语法 `:bookId`；只有 `createRoute` 的 `path` 用 OpenAPI 语法 `{bookId}`。
- 规则：挂载用 `:param`，路由定义用 `{param}`（当前项目路由直接在子应用内写完整路径，由根应用 `.route('/', sub)` 统一挂载）。
- 元：@hono/zod-openapi@1.6.3 | 2026-10-31 | 候选毕业方向：无

### JSON 请求返回 415 或拿到空对象
- 症状：请求被拒为 415；或请求体缺失时 `c.req.valid('json')` 得到 `{}`。
- 根因：声明了 JSON body 的路由要求请求带匹配的 `Content-Type`；`required` 默认是 `false`，缺请求体也能进 handler。
- 规则：JSON 请求体一律 `required: true`；前端 fetcher 统一设置 `Content-Type: application/json`。
- 元：@hono/zod-openapi@1.6.3 | 2026-10-31 | 候选毕业方向：封装层（`src/lib/api/`）

### 请求头 schema 用了大写键
- 症状：定义了 `Idempotency-Key` 的 header schema，校验总是失败。
- 根因：README 规定 header schema 的键必须小写。
- 规则：写 `'idempotency-key'`、`authorization`。
- 元：@hono/zod-openapi@1.6.3 | 2026-10-31 | 候选毕业方向：无

### 单独测子路由或未在根应用挂 defaultHook 时校验失败格式不一致
- 症状：直接调未挂载的子路由 `sub.request()` 时返回 `@hono/zod-openapi` 默认的 `{ success: false, error }`，缺少 `VALIDATION_FAILED` 和 `fields`。
- 根因：`@hono/zod-openapi@1.6.3` 在请求时通过 `#parentApp` 向上解析父实例的 `defaultHook`，子路由只有挂到 `app.ts`（`base = new OpenAPIHono<AppEnv>({ defaultHook })`）上才会继承。
- 规则：根应用 `src/server/api/app.ts` 统一配置把 `ZodError` 转为 `400 { code: 'VALIDATION_FAILED', detail, fields }` 的 `defaultHook`；子路由用 `new OpenAPIHono<AppEnv>()`，集成测试一律测根 `app.request()`。
- 元：@hono/zod-openapi@1.6.3 | 2026-11-16 | 候选毕业方向：已沉淀到 `src/server/api/app.ts`

### hc<AppType> 要拿到完整路由类型必须用链式 .route() 导出类型
- 症状：`api.api.v1.goals.$get` 类型为 `unknown` 或报属性不存在。
- 根因：分开调用 `app.route('/', goalsRouter)` 不会改变 `app` 变量的静态类型参数。
- 规则：入口 `src/server/api/app.ts` 用链式 `export const app = base.route('/', meRoutes).route(...)` 赋值并 `export type AppType = typeof app`。
- 元：hono@4.13.14、@hono/zod-openapi@1.6.3 | 2026-11-16 | 候选毕业方向：已沉淀到 `src/server/api/app.ts`

### multipart/form-data 上传文件在 zod 4 下不要用 z.instanceof(File) 生成 OpenAPI
- 症状：`pnpm openapi:export` 生成文档时，含 `z.instanceof(File)` 或 `z.instanceof(Blob)` 的路由报 `Unsupported zod type: ZodCustom`。
- 根因：`@hono/zod-openapi` 的 schema 转换器无法把 `z.instanceof` 转为 JSON Schema，除非显式加 `.openapi({ type: 'string', format: 'binary' })`。
- 规则：上传接口在 `src/server/api/routes/ai.ts` 从 `@hono/zod-openapi` 导入 `z` 并写 `z.unknown().openapi({ type: 'string', format: 'binary' })`，handler 内用 `c.req.valid('form')` 取出后在 `imageToFilePart()` 中用 `instanceof Blob` 校验大小与 JPEG 头。
- 元：@hono/zod-openapi@1.6.3、zod@4.6.7 | 2026-11-16 | 候选毕业方向：已沉淀到 `src/server/api/routes/ai.ts`

### hono/csrf 会把无 Content-Type 的写请求（如 DELETE）当成 text/plain 拦截
- 症状：无 `Content-Type` 的 `DELETE` 或 `multipart/form-data` 请求未带 `origin` / `sec-fetch-site` 时返回 `403`（`HTTPException(403)`）；若构建期直接读 `env.NEXT_PUBLIC_APP_URL` 还会触发环境变量校验。
- 根因：`hono/csrf` 源码对非 `GET|HEAD|OPTIONS` 且 `content-type || "text/plain"` 命中表单类型（`x-www-form-urlencoded`、`multipart/form-data`、`text/plain`）的请求校验 `sec-fetch-site` 或 `origin`，不通过即抛 `HTTPException(403)`。
- 规则：`app.ts` 使用 `csrf({ origin: (origin) => origin === new URL(env.NEXT_PUBLIC_APP_URL).origin })` 懒读取 `env`，并在 `onError` 中把 `HTTPException(403)` 映射为 `{ code: 'FORBIDDEN' }`；测试里对 `DELETE` / `multipart` 请求显式附带 `sec-fetch-site: same-origin`。
- 元：hono@4.13.14 | 2026-11-16 | 候选毕业方向：已沉淀到 `src/server/api/app.ts`

