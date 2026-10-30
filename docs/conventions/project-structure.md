# 项目结构与文件组织

> 本文档是 `AGENTS.md` 中 "Project Structure" 的完整版。
> 文件放置的判断方法（colocation、`src/features/` 提升条件）见 [code-size-and-organization.md](./code-size-and-organization.md)。
> 标注"规划"的目录在对应功能落地时才创建。

## 目录结构

```
.
├── src/
│   ├── app/                        # 路由层：只放路由文件
│   │   ├── layout.tsx              # 根 layout（含 <html> <body>）
│   │   ├── page.tsx
│   │   ├── loading.tsx / error.tsx / not-found.tsx / global-error.tsx
│   │   ├── globals.css
│   │   ├── (auth)/                 # 规划：登录、注册、新人引导
│   │   ├── (app)/                  # 规划：登录后的应用（底部导航 / 侧边导航）
│   │   │   ├── layout.tsx          # 应用外壳
│   │   │   ├── page.tsx            # 主页（仪表盘）
│   │   │   ├── todo/               # 待办
│   │   │   ├── rank/               # 排行榜
│   │   │   └── me/                 # 我的（设置、版本信息）
│   │   ├── admin/                  # 规划：后台管理（额度监控、封禁、兑换码）
│   │   ├── _dev/                   # 调试页，production 返回 404
│   │   └── api/
│   │       ├── health/route.ts     # 部署健康检查
│   │       ├── auth/[...all]/      # 规划：Better Auth
│   │       └── v1/                 # 规划：业务 REST 接口（Web / APK / Kotlin 共用）
│   ├── components/
│   │   └── ui/                     # 纯展示组件（shadcn/ui 生成的组件放这里）
│   ├── features/                   # 业务领域模块（跨路由复用时才提升）
│   │   └── <domain>/
│   │       ├── components/         # 该领域的客户端组件
│   │       ├── schemas.ts          # zod schema（前后端共用）
│   │       └── types.ts
│   ├── server/                     # server-only 代码，文件顶部 import 'server-only'
│   │   ├── services/               # 业务逻辑：纯 TS 函数，不 import next/*
│   │   ├── db/                     # Drizzle schema、连接、迁移
│   │   ├── auth/                   # Better Auth 配置；对外只暴露 requireUser()
│   │   ├── ai/                     # agents / tools / prompts（prompt 带版本号）
│   │   ├── quota/                  # AI 额度预占、结算、释放
│   │   └── mail/                   # 阿里云邮件推送（SMTP）
│   └── lib/                        # 前后端通用的工具函数与 hooks
├── docs/
│   ├── plans/                      # 计划、路线图、里程碑
│   ├── conventions/                # 规范
│   ├── updates/                    # 版本更新说明
│   ├── specs/                      # 功能与接口规格（PRD 放这里）
│   ├── audits/                     # 审计报告
│   ├── ops/                        # 本地开发、部署
│   ├── issues/                     # 已知问题与技术债
│   └── designs/                    # 架构设计与决策记录（ADR）
├── scripts/
│   ├── setup/                      # 环境初始化
│   ├── build/                      # 构建辅助、制品打包与检查
│   ├── deploy/                     # 部署辅助
│   └── dev/                        # 开发辅助、mock 数据
├── public/                         # 静态资源（保持小体积，见下文）
├── .github/workflows/              # CI 与部署
├── AGENTS.md
├── commitlint.config.mjs
├── lefthook.yml
├── next.config.ts
└── package.json
```

## 分层规则

- `src/app/` 只放路由入口；业务逻辑下沉到 `src/server/services/` 和 `src/features/`。
- **调用方向只能向下**：路由 / 组件 → `/api/v1` → `services` → `db` / `ai` / `quota`。`services` 不能反过来依赖路由或 React。
- `src/server/` 下的每个模块文件顶部写 `import 'server-only'`，防止被打进客户端包。
- 只在一个路由内使用的组件留在该路由目录里（如 `app/(app)/todo/_components/`）。
- `src/components/ui/` 只放无业务逻辑的展示组件。
- `src/app/_dev/` 是隔离调试区：正式代码不得引用它。

## 静态资源

- 部署制品要从 GitHub 传到武汉的服务器，链路较慢，`public/` 里不放大文件。
- 中文字体必须做子集化后再放入。
- 插画和动画优先用 SVG、Rive（`.riv`）或 Lottie（`.json`）。
