# MVP 落地计划（多 Agent 并行）

> 日期：2026-11-01 · 状态：执行中 · 需求见 [prd-v0.1.md](../specs/prd-v0.1.md)，顺序对应 [roadmap.md](./roadmap.md) 的 M1–M4
> 工作分支 `feat/mvp-v0.1`（从 `dev` 切出）。负责人已授权本轮：安装 libraries.md 登记的依赖、本地 Docker 数据库与迁移、工具链配置、本地提交。push、PR、服务器操作仍需单独同意。

## 1. 阶段

| 阶段 | 内容 | 并行方式 | 完成标准 |
|---|---|---|---|
| F0 引导 | 装全部依赖（精确版本）、vitest / drizzle 配置、ESLint 封装层禁令、`package.json` 脚本、本地 Docker PG、`.env.local` | 单 Agent，主工作区 | `pnpm check`、`pnpm test`、`pnpm build` 通过，提交 |
| F1 契约 | 数据库 schema（全部表）与首个迁移、Better Auth 实例与表、`env.ts`、错误码表、各领域 zod 契约、query key、错误文案、Hono 根应用与各领域空路由、跨领域组件的占位、Playbook 占位页 | 单 Agent，主工作区 | 同上；迁移已在本地执行 |
| F2 平台 | P1 服务端平台 · P2 时间与图片 · P3 交互原语 · P4 数据展示组件 | 4 个 Agent，各自 worktree | 各自分支通过检查后合并 |
| F3 外壳 | 合并 F2；`(auth)` / `(app)` 布局、应用外壳、打卡弹层挂载点 | 单 Agent，主工作区 | 同上 |
| F4 领域 | D1–D7 七个领域 | 7 个 Agent，各自 worktree | 各自分支通过检查后合并 |
| F5 验收 | 规范与安全审查、修复、ego-browser 双宽度走查 | 审查并行，修复串行 | Definition of Done |

## 2. 协作规则（所有 Agent 必须遵守）

- **F0 之后不改依赖**。`package.json` 的 dependencies / devDependencies、`pnpm-lock.yaml` 只有 F0 能改。
- **F1 之后 schema 冻结**。`src/server/db/schema/`、`migrations/` 只有 F1 能改。领域需要改表时，在返回结果里写明，由集成阶段统一处理。
- **共享注册点只由 F1 写**：`src/server/api/errors.ts`、`src/server/api/app.ts`（挂载）、`src/lib/api/keys.ts`、`src/lib/api/error-messages.ts`、`src/features/*/schemas.ts`、`src/app/dev/playbook/_components/playbook-nav.tsx`。领域 Agent 需要改它们时，不改，写进返回结果的 `sharedChangeRequests`。
- 每个 Agent 只改第 3 节"拥有"列里的路径，其余只读。
- 页面视觉以 `src/app/dev/playbook/pages/_screens/` 的原型为准。正式代码不能引用 `src/app/dev/`：把原型改写成 `src/features/<领域>/components/` 里的正式组件，再让 Playbook 的原型页反过来引用正式组件。
- 服务端每个模块顶部 `import 'server-only'`；service 不 import `next/*`、`hono`。
- worktree 里先 `pnpm install --frozen-lockfile`，再从主工作区复制 `.env.local`。不启动 `pnpm dev`（端口留给 F5 验收）。
- 完成前在自己的工作区跑 `pnpm check`、`pnpm test`、`pnpm build`，全部通过再提交到自己的分支 `wf/<代号>`。提交信息用 Conventional Commits，结尾带 `Co-Authored-By` 行。

## 3. 模块归属

| 代号 | 模块 | 拥有的路径 |
|---|---|---|
| F1 | 契约 | `src/server/db/**`、`drizzle.config.ts`、`src/server/env.ts`、`src/server/auth/auth.ts`、`src/server/api/{app,errors,schemas}.ts`、`src/server/api/routes/*.ts`（空壳）、`src/features/*/schemas.ts`、`src/features/goal/build-schema.ts`、`src/lib/api/{keys,error-messages}.ts`、`scripts/dev/seed.ts`、Playbook 占位页与目录 |
| P1 | 服务端平台 | `src/server/auth/`（除 `auth.ts` 的表结构部分）、`src/server/api/middleware/`、`src/server/api/openapi.ts`、`src/server/rate-limit.ts`、`src/server/idempotency.ts`、`src/server/mail/`、`src/server/quota/`、`src/server/ai/{model,run,pricing,image}.ts`、`src/app/api/auth/`、`src/app/api/v1/`、`src/proxy.ts`、`src/lib/auth-client.ts`、`src/lib/api/{index,client,fetcher,query-client,provider}.ts*`、`scripts/dev/export-openapi.ts` |
| P2 | 时间与图片 | `src/lib/time/**`、`src/lib/image/**` |
| P3 | 交互原语 | `src/components/ui/` 下 ui-primitives.md 第 1 节列出的 Base UI 封装、`src/app/layout.tsx`、`src/app/globals.css`、Playbook「交互原语」页 |
| P4 | 数据展示 | `src/components/ui/{calendar,date-field,time-field,time-range-field,empty-state,error-state,image-picker}.tsx`、`src/components/charts/**`、`src/components/mascot/preset-avatar.tsx`、Playbook「数据与时间」页 |
| F3 | 外壳 | `src/app/(auth)/layout.tsx`、`src/app/(app)/layout.tsx`、`src/components/layout/app-shell.tsx`、`src/features/checkin/components/checkin-launcher.tsx`（挂载点）、删除 `src/app/page.tsx` |
| D1 | 账号 | 登录、引导、我的、资料、隐私页；`services/{me,onboarding}`、`routes/me.ts`、`features/{auth,onboarding,me}`、`queries/me.ts` |
| D2 | 目标 | `/goals/**`（除 checkin）；`services/goals`、`routes/goals.ts`、`features/goal`（除 `schemas.ts`、`build-schema.ts`）、`queries/goals.ts` |
| D3 | 打卡与指标 | `/goals/[goalId]/checkin`；`services/{checkins,metrics}`、`routes/{checkins,metrics}.ts`、`features/{checkin,metric}`（除挂载点）、`queries/{checkins,metrics}.ts` |
| D4 | 主页与排行 | `(app)/page.tsx`、`/rank`；`services/{dashboard,rank}`、`routes/{dashboard,rank}.ts`、`features/{dashboard,rank}`、`queries/{dashboard,rank}.ts` |
| D5 | 待办 | `/todo`；`services/todos`、`routes/todos.ts`、`features/todo`、`queries/todos.ts` |
| D6 | AI 识别与额度 | `src/server/ai/prompts/`、`services/{diet-recognition,redeem,quota-view}`、`routes/{ai,redeem}.ts`、`features/{diet,quota}`、`queries/{ai,quota}.ts` |
| D7 | 后台 | `src/app/admin/**`；`services/admin`、`routes/admin.ts`、`features/admin`、`queries/admin.ts` |

跨领域依赖只通过 F1 定好的契约：D3 的饮食表单嵌入 D6 的 `features/diet/components/diet-recognizer.tsx`（F1 先放一个 props 已定的占位）；D7 调整额度调用 P1 的 `src/server/quota/ledger.ts`。
