# DayDayOn 架构基线 v0.1（待确认）

> 日期：2026-10-31 · 状态：草案，等待 [ADR-0001](./adr-0001-ecosystem-or-standalone.md) 定稿
> 依据：demo-init skill、git-commit skill、服务器实测、npm 实测版本、DeepSeek / AI SDK 官方文档
>
> **2026-10-31 修订**：认证、数据库位置、部署流程、图片存储取决于 ADR-0001（接入 1037Solo 生态还是独立部署）。
> 第 2 节部署拓扑、第 0 节"文件存储"一行、第 11 节问题已被 ADR-0001 取代；其余内容不变。

---

## 0. 决策速览

| 领域 | 决策 | 主要理由 |
|---|---|---|
| 运行模式 | Next.js `output: 'standalone'` + PM2 + 宝塔 Nginx 反代 | 登录、数据库、Agent、上传都需要服务端运行时；与服务器上已有应用的运维方式一致 |
| 数据库 | PostgreSQL 18.6（Docker `postgres:18.6-alpine3.24`），数据放 `/mnt/data/daydayon/postgres` | JSONB 存自定义表单和 AI 结果；窗口函数算连续打卡与排行；原生 `uuidv7()`；服务器现有项目都用 PG |
| ORM | Drizzle ORM 0.45 + drizzle-kit | SQL 可读、无额外引擎进程、内存占用低；Prisma 8 目前仍是 rc |
| 认证 | Better Auth 1.7（Web 用 cookie，APK/Kotlin 用 bearer token） | 自托管、有 Drizzle 适配器，邮箱 OTP / 手机号 / 用户名都有插件 |
| API | 业务逻辑放 `src/server/services`；对外统一 REST `/api/v1`（Hono + zod-openapi 挂在 Next Route Handler 上） | 未来 Kotlin 客户端只认 HTTP 契约；Web 端也走同一套 API，不会出现 Web 独有逻辑 |
| AI | AI SDK 7 的 `ToolLoopAgent` + `@ai-sdk/deepseek`，默认模型 `deepseek-flash`；DeepSeek Search / Fetch API 封装成 tool | `deepseek-flash`（V4.1 Flash）原生支持图片输入，一个模型覆盖文字、拍照识别、截图解析 |
| 组件库 | shadcn/ui（Tailwind v4 + Radix）+ Motion + Recharts + sonner + dnd-kit | 源码复制进仓库，圆角、配色、动效可以完全改成治愈可爱风 |
| PWA | Serwist（`@serwist/turbopack`） | Next 16 默认 Turbopack，Serwist 9 已支持 |
| 后台任务 | pg-boss（基于 Postgres 的任务队列） | 提醒、每日汇总、排行榜快照；不额外引入 Redis，节省服务器内存 |
| 文件存储 | ~~先存服务器数据盘~~ → 见 ADR-0001 第 6 节：独立方案下图片不落盘，只保存解析结果 | 用户 2026-10-31 决定 |

---

## 1. 与 demo-init skill 的取舍

demo-init 面向"腾讯云 EdgeOne Pages + SSG 静态导出"，本项目部署在阿里云 ECS 且需要服务端，所以只保留它的工程组织方式。

**保留**

- AGENTS.md 只做索引（约 140 行），细则放 `docs/conventions/*.md`
- `docs/`（plans / conventions / updates / specs / audits / ops / issues / designs）和 `scripts/`（setup / build / deploy / dev）目录结构
- `src/app` 只放路由，业务下沉 `src/features`，`src/server` 放 server-only 代码
- `proxy.ts` 替代 `middleware.ts`、request API 必须 `await`、`_dev/` 调试区单向引用、TypeScript strict 禁止 `any`
- code-size / code-style / code-review 三份规范原样沿用

**替换**

