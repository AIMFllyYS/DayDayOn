# 组件库注册表 — DayDayOn

> 本表是依赖引入的唯一裁判：**每个关注点只有一个所有者**。表外的同类库禁止引入；要引入，先改本表（联网核实 → 负责人拍板 → 写 ADR → 更新本表 → 建 lessons 文件）。
> AI 引入或变更任何依赖前必读本表。
> 状态：2026-10-31 定稿。Phase 3 的 17 项建议由负责人全部采纳（ADR-0004 至 0020 为 Accepted）。证据与对比页见 [library-showcase](./designs/library-showcase/index.html)，怎么用见 [docs/conventions/](./conventions/README.md)。
> "已安装"列为"否"的包，按 [roadmap.md](./plans/roadmap.md) 的里程碑安装，**每次安装前仍要征得负责人同意**，并重新核对版本。

## 所有者总表

### 基础与工具链

| 关注点 | 所有者 | 版本 | 已安装 | 封装层入口 | 依据 | lessons |
|---|---|---|---|---|---|---|
| 应用框架 | Next.js（App Router、自托管） | 16.4.3 | 是 | — | 架构基线 §0 | [nextjs](./lessons/nextjs.md) |
| UI 运行时 | React | 19.3.1 | 是 | — | 同上 | — |
| 语言 | TypeScript | 6.0.3（锁定，typescript-eslint 尚不支持 7） | 是 | — | 同上 | — |
| 样式 | Tailwind CSS（`@tailwindcss/turbopack`） | 4.3.3 | 是 | `src/app/globals.css` | 同上 | — |
| className 拼接 | 自研 `cn()`（不做冲突合并） | — | — | `src/lib/cn.ts` | [ADR-0004](./adr/0004-interaction-primitives.md) | — |
| 字体加载 | `next/font/local` + 子集化 woff2 | 随 Next | — | `src/lib/fonts.ts` | — | — |
| 图标 | 自研 `Icon`（手绘） | — | — | `src/components/ui/icon.tsx` | ui-design-system §6 | — |
| 吉祥物与预设头像 | 自研 SVG 团团 | — | — | `src/components/mascot/` | [ADR-0021](./adr/0021-preset-avatars.md) | — |
| 包管理 | pnpm | 11.7.0 | 是 | — | — | [pnpm](./lessons/pnpm.md) |
| 代码质量 | ESLint 9 + eslint-config-next、Prettier 3 + prettier-plugin-tailwindcss、lefthook 2、commitlint 21、gitleaks 8（系统工具） | 见 `package.json` | 是 | 根目录配置文件 | — | — |

### 前端

| # | 关注点 | 所有者 | 版本 | 已安装 | 封装层入口 | ADR | lessons |
|---|---|---|---|---|---|---|---|
| 1 | 交互原语（抽屉、对话框、选择器、组合框、滑块、数字输入、验证码输入、菜单、气泡） | Base UI（`@base-ui/react`） | 1.9.0 | 否（M1） | `src/components/ui/` | [0004](./adr/0004-interaction-primitives.md) | [base-ui](./lessons/base-ui.md) |
| 2 | 动效 | 不引入库：CSS 预设 + React `<ViewTransition>` | — | — | `src/app/globals.css` | [0005](./adr/0005-motion.md) | — |
| 3 | 提示消息 | Base UI Toast | 同 #1 | 否（M1） | `src/components/ui/toast.tsx` | [0006](./adr/0006-toast.md) | 同 #1 |
| 4 | 日期与时间选择 | 原生 input + React DayPicker（`react-day-picker`） | 10.0.2 | 否（M2） | `src/components/ui/calendar.tsx`、`date-field.tsx`、`time-range-field.tsx` | [0007](./adr/0007-date-time-picker.md) | [react-day-picker](./lessons/react-day-picker.md) |
| 5 | 日期与时区计算 | `date-fns` + `@date-fns/tz` | 4.4.0 / 1.5.0 | 否（M1，Base UI 的 peer 依赖） | `src/lib/time/` | [0008](./adr/0008-date-time-calc.md) | [date-fns](./lessons/date-fns.md) |
| 6 | 表单与动态表单 | 不引入库：Base UI Form / Field + zod | 同 #1 | — | `src/components/ui/field.tsx`、`form.tsx`；`src/features/goal/components/schema-form.tsx` | [0009](./adr/0009-forms.md) | — |
| 7 | 图表 | 自研 SVG + `d3-shape` | 3.2.0 | 否（M2） | `src/components/charts/` | [0010](./adr/0010-charts.md) | — |
| 8 | 图片压缩与传输 | 不引入库：原生 canvas 转 JPEG | — | — | `src/lib/image/`、`src/server/ai/image.ts` | [0011](./adr/0011-image-pipeline.md) | — |
| 9 | 客户端数据请求 | TanStack Query（`@tanstack/react-query`） | 5.105.0 | 否（M3） | `src/lib/api/` | [0012](./adr/0012-client-data.md) | [tanstack-query](./lessons/tanstack-query.md) |
| 10 | 数据校验 | `zod` | 4.6.7 | 否（M3） | 工具库豁免；schema 在 `src/features/<领域>/schemas.ts` | [0013](./adr/0013-validation.md) | [zod](./lessons/zod.md) |

