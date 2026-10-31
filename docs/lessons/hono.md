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

