# docs/conventions/

项目规范。格式、lint、提交信息由工具强制，这里只写工具管不到的约定和背后的理由。

## 现有文档

- [project-structure.md](./project-structure.md) — 目录结构与分层规则
- [code-size-and-organization.md](./code-size-and-organization.md) — 代码长度与文件组织（长度阈值、colocation 原则、拆分判断方法）
- [nextjs-16-patterns.md](./nextjs-16-patterns.md) — Next.js 16.4 关键模式与陷阱（proxy.ts、async API、Cache Components、standalone）
- [code-style.md](./code-style.md) — 代码风格
- [code-review.md](./code-review.md) — Code review 检查清单
- [git-workflow.md](./git-workflow.md) — 分支、提交、PR、发布
- [ui-design-system.md](./ui-design-system.md) — 页面设计规范：色彩、字体、动效、原子组件、导航、Agent 组件、批注流程（效果见 `/dev/playbook`）
- [routing.md](./routing.md) — 路由统一规范：页面路由表、目录与命名、查询参数、调试区、接口路由
- [ports.md](./ports.md) — 端口约定（应用 23329、数据库 23432）及所有引用位置

以下是 Phase 3 选型拍板后（2026-10-31）编写的库落地规范。本项目没有对应的内置规则包，这些文档由联网调研生成，条目未经实战验证，踩坑后按 lessons 机制修订：

- [api-conventions.md](./api-conventions.md) — `/api/v1` 接口规范：Hono 挂载、路由写法、OpenAPI、数据格式、错误码、鉴权、限流、幂等、分页、上传
- [database.md](./database.md) — 数据库与迁移：Drizzle 0.45 连接、命名、列类型、事务与额度账本、迁移流程、Better Auth 的表
- [auth.md](./auth.md) — 鉴权与会话：Better Auth 配置、限流分工、邮箱白名单、读会话、管理员与封号
- [ai-and-quota.md](./ai-and-quota.md) — AI 调用、额度与图片：模型实例、思考模式、预占与结算、计价、图片不落盘、草稿确认
- [time-and-dates.md](./time-and-dates.md) — 时间与日期：三种时间、时区、`src/lib/time/`、显示与输入
- [client-data-and-forms.md](./client-data-and-forms.md) — 客户端数据与表单：TanStack Query、query key、乐观更新、Base UI Form + zod
- [ui-primitives.md](./ui-primitives.md) — 交互原语与封装层：Base UI 封装清单、根布局设置、懒加载、抽屉、日历、图表
- [testing.md](./testing.md) — 测试：分工、必测清单、写法、Vitest 配置
- [pwa.md](./pwa.md) — PWA：manifest、Service Worker 注册与缓存策略、更新

## 与 AGENTS.md 的关系

`AGENTS.md` 是给 AI 编码代理的精简索引；本目录是完整规范。两边内容要一致，冲突时以代码和工具配置为准，并在同一次改动里修正文档。

## 写规范的规范（元规范）

来自 demo-init Phase 2。新增或修改本目录的文档前先读这一节。

### 措辞：写具体禁令，不写抽象原则

写给 AI 的规则必须能直接判断对错。

| 不要这样写 | 要这样写 |
|---|---|
| 保持组件简洁 | 页面不重新写按钮、卡片、进度条，只用 `src/components/ui/` 里的组件 |
| 注意样式一致 | 只用 `globals.css` 的 token 和语义字号，禁止写死色值、禁止 `text-sm` |
| 谨慎引入依赖 | 引入依赖前先查 `docs/libraries.md`，表外的同类库禁止引入 |

### 约束强度：能用工具保证的，不留在文档里

| 层 | 形式 | 本项目的例子 |
|---|---|---|
| 硬约束（工具强制，违规直接报错） | ESLint、TypeScript strict、commitlint、gitleaks、CI、分支保护 | 禁止 `any`；提交信息格式；密钥扫描；`pnpm typecheck` 先跑 `next typegen` |
| 中约束（代码即教材，AI 照着已有代码写） | 封装层、原子组件、Playbook 演示 | `src/components/ui/`、`tone.ts`、`/dev/playbook` |
| 软约束（文档提醒，会被遗忘） | AGENTS.md、本目录、lessons | 业务写操作只走 `/api/v1`；图片不落盘 |

- 每条软约束都要想一想能不能升级：能写成 lint 规则的写成 lint 规则，反复出现的第三方调用问题收进封装层。
- 升级完成后，从文档和 lessons 里删掉对应条目（见 [lessons/README.md](../lessons/README.md) 的"压缩与毕业"）。

### 修改流程

规范改动先作为未提交 diff，在会话末尾和其他规范、ADR、lessons 改动一起交给负责人确认，确认后再提交（批量结算）。