### 服务端与平台

| # | 关注点 | 所有者 | 版本 | 已安装 | 封装层入口 | ADR | lessons |
|---|---|---|---|---|---|---|---|
| 11 | 鉴权与会话 | Better Auth（`better-auth`，含 emailOTP、admin、twoFactor 插件和 Drizzle 适配器） | 1.7.14 | 否（M3） | `src/server/auth/`、`src/lib/auth-client.ts` | [0014](./adr/0014-auth.md) | [better-auth](./lessons/better-auth.md) |
| 12 | 数据访问 | `drizzle-orm` + `pg`；开发依赖 `drizzle-kit`、`@types/pg` | 0.45.4 / 8.23.1 / 0.31.11 | 否（M3） | `src/server/db/` | [0015](./adr/0015-data-access.md) | [drizzle](./lessons/drizzle.md) |
| 13 | 接口层与契约 | `hono` + `@hono/zod-openapi` | 4.13.14 / 1.6.3 | 否（M3） | `src/server/api/`、`src/app/api/v1/[[...route]]/route.ts` | [0016](./adr/0016-api-layer.md) | [hono](./lessons/hono.md) |
| 14 | SMTP 发信 | `nodemailer`（自带类型声明） | ≥ 10.3.1 | 否（M3） | `src/server/mail/` | [0017](./adr/0017-smtp.md) | [nodemailer](./lessons/nodemailer.md) |
| 15 | 测试 | `vitest` + `vite`（开发依赖） | 5.0.5 / 8.x | 否（M3） | `vitest.config.ts` | [0018](./adr/0018-testing.md) | [vitest](./lessons/vitest.md) |
| 16 | PWA | 不引入库：`app/manifest.ts` + 手写 `public/sw.js` | — | — | `src/app/manifest.ts`、`public/sw.js` | [0019](./adr/0019-pwa.md) | — |
| 17 | 定时任务 | 不引入库：周期键懒计算 + 系统 cron | — | — | `src/server/quota/` | [0020](./adr/0020-jobs.md) | — |
| — | 数据库 | PostgreSQL（Docker） | 18.6 | 服务器已运行 | `src/server/db/` | [ADR-0001](./adr/0001-ecosystem-or-standalone.md) | — |
| — | 部署 | 阿里云 ECS + PM2 + 宝塔 Nginx | — | 服务器已配置 | `scripts/deploy/` | ADR-0001 | [aliyun-ecs](./lessons/aliyun-ecs.md) |
| — | AI 模型 | DeepSeek `deepseek-flash` | — | — | `src/server/ai/model.ts` | [ADR-0002](./adr/0002-account-quota-risk.md) | [ai-sdk](./lessons/ai-sdk.md) |
| — | AI 编排 | Vercel AI SDK：`ai`、`@ai-sdk/deepseek`、`@ai-sdk/react` | 7.0.159 / 3.0.77 / 4.0.163（2026-10-31 registry） | 否（M3） | `src/server/ai/`、`src/features/agent/` | 负责人指定 | [ai-sdk](./lessons/ai-sdk.md) |
| — | 邮件服务 | 阿里云邮件推送（SMTP） | — | — | `src/server/mail/` | ADR-0002 | — |

