# 测试规范

> 日期：2026-10-31 · 状态：初版。本文档由初始化时联网调研生成，条目未经实战验证，踩坑后按 [lessons 机制](../lessons/README.md)修订。
> 依据：[ADR-0018](../adr/0018-testing.md)（Vitest 5）。
> 官方资料（2026-10-31 抓取）：Next 16.4 自带文档的 Vitest 指南、Vite 配置文档（`resolve.tsconfigPaths`）、AI SDK Testing 文档、`@hono/zod-openapi` README（`app.request()`）、vitest@5.0.5 的 registry 数据。库的坑见 [lessons/vitest.md](../lessons/vitest.md)。

## 1. 分工

| 层 | 工具 | 覆盖什么 |
|---|---|---|
| 单元测试 | Vitest | 纯函数：时间、计价与额度、邮箱策略、动态表单 schema、热量计算、连续打卡、排行榜计分 |
| 纯组件静态渲染测试 | Vitest + `react-dom/server` | 纯组件或无浏览器副作用的 UI 片段：在 Node 环境用 `renderToStaticMarkup` 核对角色名称、ARIA 属性、条件显隐与关键文案（`.test.tsx`） |
| 接口测试 | Vitest + Hono 的 `app.request()` | 鉴权、入参校验、错误码 |
| 界面验收 | ego-browser | 手机 390px、桌面 1280px 实际操作（AGENTS.md Definition of Done 第 4 条） |

- 不安装 `jsdom`、Testing Library、`@vitejs/plugin-react`。可用 `react-dom/server` 的 `renderToStaticMarkup` 在 Node 环境对纯组件做 `.test.tsx` 静态渲染测试（配合 `vi.mock` 隔离路由或数据 hook）；完整交互与视觉验收靠 Playbook 批注和 ego-browser。
- Vitest 不支持 async Server Component（Next 文档），这类组件只做 ego-browser 验收。

## 2. 必须有测试的代码

- `src/lib/time/` 的全部函数（必测场景见 [time-and-dates.md](./time-and-dates.md) 第 6 节）
- `src/server/ai/pricing.ts` 与 `src/server/quota/` 的金额计算（[ai-and-quota.md](./ai-and-quota.md) 第 10 节）
- `src/server/auth/email-policy.ts`（[auth.md](./auth.md) 第 4 节）
- 动态表单的 `buildSchema()`
- 热量缺口、连续打卡天数、排行榜计分
- 修 bug 时先写一个能复现它的测试，再修。

## 3. 写法

- 测试文件和被测文件放在一起：`week-key.ts` 旁边是 `week-key.test.ts`。
- 用例名用中文描述行为：`it('周日 23:59 仍属于本周')`。
- 不依赖当前时间和系统时区：`now` 作为参数传入，时刻用固定的字面量。
- 不连接真实的外部服务：
  - DeepSeek 用 `ai/test` 的 `MockLanguageModelV4`；
  - SMTP 用一个记录调用的假 transport；
  - 接口测试里 mock service 层。
- 数据库集成测试（额度原子更新、幂等键冲突）在 M3 评估：CI 增加 PostgreSQL service 容器后再写。在此之前，把金额规则写成纯函数单独测试。

## 4. 配置

- `vitest.config.ts`：
  - `resolve.tsconfigPaths: true`：Vite 8 内置，用来解析 `@/` 别名，不安装 `vite-tsconfig-paths`；
  - `test.environment: 'node'`、`test.include: ['src/**/*.test.{ts,tsx}']`（同时覆盖 `.test.ts` 与 `.test.tsx`）；
  - `resolve.alias` 把 `server-only` 指向空模块 `src/test/server-only-stub.ts`：项目没有安装 `server-only` 包（Next 在内部处理它），Vitest 里不加别名会解析失败。
- `vite` 安装 8.x（vitest 5 的 peer 依赖接受 6 / 7 / 8；`resolve.tsconfigPaths` 是 Vite 8 文档里的选项）。
- 脚本：`"test": "vitest run"`。`vitest` 不带 `run` 默认进入监听模式，会让 CI 和代理环境挂住；本地需要监听时手动执行 `pnpm vitest`。
- `pnpm test` 已接入 CI 的 `verify` job，并写入 AGENTS.md 的 Definition of Done。
- v0.1 不设覆盖率门槛。

