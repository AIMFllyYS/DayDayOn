<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — DayDayOn

> 和朋友一起用的治愈系多人打卡应用（PWA，手机与电脑双端）。
> 本文件是 AI 编码代理的**操作索引**，只放高频命令和不可省略的硬规则。
> 细则在 `docs/` 下按需查阅，见末尾 [Documentation Index](#documentation-index)。

## Tech Stack

- **Framework**: Next.js 16.4（App Router only；`cacheComponents` 开启；`output: 'standalone'`）
- **React** 19.3 · **TypeScript** 6.0.3（锁定：typescript-eslint 还不支持 7）· **pnpm** 11.7 · **Node** 24
- **Styling**: Tailwind CSS 4（shadcn/ui 待引入）
- **Data**: PostgreSQL 18（服务器本机 Docker）· Drizzle ORM · Better Auth（待引入）
- **AI**: AI SDK 7 + `@ai-sdk/deepseek`，**只用 `deepseek-flash`**
- **Deploy**: 阿里云 ECS（武汉）。GitHub Actions 构建制品 → SSH 部署闸门 → PM2。**不使用腾讯云的任何服务**

## Key Commands

- Install: `pnpm install` | Dev: `pnpm dev`（http://localhost:23329）| Build: `pnpm build` | Start: `pnpm start`
- 端口：应用 **23329**，数据库 **23432**，本地与服务器一致。不要改用 3000 / 5432（详见 [ports.md](docs/conventions/ports.md)）
- Lint: `pnpm lint` | Typecheck: `pnpm typecheck` | Format: `pnpm format`
- 一次跑完 lint + typecheck + 格式检查: `pnpm check`

## Shell Environment

> 本地开发环境是 **Windows + PowerShell**，不是 bash/zsh。

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

## Project Structure

```
src/app/         路由层：只放路由文件，业务逻辑下沉
src/components/  纯 UI 组件（ui/ 只放无业务逻辑的展示组件）
src/features/    业务领域模块（跨路由复用时才提升）
src/server/      server-only：services（业务逻辑）、db、auth、ai
src/lib/         通用工具函数与 hooks
docs/            项目文档（规范、设计、运维）
scripts/         辅助脚本（setup / build / deploy / dev）
public/          静态资源（制品要传到武汉服务器，保持小体积）
```

> 完整目录树与放置规则见 [project-structure.md](docs/conventions/project-structure.md)、[code-size-and-organization.md](docs/conventions/code-size-and-organization.md)。

## Critical Rules（省略了就会犯错）

**Next.js 16**（详见 [nextjs-16-patterns.md](docs/conventions/nextjs-16-patterns.md)）

- `proxy.ts`，不是 `middleware.ts`；`params` / `searchParams` / `cookies()` / `headers()` 必须 `await`
- `cacheComponents` 开启：读 cookie / 会话的组件必须放在 `<Suspense>` 里，不要在 layout 顶层 `await` 会话
- 默认 Server Component，`'use client'` 只放在叶子组件

**架构**（详见 [architecture-baseline.md](docs/designs/architecture-baseline.md)）

- **业务写操作只走 `/api/v1` Route Handlers**，不用 Server Actions 写业务（APK 壳和未来 Kotlin 客户端要复用同一套接口）
- 业务逻辑放 `src/server/services/`，不 import `next/*`
- 错误响应体统一为 `{ "code": "...", "detail": "..." }`，前端只认 `code`
- 时间存 `timestamptz`（UTC）；"打卡日"另存用户本地日期
- TypeScript strict，禁止 `any`，用 `unknown` + 类型收窄

**数据与 AI**（详见 [adr-0002](docs/designs/adr-0002-account-quota-risk.md)）

- **用户图片永不落盘**：只在内存里压缩后发给 DeepSeek，只保存解析出的文本。不写磁盘、不进数据库、不进日志
- **只用 `deepseek-flash`**，不接其他模型
- 每次 AI 调用先按上限**预占**额度，结束后按实际 token **结算**，失败释放；用幂等键防重复扣费
- 密钥只放 `.env*`，不进 Git、日志或聊天

## Git Workflow

- `main` 生产分支（合并即部署）；`dev` 集成分支；工作分支从 `dev` 切出：`feat/<issue号>-<简述>`、`fix/…`、`refactor/…`、`docs/…`、`chore/…`、`ci/…`
- 工作分支 → `dev` 用 squash；`dev` → `main` 用 merge commit，**必须得到项目负责人对这一次合并的明确同意**
- Commit：`type(scope): 中文描述`，scope 白名单在 `commitlint.config.mjs`
- 创建 issue、按 issue 做 PR 时使用 issue-creator / issue-to-pr skill，但 PR 目标分支是 `dev`

> 完整规则见 [git-workflow.md](docs/conventions/git-workflow.md)。

## Boundaries

### ✅ Allowed without asking

- 读文件、列目录；运行 `pnpm check`、`pnpm build`
- 修改 `src/` 下的业务代码与 UI 组件；在 `src/app/_dev/` 下建调试页

### ⚠️ Ask first

- 安装或删除依赖
- 修改 `next.config.ts`、`tsconfig.json`、ESLint、CI workflow、`lefthook.yml`
- 修改数据库结构（新增或修改迁移）
- push、开 PR、合并
- **任何服务器操作**（`ssh MainECS`）

### 🚫 Never

- 提交 `.env*` 或任何密钥
- force push 到 `main` / `dev`
- 在服务器上改动其他项目的文件、进程、Nginx 站点或数据库
- 把用户上传的图片写入磁盘、数据库或日志
- 使用腾讯云服务（EdgeOne、COS 等）
- 使用 `middleware.ts` 或 Pages Router；正式代码引用 `src/app/_dev/`

## Key Files

- `next.config.ts` — Next 配置（standalone、cacheComponents、安全响应头）
- `commitlint.config.mjs` / `lefthook.yml` — 提交规范与 git hooks
- `.env.example` — 环境变量清单（真实 `.env*` 不提交）
- `src/app/api/health/route.ts` — 部署健康检查

## Documentation Index

> 只在相关任务时读对应文档，不要一次全部读取。

### docs/conventions/ — 规范

- [project-structure.md](docs/conventions/project-structure.md) — 目录结构与分层规则
- [code-size-and-organization.md](docs/conventions/code-size-and-organization.md) — 文件长度与放置决策
- [nextjs-16-patterns.md](docs/conventions/nextjs-16-patterns.md) — Next.js 16 关键模式与陷阱
- [code-style.md](docs/conventions/code-style.md) — 代码风格
- [code-review.md](docs/conventions/code-review.md) — Code review 检查清单
- [git-workflow.md](docs/conventions/git-workflow.md) — 分支、提交、PR、发布
- [ports.md](docs/conventions/ports.md) — 端口约定（应用 23329、数据库 23432）及所有引用位置

### docs/designs/ — 设计与决策

- [architecture-baseline.md](docs/designs/architecture-baseline.md) — 架构基线
- [adr-0001-ecosystem-or-standalone.md](docs/designs/adr-0001-ecosystem-or-standalone.md) — 独立部署，不接入 1037Solo 生态
- [adr-0002-account-quota-risk.md](docs/designs/adr-0002-account-quota-risk.md) — 账号、邮件、AI 额度、风控、后台

### docs/ops/ — 运维

- [local-setup.md](docs/ops/local-setup.md) — 本地开发环境
- [deploy-aliyun-ecs.md](docs/ops/deploy-aliyun-ecs.md) — 阿里云 ECS 部署方案