| skill 原内容 | 本项目 |
|---|---|
| `output: 'export'` + `images.unoptimized` + `trailingSlash` | `output: 'standalone'`，保留图片优化 |
| `edgeone.json`、`docs/ops/deploy-edgeone.md` | 删除；新增 `deploy/` 目录和 `docs/ops/deploy-aliyun-ecs.md` |
| Node 22.11（EdgeOne 锁定） | Node 24（本地 24.20，服务器 24.19） |
| 依赖版本 `next >=16.2`、`typescript ^5.7`、`eslint ^9`、`pnpm@9.15` | 见第 3 节实测版本 |
| 分支从 `main` 切出 | 从 `dev` 切出，见第 9 节 |
| rewrites / redirects 写进 `edgeone.json` | 写进 `next.config.ts` 或 Nginx |

**新增规范文档**：`api-conventions.md`、`ai-agent.md`、`database.md`、`ui-design-tokens.md`、`git-workflow.md`。

---

## 2. 服务器现状与部署拓扑（2026-10-31 实测）

> 本节第 4 条的目录方案和"rsync + `pm2 reload`"已被取代：应用放 `/www/wwwroot/daydayon/`，数据放 `/mnt/data/daydayon/`，部署走独立的 SSH 部署闸门。以 [deploy-aliyun-ecs.md](../ops/deploy-aliyun-ecs.md) 为准。服务器区域实测为 `cn-wuhan-lr`。

| 项 | 实测 |
|---|---|
| 系统 | Alibaba Cloud Linux 3，2 vCPU，7.3 GiB 内存（已用 3.0 GiB，swap 已用 2.3 GiB） |
| 磁盘 | 系统盘 79G 已用 67%；数据盘 `/dev/vdb` 挂载于 `/mnt/data`，49G 已用 15%；Docker 根目录已在 `/mnt/data/docker` |
| 运行时 | Docker 26.1.3、Compose v2.27、Node 24.19、PM2、宝塔 Nginx 1.28 |
| 现有惯例 | 已有的 PG 容器都只绑定 `127.0.0.1`；已有项目使用独立系统用户、512MB 内存限制、独立数据目录 |

由此得出的部署约束：

1. **不在服务器上执行 `next build`**。2 核且已经在用 swap，构建会拖慢同机的其他应用。改为在 Linux 环境（GitHub Actions）构建 standalone 产物，再上传并 `pm2 reload`。
2. **不能在 Windows 本地构建后直接上传**。`sharp` 等原生依赖与平台绑定，产物必须在 Linux x64 上构建。
3. PG 容器限制 512MB 内存，只绑定 `127.0.0.1:23432`，不对公网开放（端口约定见 [ports.md](../conventions/ports.md)）。
4. 独立用户和目录方案（初稿，已被 deploy-aliyun-ecs.md 取代）：

```
/mnt/data/daydayon/
├── app/
│   ├── releases/<版本>/   # 每次发布的 standalone 产物
│   └── current -> releases/<版本>   # 软链，便于回滚
├── postgres/              # PG 数据（容器 bind mount）
├── uploads/               # 用户上传的图片
├── backups/               # 每日 pg_dump
├── deploy/                # docker-compose.yml、.env（权限 600）
└── logs/
```

请求链路：`浏览器 / APK 壳 → 宝塔 Nginx（HTTPS）→ 127.0.0.1:<app 端口>（PM2 运行 Next standalone）→ 127.0.0.1:<pg 端口>（Docker PG）`。

---

## 3. 技术栈与版本（npm 实测，2026-10-31）

| 包 | 版本 | 备注 |
|---|---|---|
| next | 16.4.3 | skill 模板写的 ≥16.2 已过时 |
| react / react-dom | 19.3.1 | |
| typescript | **6.0.3（锁定）** | 最新是 7.0.2，但 typescript-eslint 8.72 的 peer 依赖是 `<6.1.0`，暂不升级 |
| eslint / eslint-config-next | 9.39 / 16.4.3 | create-next-app 16.4 模板仍用 ESLint 9，跟随官方模板；用 `eslint .`，不用已移除的 `next lint` |
| tailwindcss | 4.3.3 | |
| shadcn（CLI） | 4.23.0 | |
| ai / @ai-sdk/deepseek / @ai-sdk/react | 7.0.x / 3.0.x / 4.0.x | |
| better-auth | 1.7.14 | CLI 要求 Node ≥ 22.12 |
| drizzle-orm / drizzle-kit | 0.45.4 / 0.31.11 | |
| zod | 4.6.7 | |
| serwist / @serwist/turbopack | 9.5.13 | |
| motion | 14.8.0 | |
| recharts | 3.10.1 | |
| @capacitor/core | 8.6.0 | APK 阶段才引入 |
| pnpm | 本地 11.7 / 服务器 10.30 | 用 `packageManager` 字段锁定；服务器只运行产物，不安装依赖 |

