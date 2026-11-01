# Code Review 检查清单

> AI 编码代理在 code review 或自我审查时逐项检查。

## 文件组织与职责

- 文件或函数是否职责混杂、存在明显的自然接缝却没有拆分（看职责，不看行数）
- 放置位置是否符合 colocation：单路由专用代码不应提升到 `src/features/`；跨路由领域模块不应散落在各路由里

## Next.js 16

- `'use client'` 是否只出现在叶子组件
- `params` / `searchParams` / `cookies()` / `headers()` 是否都 `await` 了
- 读会话的组件是否在 `<Suspense>` 里；layout 顶层是否 `await` 了会话
- 是否残留 `middleware.ts`

## 架构

- 业务写操作是否走 `/api/v1`，有没有用 Server Actions 写业务
- `src/server/services/` 是否 import 了 `next/*` 或 React
- 错误响应体是否为 `{ code, detail }`
- 请求体、AI 输出是否经过 zod 校验

## 安全与隐私

- 有没有把用户图片写入磁盘、数据库或日志（包括 base64 字符串）
- 日志里有没有邮箱验证码、token、密钥
- 新接口是否鉴权，是否只能访问当前用户自己的数据
- 新的写接口、AI 接口是否有限流
- 管理接口是否检查管理员身份

## AI 与额度

- 是否只使用 `deepseek-flash`
- 调用前是否预占额度、结束后是否结算、失败是否释放；是否带幂等键
- 金额是否用整数微元计算

## 库的用法（对照各落地规范）

- 新接口是否用 `createRoute` 写全请求与响应（含错误响应），`docs/specs/api/openapi.json` 是否随之更新（[api-conventions.md](./api-conventions.md)）
- 会扣额度或创建资源的 POST 是否要求 `idempotency-key`；列表接口是否分页
- 查询是否带 `userId` 条件、是否有 `limit`；余额变动是否用带条件的原子更新，有没有"先查再改"（[database.md](./database.md)）
- 迁移 SQL 是否读过；有没有出现 `drizzle-kit push`
- 时间计算是否都经过 `src/lib/time/`，有没有依赖系统时区的写法（[time-and-dates.md](./time-and-dates.md)）
- 是否写成 `import * as z from 'zod'`；前后端共用的 schema 有没有从 `@hono/zod-openapi` 导入 `z`
- 业务组件有没有直接 `fetch('/api/v1/…')`、直接 import `@tanstack/react-query` 或 `@base-ui/react`（[client-data-and-forms.md](./client-data-and-forms.md)、[ui-primitives.md](./ui-primitives.md)）
- AI 调用是否经过 `runAi()`，prompt 是否显式声明了 `thinking` 和 `maxOutputTokens`（[ai-and-quota.md](./ai-and-quota.md)）
- 新增的纯函数规则是否有测试（[testing.md](./testing.md)）

## 依赖（按最高风险等级审）

- `package.json` 有改动时：新包是否已登记在 [libraries.md](../libraries.md)，有没有和已有所有者重叠的同类库
- 新包是否核实过真实存在、最近发版时间、许可证、有无 `preinstall` / `postinstall` 脚本
- 有没有装 libraries.md"不需要单独安装的包"里列出的包（如 `@types/nodemailer`、`@hono/vercel`、`vite-tsconfig-paths`）
- 业务代码是否绕过封装层直接 import 第三方包名
- `pnpm-lock.yaml` 的变化是否只来自这次声明的依赖

## 部署

- 是否往 `public/` 放了大文件
- 新增环境变量是否同步写进 `.env.example`
- 数据库结构变更是否附带迁移文件

## 界面

- 是否只用设计 token 和语义字号，有没有写死色值或 `text-sm` 一类类名
- 新的可复用组件是否先在 `/dev/playbook` 登记
- 可点区域是否 ≥ 44px；图标按钮、进度条、开关是否有可读名称
- AI 结果是否以草稿呈现、需要用户确认后才入库
- 新路由是否符合 [routing.md](./routing.md)（kebab-case、`[entityId]` 命名、`title` 与导航一致）

## dev/ 隔离

- `src/app/dev/` 的 layout 是否保留 production 守卫
- 正式代码是否引用了 `dev/`
