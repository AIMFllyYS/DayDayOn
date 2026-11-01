# lessons — Hono（hono、@hono/zod-openapi）

> 适用版本：hono@4.13.14、@hono/zod-openapi@1.6.3（M3 安装）。以下条目来自 2026-10-31 对 Hono 官网和 `@hono/zod-openapi` README 的核对，尚未在本项目代码里踩到。

### 照 Next.js 指南安装 @hono/vercel
- 症状：为了一个 `handle()` 多装一个包（`@hono/vercel` 于 2026-09-28 发布）。
- 根因：官方指南为 Vercel 部署写；Next Route Handler 本身接收 `Request`、返回 `Response`。
- 规则：`route.ts` 里写 `const handler = (request: Request) => app.fetch(request)`，不装适配器。
- 元：hono@4.13.14 | 2026-10-31 | 候选毕业方向：无

### 带参数的子应用挂载路径写成 {param}
- 症状：`app.route('/books/{bookId}', sub)` 匹配不到任何请求。
- 根因：`.route()` 的挂载路径用 Hono 语法 `:bookId`；只有 `createRoute` 的 `path` 用 OpenAPI 语法 `{bookId}`。
- 规则：挂载用 `:param`，路由定义用 `{param}`。
- 元：@hono/zod-openapi@1.6.3 | 2026-10-31 | 候选毕业方向：无

### JSON 请求返回 415 或拿到空对象
- 症状：请求被拒为 415；或请求体缺失时 `c.req.valid('json')` 得到 `{}`。
- 根因：声明了 JSON body 的路由要求请求带匹配的 `Content-Type`；`required` 默认是 `false`，缺请求体也能进 handler。
- 规则：JSON 请求体一律 `required: true`；前端 fetcher 统一设置 `Content-Type: application/json`。
- 元：@hono/zod-openapi@1.6.3 | 2026-10-31 | 候选毕业方向：封装层（`src/lib/api/fetcher.ts`）

### 请求头 schema 用了大写键
- 症状：定义了 `Idempotency-Key` 的 header schema，校验总是失败。
- 根因：README 规定 header schema 的键必须小写。
- 规则：写 `'idempotency-key'`、`authorization`。
- 元：@hono/zod-openapi@1.6.3 | 2026-10-31 | 候选毕业方向：无

### OpenAPIHono 默认校验失败格式与项目错误体不一致，且子路由不继承 defaultHook
- 症状：参数校验失败时返回 `@hono/zod-openapi` 默认的 `{ success: false, error }`，前端 `isApiError` 拿不到 `VALIDATION_FAILED` 和 `fields`。
- 根因：`new OpenAPIHono()` 各自维护自己的 `defaultHook`，通过 `.route()` 挂载的子实例不会继承父实例的 `defaultHook`。
- 规则：所有路由实例一律用 `src/server/api/factory.ts` 的 `createRouter()` 创建，内部统一挂载把 `ZodError` 转为 `400 { code: 'VALIDATION_FAILED', detail, fields }` 的 `defaultHook`。
- 元：@hono/zod-openapi@1.6.3 | 2026-11-01 | 候选毕业方向：已沉淀到 `src/server/api/factory.ts`

### hc<AppType> 要拿到完整路由类型必须用链式 .route() 导出类型
- 症状：`api.api.v1.goals.$get` 类型为 `unknown` 或报属性不存在。
- 根因：分开调用 `app.route('/goals', goalsRouter)` 不会改变 `app` 变量的静态类型参数。
- 规则：入口 `src/server/api/index.ts` 用链式 `const routes = createRouter().basePath('/api/v1').route('/me', meRoutes).route(...)` 赋值并 `export type AppType = typeof routes`。
- 元：hono@4.13.14、@hono/zod-openapi@1.6.3 | 2026-11-01 | 候选毕业方向：已沉淀到 `src/server/api/index.ts`

### multipart/form-data 上传文件在 zod 4 下不要用 z.instanceof(File) 生成 OpenAPI
- 症状：`pnpm openapi:export` 生成文档时，含 `z.instanceof(File)` 或 `z.instanceof(Blob)` 的路由报 `Unsupported zod type: ZodCustom`。
- 根因：`@hono/zod-openapi` 的 schema 转换器无法把 `z.instanceof` 转为 JSON Schema，除非显式加 `.openapi({ type: 'string', format: 'binary' })`。
- 规则：上传接口在 `createRoute` 的 OpenAPI schema 上写 `z.any().openapi({ type: 'string', format: 'binary' })`，进入 handler 后通过 `await c.req.parseBody()` 取出值并用 `value instanceof Blob` 做运行时校验与大小/MIME 检查。
- 元：@hono/zod-openapi@1.6.3、zod@4.6.7 | 2026-11-01 | 候选毕业方向：已沉淀到 `src/server/api/routes/diet.ts`