实施时以 `node_modules/ai/docs/` 为准查 AI SDK API，并安装官方 skill：`npx skills add vercel/ai`（[AI SDK 文档](https://ai-sdk.dev/docs/agents)）。训练数据里的 AI SDK 写法大多是 4/5 版本，不能照搬。

---

## 4. 分层架构（为 APK 壳和 Kotlin 迁移预留）

```
客户端   Web / PWA            APK 壳（Capacitor 加载线上地址）    未来 Kotlin 原生
           │ 首屏读：RSC 直接调 service    │ 全部走 HTTP                  │ 全部走 HTTP
           ▼                              ▼                             ▼
接口层   /api/v1/*  Hono + zod-openapi（自动生成 OpenAPI 文档）    /api/auth/*  Better Auth
           ▼
服务层   src/server/services/*  纯 TS 业务函数，不 import next/*，入参出参都用 zod schema
           ▼
AI 层    src/server/ai/*  agents / tools / prompts（prompt 带版本号）
           ▼
数据层   Drizzle → PostgreSQL     pg-boss 任务     （图片不存储，见 ADR-0002 第 4 节）
```

硬规则：

- **写操作只有一条路径：`/api/v1`**。客户端组件用 TanStack Query + Hono 类型化 client 调用。不用 Server Actions 写业务，避免出现 Kotlin 迁移时漏掉的 Web 独有逻辑。
- 读操作：首屏由 RSC 直接调用 service（与 API 调同一个函数），之后的刷新走 API。
- service 层不依赖 Next.js，以后可以原样抽成独立 Node 服务，也可作为 Kotlin 后端的对照实现。
- OpenAPI 文档输出到 `docs/specs/api/openapi.json`，Kotlin 端可用 openapi-generator 生成客户端。
- 主键用 UUIDv7；时间存 `timestamptz`（UTC）；"打卡日"另存用户本地日期 `local_date`。

APK 壳：Capacitor 8 以 `server.url` 加载线上站点。需要处理返回键、状态栏、安全区、文件选择器的相机权限、深链接。拍照入口统一封装成 `MediaPicker` 接口，Kotlin 阶段替换实现即可。

---

## 5. AI / Agent 设计

### 5.1 模型与服务（来源：[DeepSeek 更新日志](https://api-docs.deepseek.com/updates/)、[模型与价格](https://api-docs.deepseek.com/quick_start/pricing)）

| 能力 | 方案 |
|---|---|
| 默认模型 | `deepseek-flash`（DeepSeek-V4.1-Flash-1017）：视觉、工具调用、JSON 输出、1M 上下文 |
| 其他模型 | 不使用。2026-10-31 决定只用 `deepseek-flash`，不接 `deepseek-v4-pro` |
| 网络搜索 | DeepSeek 2026-10-17 开放的 Search / Fetch API，按次计费（每 1000 次成功请求 5 元） |
| 思考模式 | 默认开启。结构化解析类任务关闭以降低延迟和费用，分析总结类任务开启 |

价格参考（每百万 token，高峰时段）：flash 输入（未命中缓存）$0.30，输出 $1.20；非高峰减半。

### 5.2 设计原则

1. **AI 负责看懂和结构化，数值由代码计算**。
   - 运动：AI 识别运动类型和强度 → 映射 MET 值 → 代码计算 `MET × 体重(kg) × 时长(h)`
   - 饮食：AI 识别食物和份量 → 给出热量区间和置信度
   - 热量缺口：代码用 Mifflin-St Jeor 公式算基础代谢 × 活动系数 + 运动消耗 − 摄入
2. **AI 结果先作为草稿**，用户确认或修改后才入库。同时保存原始输出、模型名、prompt 版本，便于追溯和以后重算。
3. 结构化输出用 zod schema 约束；解析失败或置信度低时降级为手动填写。
4. 搜索 tool 只在需要时调用（例如查某个品牌食品的营养成分），计入配额。
5. 成本控制：每人每周 10 元预算，按 token 实际用量预占 / 结算（规则见 ADR-0002 第 5 节）；图片在前端压缩到长边 ≤ 1600px 的 WebP 后上传；token 用量记入 `ai_runs` 表。
6. 自定义目标的 AI 模式：用户写的 prompt 只能产出该目标表单 schema 规定的字段，这个模式下 Agent 不挂任何有副作用的 tool，防止 prompt 注入。
7. 热量、睡眠分析的结果统一标注"估算，非医疗建议"。

### 5.3 首批 tool

`getUserProfile`（身高、体重、目标）· `lookupMet` · `calcExerciseKcal` · `estimateFoodNutrition` · `getDaySummary` · `webSearch` · `webFetch`

### 5.4 自定义目标的统一模型

"手动表单"和"AI 解析"共用同一份表单 schema（字段类型：数字、文本、单选、多选、布尔、时长、评分、图片）。手动模式是用户填表，AI 模式是 AI 按同一份 schema 填表、用户确认。这样只需维护一套校验和展示逻辑。

---

## 6. 数据模型要点（PRD 阶段细化）

| 表 | 内容 |
|---|---|
| Better Auth 系列表 | 账号、会话、验证码 |
| `profiles` | 昵称、头像、身高、出生年份、性别、时区、日切换时间（默认 04:00） |
| `goals` | 板块类型（exercise / diet / sleep / study / custom）、标题、计划时间与频率、提醒时间、表单 schema（JSONB，带版本）、AI prompt |
| `checkins` | 公共字段（user、goal、type、local_date、occurred_at、source = manual / ai / import、备注、附件）+ `payload`（JSONB，按板块的 zod schema 校验） |
| `body_metrics` | 体重 `numeric(5,2)` kg、测量时间（精确指标单独建表，方便统计） |
| `exercise_entries` / `nutrition_entries` / `sleep_entries` | 各板块的结构化数值，供仪表盘和热量缺口计算 |
| `daily_ratings` | 每天每个板块的主观满意度（1–5） |
| `todos` / `time_entries` | 待办（标题、DDL、完成时间、优先级）；时间日志（开始、结束、标签） |
| `ai_runs` | 输入摘要、输出 JSON、模型、prompt 版本、token、耗时、状态 |
| `dashboards` | 每个用户的组件布局 JSON |
| `ai_budget_*` / `redeem_codes` | 周额度、加购余额、预占与结算流水、兑换码（见 ADR-0002 第 5 节） |
| 社交相关 | 取决于第 11 节问题 4 |

---

## 7. 前端方案

### 7.1 组件库选择

| 方案 | 结论 | 说明 |
|---|---|---|
| shadcn/ui + Radix | **采用** | 源码在仓库内，视觉可以完全改；Drawer、Sheet、Chart、Calendar 现成可用 |
| HeroUI | 备选 | 默认风格偏圆润，但主题定制深度不如源码复制 |
| Ant Design / AntD Mobile | 不用 | 视觉偏工具和后台，而且移动端、桌面端要两套库 |
| MUI | 不用 | Material 风格强，覆盖成本高 |

配套库：

| 用途 | 库 |
|---|---|
| 动效（按钮回弹、打卡成功庆祝） | Motion |
| 吉祥物和插画动画 | Rive 或 Lottie，设计阶段决定 |
| 图表 | Recharts 3（shadcn Chart 封装） |
| 底部弹出菜单 | shadcn Drawer（基于 vaul；vaul 最后一次发版是 2024-12，需关注维护状态） |
| 表单 | react-hook-form + zod（自定义目标的动态表单按 schema 渲染） |
| 客户端数据 / 轻量状态 | TanStack Query / Zustand |
| 日期与时区 | date-fns + @date-fns/tz |
| 自定义仪表盘拖拽排序 | dnd-kit |
| 图片压缩 | browser-image-compression |
| 提示消息 | sonner |
| 图标 | lucide 作为基础线性图标；五个板块用 Pencil 设计的彩色图标 |

### 7.2 响应式布局

- `< 768px`：底部 5 格导航（主页 / 待办 / ＋ / 排行 / 我的）；`≥ 768px`：左侧导航，`≥ 1024px` 展开显示文字，768–1024px 只显示图标。
- 中间"＋"：手机端从底部弹出 Drawer 选择打卡类型；桌面端侧栏顶部放"打卡"按钮，打开 Dialog。两端复用同一个内容组件。
- 安全区：`viewport-fit=cover` + `env(safe-area-inset-*)`；全屏高度用 `dvh`。
- 拍照：`<input type="file" accept="image/*" capture="environment">`，浏览器、PWA、Capacitor WebView 都能用。
- 触控区域 ≥ 44px。

### 7.3 PWA

- manifest（含 maskable 图标）、离线兜底页、静态资源缓存。
- 离线草稿：打卡内容先存 IndexedDB，联网后补传；用幂等 key 防止重复提交。
- 安装引导：Android Chrome 用 `beforeinstallprompt`；iOS 需要手动引导"添加到主屏幕"。
- **推送限制**：Android Chrome 的 Web Push 依赖 FCM，中国大陆网络下基本收不到；iOS 必须先安装到主屏幕才能推送。所以 Web 阶段的打卡提醒以"应用内提醒 + 可选邮件"为主，可靠推送放到 APK 阶段（厂商推送通道或本地通知）。

### 7.4 治愈可爱风的落地方式（设计阶段细化）

在 Pencil 里先定设计 token，再画页面：奶油色底、每个板块一种低饱和马卡龙色、16–24px 大圆角、柔和阴影、圆体字体、一个贯穿全站的吉祥物。中文圆体字体体积大，必须做子集化，否则首屏会慢。

---

## 8. 需要在 PRD 里写清楚的边界条件

- **打卡日归属**：按用户时区 + 日切换时间计算；睡眠记到起床那天；跨时区出行怎么算。
- **连续打卡**：断签规则、是否允许补卡、补卡是否计入排行。
- **频次**：一天多次（饮食多餐）和一天一次（睡眠）的目标分别怎么计完成。
- **目标修改**：改了表单字段后，历史数据按当时的 schema 版本展示。
- **AI 异常**：识别失败、置信度低、超时，都降级为手动；AI 结果用户可以修改。
- **体重**：异常值确认（例如一天变化超过 3kg 时提示）、默认不公开。
- **隐私合规**：体重、饮食、睡眠属于《个人信息保护法》中的敏感个人信息，需要单独同意、隐私政策、数据导出和注销删除。
- **排行榜**：只展示用户同意公开的聚合数据（打卡天数、连续天数）；同一天重复打卡不重复计分。
- **图片**：不存储（ADR-0002 第 4 节）。仍需限制大小；iPhone 的 HEIC 照片在浏览器端压缩时统一转 WebP 再上传解析。
- **幂等与并发**：离线重放、双击提交。
- **账号注销**：排行榜和互动数据如何处理。
- **内容安全**：头像、昵称等公开内容在中国大陆上线需要审核（可接阿里云内容安全）。
- **备案**：使用已备案主域名的子域名。

---

## 9. Git 分支与提交规范

**分支**

| 分支 | 用途 | 规则 |
|---|---|---|
| `main` | 生产分支，GitHub 默认分支 | 只接受来自 `dev` 的发布 PR 和 `hotfix/*`；合并后部署并打 tag `vX.Y.Z` |
| `dev` | 开发集成分支 | 功能 PR 的目标分支 |
| `feat/<issue号>-<简述>` 等 | 工作分支，从 `dev` 切出 | 前缀：`feat/ fix/ refactor/ docs/ chore/ ci/ test/` |
| `hotfix/<简述>` | 线上紧急修复，从 `main` 切出 | 合回 `main` 后再同步到 `dev` |

- 合并方式：工作分支 → `dev` 用 squash；`dev` → `main` 用 merge commit，保留发布边界。
- `main`、`dev` 开启分支保护：禁止 force push 和删除，必须走 PR，CI 必须通过。
- Issue 和 PR 流程沿用 issue-creator / issue-to-pr skill，但把"从 `main` 切出"改为"从 `dev` 切出、PR 指向 `dev`"。

**提交**（git-commit skill，Conventional Commits）

- 格式：`type(scope): 描述`，type 和 scope 用英文，描述默认用中文，不超过 72 字符。
- type：`feat fix docs style refactor perf test build ci chore revert`；破坏性变更用 `!` 或 `BREAKING CHANGE:`。
- scope 白名单：`auth onboarding profile goal checkin exercise diet sleep study custom todo metric dashboard rank social agent pwa ui db api deploy ci deps docs`
- 工具：lefthook 管理 git hooks（commit-msg 跑 commitlint；pre-commit 对暂存文件跑 eslint 和 gitleaks 密钥扫描，本机已安装 gitleaks）。
- 版本号：0.x 阶段用 SemVer，每个版本的更新说明写在 `docs/updates/`。

---

## 10. .gitignore 相对 skill 模板的调整

- 删除 `/.edgeone/`。
- 环境变量改为 `.env*` + `!.env.example`，避免漏掉 `.env.staging` 之类的新文件。
- 新增：
  - 数据与备份：`/uploads/`、`/.data/`（本地 Docker PG 数据）、`/backups/`、`*.dump`、`*.sql.gz`
  - 密钥：`*.pem`、`*.key`、`*.keystore`、`*.jks`
  - 测试产物：`/test-results/`、`/playwright-report/`
  - Serwist 产物：`/public/sw.js*`、`/public/swe-worker-*.js`
  - 未来 Capacitor：`/android/app/build/`、`/android/.gradle/`、`/android/local.properties`
  - Kiro：提交 `.kiro/steering/` 和 `.kiro/hooks/`，忽略 `.kiro/settings/`（可能含 MCP 密钥）
- 媒体文件规则保留；Rive / Lottie 动画是 `.riv` / `.json`，不受影响。

---

## 11. 待拍板的问题

> 2026-10-31 已回答，结论与新的待确认项见 [ADR-0001](./adr-0001-ecosystem-or-standalone.md) 第 7、8 节。以下保留原问题作记录。

1. **GitHub 账号**：本机 gh 同时登录了 `AIMFllyYS`（当前活动）和 `AIMFllys`，仓库建在哪个账号下？仓库名用 `DayDayOn` 吗？
2. **产品名与域名**：中文名叫什么？用哪个已备案域名的子域名（例如 `daydayon.1037solo.com`）？
3. **登录方式**：建议 MVP 用"邮箱 + 验证码"，需要一个发信 SMTP（阿里云邮件推送或 QQ / 163 邮箱）。手机短信需要阿里云短信签名审核，微信登录需要企业资质。
4. **多人互动范围**：排行榜是全站公开、好友之间，还是小组内？这决定社交表结构。
5. **图片存储**：先用服务器数据盘（零成本，剩余 40G），还是一开始就用阿里云 OSS？
6. **构建发布**：GitHub Actions 构建后通过 SSH 发布（需要在仓库 Secrets 放一个专用部署密钥，推荐），还是先用本地 Docker 构建 + 脚本上传？
7. **提交描述语言**：默认中文可以吗？

---

## 12. 排期草案

| 阶段 | 内容 |
|---|---|
| Phase 0 基建（当前） | 本文定稿 → GitHub 仓库与分支保护 → 改造版 demo-init 脚手架与规范文档 → 本地 Docker PG → 服务器 PG 容器 → CI 与发布脚本 → PWA 空壳上线（HTTPS） |
| Phase 1 PRD 与设计 | PRD（含第 8 节边界条件）→ Pencil 设计稿：设计 token、基础组件、五个主屏的手机版和桌面版 |
| Phase 2 MVP | 登录 → 资料与新人引导 → 目标设置 → 五类打卡（先手动）→ 体重与满意度 → 仪表盘（固定布局）→ 待办 |
| Phase 3 AI | 饮食拍照识别、运动热量、睡眠截图解析、热量缺口、自定义目标 AI 解析 |
| Phase 4 社交 | 排行榜、互动、内容审核 |
| Phase 5 扩展 | 自定义仪表盘、时间日志模式、离线草稿、Capacitor APK 壳 |
