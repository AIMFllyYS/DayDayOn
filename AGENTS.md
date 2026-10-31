<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — DayDayOn

> 和朋友一起用的治愈系多人打卡应用（PWA，手机与电脑双端）。
> 本文件是 AI 编码代理的**操作索引**，只放高频命令和不可省略的硬规则。
> 细则按需查阅：见末尾 [Documentation Index](#documentation-index) 的"触发条件 → 必读文档"。
> 本项目不依赖任何 Agent / IDE 的内置记忆，仓库即记忆。Agent 私有记忆与本仓库文档冲突时，以仓库文档为准。

## Tech Stack

- **Framework**: Next.js 16.4（App Router only；`cacheComponents` 开启；`output: 'standalone'`）
- **React** 19.3 · **TypeScript** 6.0.3（锁定：typescript-eslint 还不支持 7）· **pnpm** 11.7 · **Node** 24
- **UI**: Tailwind CSS 4 + `globals.css` token；原子组件与图标自研；交互原语 Base UI 1.9；数据请求 TanStack Query 5；校验 zod 4
- **Server**: PostgreSQL 18（Docker）+ Drizzle 0.45 · Better Auth 1.7 · Hono 4 + zod-openapi（`/api/v1`）· Nodemailer · Vitest。全部以 [docs/libraries.md](docs/libraries.md) 为准
- **AI**: AI SDK 7 + `@ai-sdk/deepseek`，**只用 `deepseek-flash`**
- **Deploy**: 阿里云 ECS（武汉）。GitHub Actions 构建制品 → SSH 部署闸门 → PM2。**不使用腾讯云的任何服务**

## Key Commands

- Install: `pnpm install` | Dev: `pnpm dev`（http://localhost:23329）| Build: `pnpm build` | Start: `pnpm start`
- 端口：应用 **23329**，数据库 **23432**，本地与服务器一致。不要改用 3000 / 5432（详见 [ports.md](docs/conventions/ports.md)）
- Lint: `pnpm lint` | Typecheck: `pnpm typecheck` | Format: `pnpm format` | 三项一起检查: `pnpm check`

## Shell Environment（本机是 Windows + PowerShell，不是 bash/zsh）

- 不要用 `&&` 串联命令，用 `;` 分隔，或 `cmd1; if ($?) { cmd2 }`
- 不要用 bash heredoc 写多行 commit message，用 `git commit -F <临时文件>`
- 在代理环境里跑 pnpm 前先设 `$env:CI = "true"`，否则 pnpm 11 的交互提示会让命令挂住
- 含空格的路径必须用双引号包裹

## Definition of Done

1. `pnpm check` 退出码为 0（lint、typecheck、format:check）
2. `pnpm build` 退出码为 0
3. 涉及界面的改动，用 ego-browser 在手机和桌面两种宽度下实际操作一遍。**HTTP 200 不等于验收通过**
4. 提交信息符合 Conventional Commits（commitlint 会拦截）

## When Blocked

- `pnpm build` 连续失败 3 次 → 停下，报告完整错误输出
- 缺依赖 → 先查 `package.json`，再问
- 合并冲突 → 停下，列出冲突文件
- **Never**: 删除 lock 文件、force push、跳过 hooks（`--no-verify`）、绕过 lint

## 依赖纪律

- **AI 无权单独新增或删除依赖。** 先列候选、说明现有栈为什么不够、给出体积与许可证，等负责人确认
- **安装前核实包名真实存在于 npm registry**（防幻觉包）。禁止凭记忆陈述库的 API、版本、维护状态
- **每个关注点只有一个所有者**：查 [docs/libraries.md](docs/libraries.md)，表外的同类库禁止引入
- **`package.json` 的 diff 按最高风险等级 review**
- 第三方库一律经由封装层调用（入口登记在 libraries.md），业务代码禁止直接 import 库的包名

## Project Structure

```
src/app/         路由层：只放路由文件，业务逻辑下沉
src/components/  ui/ 原子组件（无业务逻辑）· layout/ 应用外壳（底栏、侧栏、顶栏）
src/features/    业务领域模块（跨路由复用时才提升）
src/server/      server-only：api（Hono）、services（业务逻辑）、db、auth、ai、quota、mail
src/lib/         通用工具与 hooks：cn、fonts、api（数据请求）、time（日期时区）、image · src/assets/ 字体
docs/            规范、ADR、lessons、组件库与 skills 注册表 · scripts/ setup / build / deploy / dev
public/          静态资源（制品要传到武汉服务器，保持小体积）
```

## Critical Rules（省略了就会犯错）

**Next.js 16**（详见 [nextjs-16-patterns.md](docs/conventions/nextjs-16-patterns.md)）
- `proxy.ts`，不是 `middleware.ts`；`params` / `searchParams` / `cookies()` / `headers()` 必须 `await`
- `cacheComponents` 开启：读 cookie / 会话的组件必须放在 `<Suspense>` 里，不要在 layout 顶层 `await` 会话
- 默认 Server Component，`'use client'` 只放在叶子组件

**架构**（详见 [api-conventions.md](docs/conventions/api-conventions.md)、[database.md](docs/conventions/database.md)）
- **业务写操作只走 `/api/v1` Route Handlers**，不用 Server Actions 写业务（APK 壳和未来 Kotlin 客户端要复用同一套接口）
- 业务逻辑放 `src/server/services/`，不 import `next/*`
- 错误响应体统一为 `{ "code": "...", "detail": "..." }`，前端只认 `code`
- 时间存 `timestamptz`（UTC）；"打卡日"另存用户本地日期；时区计算只经 `src/lib/time/`，不依赖系统时区
- TypeScript strict，禁止 `any`，用 `unknown` + 类型收窄；zod 一律 `import * as z from 'zod'`

**界面**（详见 [ui-design-system.md](docs/conventions/ui-design-system.md)、[routing.md](docs/conventions/routing.md)）
- **Playbook 优先**：新 token / 原子组件 / 交互模式先在 `/dev/playbook` 加演示并定稿，再用到页面；页面不重新写按钮、卡片、进度条
- 只用 `globals.css` 的 token 和语义字号（`text-body`、`text-caption`…），不写死色值、不用 `text-sm`；着色走 `tone.ts`
- 调试区是 `src/app/dev/`（URL `/dev`），**不是 `_dev`**：下划线文件夹不生成路由
- AI 结果以草稿呈现，用户确认后才入库；一次回复用 `<AgentTurn>` 呈现，思考和工具调用收在一行活动条里
- 图标全部在 `src/components/ui/icon.tsx` 手绘，不引入 lucide 等通用图标库

**数据与 AI**（详见 [ADR-0002](docs/adr/0002-account-quota-risk.md)、[ai-and-quota.md](docs/conventions/ai-and-quota.md)）
- **用户图片永不落盘**：只在内存里压缩后发给 DeepSeek，只保存解析出的文本。不写磁盘、不进数据库、不进日志，不用 DeepSeek Files API
- **只用 `deepseek-flash`**，经 `src/server/ai/model.ts` 的 provider 实例调用（字符串模型 id 会走 Vercel AI Gateway）
- 每次 AI 调用先按上限**预占**额度，结束后按实际 token **结算**，失败释放；用幂等键防重复扣费
- 密钥只放 `.env*`，不进 Git、日志或聊天

## 自进化机制（常驻规则）

- **踩坑必录**：凡"AI 因对某库或平台的错误认知出错、后被修正"，修正后必须向 `docs/lessons/<库或平台>.md` 申请追加一条（格式见 [docs/lessons/README.md](docs/lessons/README.md)）
- **批量结算**：lessons、规范、ADR、libraries.md 的修改先落为未提交 diff，会话收尾一次性汇报，**未经负责人确认不得 commit**
- **架构或选型决策**发生时写 ADR（`docs/adr/`，只增不改，推翻时标注 Superseded）

## Git Workflow

- `main` 生产分支（合并即部署）；`dev` 集成分支；工作分支从 `dev` 切出：`feat/<issue号>-<简述>`、`fix/…`、`refactor/…`、`docs/…`、`chore/…`、`ci/…`
- 工作分支 → `dev` 用 squash；`dev` → `main` 用 merge commit。**AI 代理 push、开 PR、合并任何 PR 前都要得到负责人对这一次操作的同意**
- Commit：`type(scope): 中文描述`，scope 白名单在 `commitlint.config.mjs`
- 创建 issue、拆 issue、开 PR 前**必须先查 [docs/skills-registry.md](docs/skills-registry.md) 并调用对应 skill**，issue / PR 正文注明引用了哪些 skill；PR 目标分支是 `dev`

## Boundaries

### ✅ Allowed without asking
- 读文件、列目录；运行 `pnpm check`、`pnpm build`
- 修改 `src/` 下的业务代码与 UI 组件；在 `src/app/dev/` 下建调试页、在 Playbook 里加演示

### ⚠️ Ask first
- 安装或删除依赖
- 修改 `next.config.ts`、`tsconfig.json`、ESLint、CI workflow、`lefthook.yml`
- 修改数据库结构（新增或修改迁移）
- push、开 PR、合并
- 向 `docs/lessons/`、`docs/adr/`、`docs/libraries.md`、规范文档写入内容（走批量结算）
- **任何服务器操作**（`ssh MainECS`）

### 🚫 Never
- 提交 `.env*` 或任何密钥
- force push 到 `main` / `dev`
- 在服务器上改动其他项目的文件、进程、Nginx 站点或数据库
- 把用户上传的图片写入磁盘、数据库或日志
- 使用腾讯云服务（EdgeOne、COS 等）
- 使用 `middleware.ts` 或 Pages Router；正式代码引用 `src/app/dev/`

## Documentation Index

> 满足触发条件时**必须先读**对应文档再动手；不满足就不要读（渐进式披露）。

| 触发条件 | 必读文档 |
|---|---|
| 引入或变更任何依赖前 | [docs/libraries.md](docs/libraries.md) |
| 使用某个库或平台写代码、跑命令前 | `docs/lessons/<该库或平台>.md`（存在则读；本机命令读 windows-powershell.md） |
| 创建 issue、拆 issue、开 PR 前 | [docs/skills-registry.md](docs/skills-registry.md)、[git-workflow.md](docs/conventions/git-workflow.md) |
| 判断功能做不做、疑惑"当初为什么这么选"、要推翻一个决定时 | [ADR-0003 项目范围](docs/adr/0003-project-scope.md)、[docs/adr/](docs/adr/README.md) 对应编号 |
| 新建文件、纠结文件放哪、文件变长时 | [project-structure.md](docs/conventions/project-structure.md)、[code-size-and-organization.md](docs/conventions/code-size-and-organization.md) |
| 写路由、`page.tsx`、`layout.tsx`、Route Handler、`next.config.ts` 前 | [nextjs-16-patterns.md](docs/conventions/nextjs-16-patterns.md)、[routing.md](docs/conventions/routing.md) |
| 写 `/api/v1` 接口、service、数据库 schema 或迁移前 | [api-conventions.md](docs/conventions/api-conventions.md)、[database.md](docs/conventions/database.md) |
| 写或改任何界面、组件、token、动效、Playbook 前 | [ui-design-system.md](docs/conventions/ui-design-system.md)、[ui-primitives.md](docs/conventions/ui-primitives.md) |
| 前端请求数据、写表单、写 zod schema 前 | [client-data-and-forms.md](docs/conventions/client-data-and-forms.md) |
| 处理日期、时间、时区、周期时 | [time-and-dates.md](docs/conventions/time-and-dates.md) |
| 写测试、写需要测试的纯函数时 | [testing.md](docs/conventions/testing.md) |
| 写代码前不确定风格约定、做 code review 或自查时 | [code-style.md](docs/conventions/code-style.md)、[code-review.md](docs/conventions/code-review.md) |
| 改端口、`.env`、地址时 | [ports.md](docs/conventions/ports.md) |
| 涉及登录、额度、兑换码、风控、后台、AI 调用、图片处理时 | [ADR-0002](docs/adr/0002-account-quota-risk.md)、[auth.md](docs/conventions/auth.md)、[ai-and-quota.md](docs/conventions/ai-and-quota.md) |
| 改 manifest、Service Worker、离线页前 | [pwa.md](docs/conventions/pwa.md) |
| 本地环境出问题时 | [local-setup.md](docs/ops/local-setup.md) |
| 部署、服务器、Nginx、数据库容器相关操作前 | [deploy-aliyun-ecs.md](docs/ops/deploy-aliyun-ecs.md)、[lessons/aliyun-ecs.md](docs/lessons/aliyun-ecs.md) |
| 修改或新增规范文档前 | [docs/conventions/README.md](docs/conventions/README.md)（措辞元规范、约束三层） |
| 排期、决定下一步做什么、查初始化进度时 | [roadmap.md](docs/plans/roadmap.md)、[plan-demo-init-alignment.md](docs/plans/plan-demo-init-alignment.md)、[architecture-baseline.md](docs/designs/architecture-baseline.md)（v0.1 快照，不再更新） |