后台的数据表格不选型，用自研的简单表格（用户量小；TanStack Table 在 react.dev 的 incompatible-library 规则里被点名）。

### 不需要单独安装的包

这些包会被上表的所有者间接带进来，或者有更简单的替代。**不要写进 `package.json`**：

| 包 | 原因 |
|---|---|
| `@better-auth/drizzle-adapter` | `better-auth` 已依赖它，并通过 `better-auth/adapters/drizzle` 子路径导出 |
| `@hono/vercel`、`@hono/node-server` | Next Route Handler 直接调用 `app.fetch(request)` 即可（[api-conventions.md](./conventions/api-conventions.md) 第 2 节） |
| `@types/nodemailer` | Nodemailer 10 自带类型声明；官方说明两者同时安装会产生声明冲突 |
| `vite-tsconfig-paths` | Vite 8 内置 `resolve.tsconfigPaths` |
| `@daypicker/react` | 只是 `react-day-picker` 的转发包（依赖 `react-day-picker@10.0.2`），官网示例用这个名字；本项目装 `react-day-picker` |
| `server-only` | Next 内部处理 `import 'server-only'`，安装是可选的（Next 文档）；Vitest 里用别名指向空模块（[testing.md](./conventions/testing.md)） |
| `jsdom`、`@testing-library/*`、`@vitejs/plugin-react` | 不写组件单元测试，界面用 Playbook + ego-browser 验收 |

## 互斥禁令（全部生效）

**样式、图标与工具：**

