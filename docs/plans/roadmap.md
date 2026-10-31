# 路线图（v0.1）

> 日期：2026-10-31 · 状态：定稿，随组件库选型一起拍板（ADR-0004 至 0020 全部 Accepted）
> 范围以 [ADR-0003](../adr/0003-project-scope.md) 为准；技术选型以 [libraries.md](../libraries.md) 为准；各库怎么用以 [docs/conventions/](../conventions/README.md) 的落地规范为准。
> 每个里程碑都要满足"完成标准"才进入下一个；完成标准里的界面项都要用 ego-browser 在 390px 和 1280px 两种宽度下实际操作。
> 每个里程碑的依赖安装都要**先征得负责人同意**，安装前重新核对版本。

## 总览

| 里程碑 | 内容 | 依赖新增 | 完成标准 |
|---|---|---|---|
| **M0 收尾初始化** | 提交本轮文档；demo-init Phase 4 收尾 | — | 见下 |
| **M1 基础组件库** | Playbook 里完成全部通用组件 | `@base-ui/react`、`date-fns`、`@date-fns/tz` | 见下 |
| **M2 板块专用组件** | Playbook 里完成五个板块和各页面的专用组件 | `react-day-picker`、`d3-shape` | 见下 |
| **M3 业务基础设施** | 数据库、鉴权、接口、发信、AI、测试 | 服务端全部 | 见下 |
| **M4 MVP 功能** | 按 ADR-0003 的 5 项依次接业务 | — | 见下 |
| **M5 上线 v0.1** | HTTPS、PWA、首次发布、朋友试用 | — | 见下 |

M1、M2 只在 `/dev/playbook` 里做，用假数据，不接后端，可以和 M3 并行。

## M0 收尾初始化

- [x] ADR-0004 至 0020 改为 Accepted；libraries.md 定稿（所有者总表、"不需要单独安装的包"、互斥禁令全部生效）
- [x] 编写 9 份落地规范：api-conventions、database、auth、ai-and-quota、time-and-dates、client-data-and-forms、ui-primitives、testing、pwa
- [x] 为 11 个选定的库建 lessons 文件，预置调研时核实的坑
- [ ] 负责人确认批量结算清单后，切工作分支，按主题分 PR 提交到 `dev`（规范与 ADR、自进化文档、组件库对比页）
- [ ] 工作区里其他会话的设计系统改动（Playbook、原子组件、Agent 组件、团团、批注工具）单独整理成 `feat/design-system` PR
- [ ] skills 注册表绑定方案确认（Phase 4.1）
- [ ] 交接说明（Phase 4.7）

**完成标准**：`dev` 上 `pnpm check`、`pnpm build` 通过；ADR-0004 至 0020 都有结论。

## M1 基础组件库（Playbook）

规范：[ui-primitives.md](../conventions/ui-primitives.md)、[client-data-and-forms.md](../conventions/client-data-and-forms.md) 第 6 节、[ui-design-system.md](../conventions/ui-design-system.md)。

- 安装：`@base-ui/react@1.9.0`、`date-fns@4.4.0`、`@date-fns/tz@1.5.0`（后两个是 Base UI 的 peer 依赖）
- 根布局一次性设置：`isolation: isolate` 根节点、`body { position: relative }`、全局 `Toast.Provider`（改 `layout.tsx`、`globals.css` 前先和设计系统会话对齐）
- `Sheet` 改为 Base UI Drawer（手机，可下滑关闭，带 `VirtualKeyboardProvider`）/ Dialog（≥ 768px），补退场动画，对外接口不变
- 新增：`ConfirmDialog`、`Toast`（+ 全局 toast 管理器）、`Select`、`Combobox`（单选、多选、可新建）、`Slider`、`NumberField`、`OTPField`、`Menu`、`Popover`、`Checkbox`、`Form`
- `Field` 改为基于 Base UI Field，支持服务端错误回显
- 空状态、错误态（团团 + 文案）、预设头像（ADR-0021）
- 动效页补 `<ViewTransition>` 的列表增删和页面切换示范
- ESLint（修改前确认）：`@base-ui/react` 只允许在 `src/components/ui/**` 导入、禁止包根导入；禁止导入 libraries.md 互斥禁令里的包；禁止 `import { z } from 'zod'`

**完成标准**：每个组件在 Playbook 有演示和批注定稿；键盘可操作；手机上抽屉内输入框不被软键盘遮挡；首屏（主页外壳）不加载任何弹层代码。

## M2 板块专用组件（Playbook）

规范：[time-and-dates.md](../conventions/time-and-dates.md)、[ui-primitives.md](../conventions/ui-primitives.md) 第 6、7 节、[ai-and-quota.md](../conventions/ai-and-quota.md) 第 5 节。

