# docs/adr/ — 架构决策记录（ADR）

## 用途

记录每一个有分量的架构或选型决策：当时的背景、候选、理由，以及放弃了什么。

- 只增不改。决策被推翻时写一份新 ADR，并在旧档头部把状态改为 `Superseded by ADR-XXXX`，旧档正文不动。
- 模板字段：状态、日期、决策人；背景、面临的选项、决定、理由、放弃了什么、何时重审。
- 写入需要负责人确认（决策本来就是负责人拍的板）。
- 状态：`Proposed`（已写好、待负责人拍板）→ `Accepted`；被推翻时 `Superseded by ADR-XXXX`。

## 文件命名

`NNNN-<slug>.md`，四位编号递增。

本项目的编号例外：demo-init 约定 0001 为项目范围，但 0001、0002 在采用新版流程之前就已产生，并被已合并的 PR 和代码注释引用。为了不改动已有编号，项目范围记为 0003。

## 索引

| 编号 | 决策 | 状态 |
|---|---|---|
| [0001](./0001-ecosystem-or-standalone.md) | 独立部署，不接入 1037Solo 生态 | Accepted |
| [0002](./0002-account-quota-risk.md) | 账号、邮件、图片、AI 额度、风控、后台 | Accepted |
| [0003](./0003-project-scope.md) | 项目范围（对齐纪要、MVP 与暂不做清单） | Accepted |
| [0004](./0004-interaction-primitives.md) | 交互原语：Base UI | Accepted |
| [0005](./0005-motion.md) | 动效：CSS 预设 + React ViewTransition，不引入动效库 | Accepted |
| [0006](./0006-toast.md) | 提示消息：Base UI Toast | Accepted |
| [0007](./0007-date-time-picker.md) | 日期与时间选择：原生输入 + React DayPicker | Accepted |
| [0008](./0008-date-time-calc.md) | 日期与时区计算：date-fns + @date-fns/tz | Accepted |
| [0009](./0009-forms.md) | 表单：Base UI Form / Field + zod，不引入表单库 | Accepted |
| [0010](./0010-charts.md) | 图表：自研 SVG + d3-shape | Accepted |
| [0011](./0011-image-pipeline.md) | 图片压缩与传输：原生 canvas 转 JPEG，只用内联 file part | Accepted |
| [0012](./0012-client-data.md) | 客户端数据请求：TanStack Query | Accepted |
| [0013](./0013-validation.md) | 数据校验：zod 4 | Accepted |
| [0014](./0014-auth.md) | 鉴权与会话：Better Auth | Accepted |
| [0015](./0015-data-access.md) | 数据访问：Drizzle + pg | Accepted |
| [0016](./0016-api-layer.md) | 接口层：Hono + @hono/zod-openapi | Accepted |
| [0017](./0017-smtp.md) | SMTP 发信：Nodemailer | Accepted |
| [0018](./0018-testing.md) | 测试：Vitest | Accepted |
| [0019](./0019-pwa.md) | PWA：原生 manifest + 手写 Service Worker | Accepted |
| [0020](./0020-jobs.md) | 定时任务：周期键懒计算 + 系统 cron | Accepted |
| [0021](./0021-preset-avatars.md) | 头像：只用预设头像 | Accepted |
| [0022](./0022-welcome-splash-app.md) | 落地页、开屏、App 图标与 APK 分发 | Proposed |

0004–0020 由 `scripts/dev/library-showcase/build.mjs --adr` 从调研结论生成草稿（已存在的不会被覆盖），对应的对比页在 [docs/designs/library-showcase/](../designs/library-showcase/index.html)。

## 补充说明

- ADR-0011 取代 ADR-0002 第 4 节中"浏览器压缩为 WebP、长边 ≤ 1600px"的具体参数（Safari 不支持用 canvas 编码 WebP），ADR-0002 的其余内容不变。
