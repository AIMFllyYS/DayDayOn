# ADR-0016：接口层与契约——Hono + @hono/zod-openapi

- 状态：Accepted（负责人 2026-10-31 拍板：Phase 3 的 17 项建议全部采纳）
- 日期：2026-10-31
- 决策人：项目负责人（AI 提供分析）
- 对比页：[docs/designs/library-showcase/13-api-layer.html](../designs/library-showcase/13-api-layer.html)

## 背景

- /api/v1 统一 REST，Web、APK 壳、未来 Kotlin 共用
- 输出 OpenAPI 契约给 Kotlin 生成客户端
- 中间件：鉴权、限流、幂等键、统一错误体 { code, detail }
- 浏览器端有类型的客户端

先定的层：挂在 Next Route Handler 里的轻量 API 框架，能从 zod schema 生成 OpenAPI。

## 面临的选项

- **Hono 4 + @hono/zod-openapi**（`hono`）：推荐。契约、中间件、类型化客户端一次解决。
- **oRPC**（`@orpc/server`）：备选。等 v2 稳定后可以再看。
- **原生 Route Handler + zod**：备选。OpenAPI、中间件链、类型化客户端都要自己写。

## 决定

Hono + @hono/zod-openapi，版本 hono 4.13.14、@hono/zod-openapi 1.6.3。

- 封装层入口：src/app/api/v1/[[...route]]/route.ts 挂载；路由按领域写在 src/server/api/<领域>.ts；错误码登记在 src/server/api/errors.ts
- handler 只做四件事：解析入参 → requireUser() → 调 service → 映射结果
- OpenAPI 导出到 docs/specs/api/openapi.json 并提交，CI 检查与代码一致

## 理由

契约、中间件、类型化客户端一次解决。

- hono 0 个依赖
- @hono/zod-openapi：peer zod ^4、hono ≥ 4.10，从路由定义生成 OpenAPI 文档
- App Router 用法：app/api/[[...route]]/route.ts（Hono 官方 Next.js 指南）

## 放弃了什么

- oRPC：v2 大版本过渡中
- 原生 Route Handler：契约和中间件要全部手写

已知代价：多两个服务端依赖（不进客户端包）。

## 何时重审

- oRPC v2 稳定且需要 RPC 风格时