- 安装：`react-day-picker@10.0.2`（不装 `@daypicker/react`）、`d3-shape@3.2.0`
- `src/lib/time/` 先写好纯函数（打卡日归属、周期键、睡眠区间），供组件演示用；测试在 M3 装好 Vitest 后补齐
- 时间与日期：`DateField`、`TimeField`、`TimeRangeField`（睡眠跨午夜，自动算时长）、`Calendar`（打卡日历，已打卡的日子上色）
- 图表：`LineChart`（体重、花费）、`WeekHeatmap`、`Sparkline`；营养素用现有 `ProgressRing`
- 图片：`ImagePicker`（拍照 / 相册 → `src/lib/image/compress.ts` 压缩为 JPEG → 预览 → 识别中状态）
- 动态表单：字段编辑器 + `SchemaForm`（字段类型固定清单）
- 五个板块的打卡表单：运动（品类组合框、时长、强度）、饮食（拍照识别草稿、逐项调份量、餐次）、睡眠（时间区间、质量评分）、学业（逐条记录）、自定义（SchemaForm）
- 每日指标卡（满意度、体重）、待办列表（勾选动画、DDL）、仪表盘卡片、排行榜项、后台表格

**完成标准**：五个板块的打卡流程都能在 Playbook 用假数据走通；手机和桌面布局都通过批注评审。

## M3 业务基础设施

规范：[api-conventions.md](../conventions/api-conventions.md)、[database.md](../conventions/database.md)、[auth.md](../conventions/auth.md)、[ai-and-quota.md](../conventions/ai-and-quota.md)、[client-data-and-forms.md](../conventions/client-data-and-forms.md)、[testing.md](../conventions/testing.md)。

- 安装（逐个确认）：
  - 依赖：`zod`、`better-auth`、`drizzle-orm`、`pg`、`hono`、`@hono/zod-openapi`、`nodemailer`、`@tanstack/react-query`、`ai`、`@ai-sdk/deepseek`、`@ai-sdk/react`
  - 开发依赖：`drizzle-kit`、`@types/pg`、`vitest`、`vite@8`
  - **不装**：`@better-auth/drizzle-adapter`、`@hono/vercel`、`@types/nodemailer`、`vite-tsconfig-paths`（原因见 libraries.md）
  - pnpm 11 的 `allowBuilds`：drizzle-kit 会带进有 postinstall 的 esbuild，只放行 esbuild
- 本地 Docker PostgreSQL（23432）+ 种子数据
- 决定 `scripts/` 里 TypeScript 脚本（种子数据、OpenAPI 导出）的运行方式：Node 24 能直接跑 TS 但不认 `@/` 别名，候选是 `tsx`，走依赖变更流程
- `src/server/env.ts` 用 zod 校验环境变量
- Drizzle schema 与首个迁移；Better Auth（emailOTP、admin、twoFactor、数据库限流、`x-real-ip`、关闭遥测）；首次用 CLI 生成表时实测它能否读取 `auth.ts`（database.md 第 8 节）
- Hono `/api/v1` 骨架：统一错误体、`requireUser()`、CSRF、幂等键、限流中间件；OpenAPI 导出到 `docs/specs/api/openapi.json`
- TanStack Query 客户端、query key 工厂、错误码文案表
- Vitest：`src/lib/time/`、计价与额度、邮箱规范化的单元测试；`pnpm test` 加入 CI 和 Definition of Done
- 部署闸门增加"切换版本前执行迁移、迁移前备份"（服务器操作，先问）
- 服务器 `.env` 增加 `BETTER_AUTH_TELEMETRY=0`、删除不再使用的 `DEEPSEEK_MODEL`（服务器操作，先问）
- ESLint（修改前确认）：按各规范第"工具强制"节落地——`drizzle-orm` / `pg` 只在 `src/server/`；`hono` 只在接口层；`ai` / `@ai-sdk/deepseek` 只在 `src/server/ai/`；禁止 `uploadFile`；`src/server/ai/` 禁止 `node:fs`
- 实战中修订规范：上面 9 份规范的条目被证实或推翻后，同步更新规范和对应的 lessons 文件

**完成标准**：本地能用邮箱验证码登录并退出；`/api/health` 之外至少一个受保护接口带测试；CI 绿。

## M4 MVP 功能（按 ADR-0003 顺序）

1. 邮箱验证码登录 + 新人引导（昵称、预设头像、基础资料、是否上榜）
2. 设定目标 + 五个板块手动打卡 + 每日满意度和体重
3. 饮食拍照 AI 识别，以及每周额度与兑换码、IP 风控、最简后台（含全站日上限）
4. 主页仪表盘（固定布局）+ 排行榜
5. 待办（清单 + DDL）

每项先写 `docs/specs/` 里的 PRD（含架构基线第 8 节的边界条件），再实现。

**完成标准**：每项都有 PRD、接口出现在 OpenAPI 里、关键纯函数有测试、ego-browser 在两种宽度下走通验收步骤。

## M5 上线 v0.1

- DNS：`daydayon` A 记录改为 `8.162.4.159`；签 HTTPS 证书，Nginx 换成正式站点配置
- 服务器 `.env` 填 SMTP 与 DeepSeek 密钥；生产数据库迁移
- PWA：按 [pwa.md](../conventions/pwa.md) 实现 `manifest.ts`、图标、`public/sw.js`、离线页
- `MAINECS_DEPLOY_ENABLED` 改为 `true`，负责人同意后第一次 `dev → main` 发布
- 朋友试用两周后按 ADR-0003 重审范围

**完成标准**：公网 HTTPS 可用；在 iPhone 和安卓上安装到桌面并完成一次完整打卡；额度、限流、封号在后台可见可操作。

