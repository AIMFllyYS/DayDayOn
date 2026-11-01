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
│   │   ├── dev/                    # 调试区（/dev/*），production 返回 404
│   │   │   ├── playbook/           # 设计系统：token、原子组件、动效、导航、Agent 组件
│   │   │   └── _annotate/          # 调试批注工具与草图画板（只挂在 /dev 下）
│   │   └── api/
│   │       ├── health/route.ts     # 部署健康检查
│   │       ├── auth/[...all]/      # 规划：Better Auth
│   │       └── v1/[[...route]]/    # 规划：只把请求转给 Hono（src/server/api/），见 api-conventions.md
│   ├── components/
│   │   ├── ui/                     # 原子组件：无业务逻辑（组件库选型见 docs/libraries.md）
│   │   ├── layout/                 # 应用外壳：底部导航、侧栏、顶栏、导航项配置
│   │   ├── mascot/                 # 吉祥物团团：绘制、静态版、互动版
│   │   ├── charts/                 # 规划：自研 SVG 图表，d3-shape 的唯一入口
│   │   └── <domain>/               # 其他第三方库封装层：每个目录是对应库的唯一入口（登记在 docs/libraries.md）
│   ├── assets/
│   │   └── fonts/                  # 子集化后的 woff2 与 OFL 许可证（next/font/local 加载）
│   ├── features/                   # 业务领域模块（跨路由复用时才提升）
│   │   └── <domain>/
│   │       ├── components/         # 该领域的客户端组件
│   │       ├── schemas.ts          # zod schema（前后端共用）
│   │       └── types.ts
│   ├── server/                     # server-only 代码，文件顶部 import 'server-only'
│   │   ├── env.ts                  # 规划：zod 校验环境变量，服务端只从这里读
│   │   ├── api/                    # 规划：Hono 应用、路由、中间件、错误码（api-conventions.md）
│   │   ├── services/               # 业务逻辑：纯 TS 函数，不 import next/*、hono
│   │   ├── db/                     # Drizzle schema、连接、迁移（database.md）
│   │   ├── auth/                   # Better Auth 配置；对外只暴露 getSession / requireUser / requireAdmin（auth.md）
│   │   ├── ai/                     # 模型实例、runAi、计价、图片、prompts（ai-and-quota.md）
│   │   ├── quota/                  # AI 额度预占、结算、释放、周期键
│   │   ├── rate-limit.ts           # 规划：限流计数，/api/v1 与 Better Auth hook 共用
│   │   └── mail/                   # 阿里云邮件推送（SMTP，Nodemailer）
│   └── lib/                        # 前后端通用的工具函数与 hooks
│       ├── api/                    # 规划：TanStack Query 与类型化接口客户端（client-data-and-forms.md）
│       ├── time/                   # 规划：日期与时区计算的唯一入口（time-and-dates.md）
│       ├── image/                  # 规划：浏览器端图片压缩
│       └── auth-client.ts          # 规划：Better Auth 浏览器客户端
├── docs/
│   ├── plans/                      # 计划、路线图、里程碑
│   ├── conventions/                # 规范
│   ├── updates/                    # 版本更新说明
│   ├── specs/                      # 功能与接口规格（PRD 放这里）
│   ├── audits/                     # 审计报告
│   ├── ops/                        # 本地开发、部署
│   ├── issues/                     # 已知问题与技术债
│   ├── designs/                    # 架构设计、UI 设计
│   │   ├── reviews/                # Playbook 批注导出的 JSON
│   │   └── library-showcase/       # 组件库选型对比页（每个关注点一个 HTML，决策现场归档）
│   ├── adr/                        # 架构决策记录：NNNN-<slug>.md，只增不改
│   ├── lessons/                    # 踩坑经验库：一库或一平台一个文件
│   ├── libraries.md                # 组件库注册表：每个关注点的唯一所有者与互斥禁令
│   └── skills-registry.md          # skills 注册表：issue / PR 等操作必须调用的 skill
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
- `src/components/ui/` 只放无业务逻辑的展示组件；`src/components/layout/` 只放应用外壳。新组件先在 `/dev/playbook` 登记（见 [ui-design-system.md](./ui-design-system.md)）。
- `src/app/dev/` 是隔离调试区：正式代码不得引用它。不用 `_dev`，原因见 [routing.md](./routing.md) 第 5 节。
- 路由命名、路由组、查询参数的规则见 [routing.md](./routing.md)。
- **第三方库只能从封装层进入**：领域引擎和 UI 类库在 `src/components/<domain>/` 或 `src/lib/<domain>/` 建唯一入口，业务代码禁止直接 import 库的包名；入口路径登记在 [libraries.md](../libraries.md)。小工具库可以豁免，豁免也写在 libraries.md 里。

## 关键文件

| 文件 | 作用 |
|---|---|
| `next.config.ts` | Next 配置：standalone、Cache Components、安全响应头 |
| `src/app/globals.css` | 设计 token，效果在 `/dev/playbook` 查看 |
| `src/app/api/health/route.ts` | 部署健康检查（返回当前 commit） |
| `commitlint.config.mjs` / `lefthook.yml` | 提交规范与 git hooks |
| `.env.example` | 环境变量清单（真实 `.env*` 不提交） |
| `scripts/deploy/` | 服务器侧配置的唯一来源（见 [deploy-aliyun-ecs.md](../ops/deploy-aliyun-ecs.md)） |

## 静态资源

- 部署制品要从 GitHub 传到武汉的服务器，链路较慢，`public/` 里不放大文件。
- 中文字体必须做子集化后再放入。
- 插画用 SVG，动画用 CSS（不引入 Rive、Lottie，见 [ADR-0005](../adr/0005-motion.md)）。