- 图标 = 自研 `Icon`，禁止引入 lucide-react、@heroicons/react、react-icons、@tabler/icons-react 等图标库，也不要复制它们的路径数据。
- 样式 = Tailwind CSS 4 + `globals.css` token，禁止 CSS-in-JS（styled-components、@emotion/*）、UnoCSS；CSS Modules 只用于覆盖第三方组件。
- className = 自写 `cn()`，禁止引入 tailwind-merge、clsx：tailwind-merge 默认配置会把 `text-body text-muted` 合并成 `text-muted`（2026-10-31 实测）。
- 包管理 = pnpm，禁止提交 package-lock.json、yarn.lock、bun.lockb。
- 字体 = `next/font/local` 加载子集化 woff2，禁止 `next/font/google`，禁止中文全量 webfont。
- 云服务：禁止任何腾讯云 SDK 与服务（EdgeOne、COS 等）。

**前端：**

- 交互原语 = Base UI，禁止引入 radix-ui / @radix-ui/*、react-aria-components、@headlessui/react、@ark-ui/react、vaul、cmdk、shadcn/ui 生成的组件；业务代码禁止直接 import `@base-ui/react`，只经 `src/components/ui/`，并且只用子路径导入（`@base-ui/react/drawer`）。
- 动效：禁止引入 motion / framer-motion、react-spring、gsap、animejs、@formkit/auto-animate、lottie-*、@rive-app/*。
- 提示消息 = Base UI Toast，禁止引入 sonner、react-hot-toast、react-toastify。
- 日历 = react-day-picker（只经 `calendar.tsx`），禁止引入 react-datepicker、@mui/x-date-pickers 等。
- 日期计算 = date-fns + @date-fns/tz（只经 `src/lib/time/`），禁止引入 dayjs、moment、luxon、temporal-polyfill。
- 表单：禁止引入 react-hook-form、@tanstack/react-form、formik、@conform-to/*。
- 图表：禁止引入 recharts、echarts、chart.js、@visx/*、@nivo/*、d3（整包）、d3-scale；`d3-shape` 只允许在 `src/components/charts/` 里 import。
- 图片压缩：禁止引入 browser-image-compression、compressorjs；服务端不对用户图片转码（不用 sharp 处理用户图片），只做格式与大小校验。
- 客户端数据请求 = TanStack Query，禁止引入 swr、axios、ky；业务组件不直接 fetch `/api/v1`，只经 `src/lib/api/`。
- 校验 = zod，禁止引入 valibot、yup、joi、arktype；统一写 `import * as z from 'zod'`，禁止 `import { z } from 'zod'`（同样的 schema 实测 90.8 KB 对 25.6 KB）。`import { z } from '@hono/zod-openapi'` 只允许出现在 `src/server/api/`。

**服务端：**

- 鉴权 = Better Auth，禁止引入 next-auth / @auth/*、lucia、iron-session，禁止用 jose 自己签发会话。
- 数据访问 = Drizzle + pg，禁止引入 prisma、@prisma/client、kysely（Better Auth 内部自带的除外）、postgres（postgres.js）、typeorm、sequelize；只有 `src/server/` 可以 import drizzle-orm 和 pg。
- 接口层 = Hono + @hono/zod-openapi，禁止引入 @orpc/*、@trpc/*、express、fastify；只有 `src/server/api/` 和 `src/app/api/v1/` 可以 import `hono` 与 `@hono/zod-openapi`（前端的类型化客户端 `hono/client` 只在 `src/lib/api/client.ts` 里用）。
- 发信 = nodemailer，禁止引入 @alicloud/dm20151123 等云厂商邮件 SDK、邮件模板引擎（mjml、react-email 等）。
- AI 模型 = `deepseek-flash`，禁止接入 @ai-sdk/openai、@ai-sdk/anthropic 等其他 provider，也不用 `deepseek-v4-pro`。
- AI 调用必须用 provider 实例（`src/server/ai/model.ts`），禁止写字符串模型 id：AI SDK 对字符串模型默认走 Vercel AI Gateway。
- 图片只以内联 file part 发给 DeepSeek，禁止调用 `uploadFile` / `deepSeek.files()`（DeepSeek Files API 不设过期时间就永久保存文件）。
- 测试 = vitest，禁止引入 jest、mocha。
- PWA：禁止引入 serwist、@serwist/*、next-pwa、workbox-*。
- 定时任务：禁止引入 node-cron、croner、pg-boss、bullmq（需要时先走变更规则）。
- 缓存与限流：禁止引入 Redis 客户端（ioredis、redis）；限流计数存 PostgreSQL。

## 内联与原生清单（不需要库）

- className 拼接 → `src/lib/cn.ts`
- 健康检查 → `src/app/api/health/route.ts`，原生 Route Handler
- 限流计数 → 鉴权端点用 Better Auth 内置限流（存数据库）；`/api/v1` 用 PostgreSQL 表 + 原子 UPDATE（ADR-0002 第 6 节）
- 图片压缩 → `createImageBitmap` + `canvas.toBlob('image/jpeg', 0.8)`
- 日期、时间输入 → 原生 `<input type="date | time | datetime-local">`
- 日期显示 → `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`（计算才用 date-fns）
- 动效 → CSS 预设、Base UI 的 `data-starting-style` / `data-ending-style`、React `<ViewTransition>`
- Service Worker → 手写 `public/sw.js`
- 周期性重置 → 周期键懒计算
- 图表比例尺 → `src/components/charts/` 里几行线性映射
- 邮件模板 → `src/server/mail/` 里的 HTML 字符串函数

## 变更规则

新增关注点或更换所有者：联网核实候选（七项硬指标：最近发版、维护者、gzip 体积与传递依赖数、安装脚本、许可证与依赖树 copyleft、与本项目技术栈的兼容性、文档与 TS 支持）→ 生成对比页（`node scripts/dev/library-showcase/build.mjs`）→ 负责人拍板 → 写 ADR → 更新本表 → 建 `docs/lessons/<lib>.md`。

升级已有所有者的大版本：读该库的 lessons 文件和升级指南 → 负责人同意 → 升级后重审 lessons 条目。

