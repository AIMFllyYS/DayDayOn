# 路由统一规范

> 日期：2026-10-31 · 状态：草案。第 2 节的页面路由是规划，PRD 定稿后修正。
> Next.js 本身的约定（`params` 要 `await`、Cache Components 等）见 [nextjs-16-patterns.md](./nextjs-16-patterns.md)。

## 1. 原则

- URL 是对外契约：APK 壳的深链接和未来的 Kotlin 客户端都会依赖它，上线后不随意改名。必须改时保留旧地址并在 `next.config.ts` 里做永久重定向。
- 路径一律小写英文 kebab-case，用名词，不放中文、不放动词。例如 `/goals/new`，不用 `/createGoal`。
- 不带结尾斜杠（Next 默认行为，不改）。
- 一个页面只有一个地址。视图状态（筛选、范围、标签页）放查询参数，不另开路由。

## 2. 页面路由（规划）

| 路径 | 页面 | 路由组 | 导航 |
|---|---|---|---|
| `/` | 主页（仪表盘） | `(app)` | 一级 |
| `/todo` | 待办；`?view=log` 切换为时间日志 | `(app)` | 一级 |
| `/rank` | 排行榜；`?range=week\|month` | `(app)` | 一级 |
| `/me` | 我的 | `(app)` | 一级 |
| `/me/profile` | 个人资料（身高、体重、时区…） | `(app)` | 二级 |
| `/me/settings` | 偏好设置（提醒、日切换时间、公开范围） | `(app)` | 二级 |
| `/goals` | 我的目标列表 | `(app)` | 二级 |
| `/goals/new` | 新建目标 | `(app)` | 二级 |
| `/goals/[goalId]` | 目标详情与历史 | `(app)` | 二级 |
| `/goals/[goalId]/checkin` | 打卡表单（手动 / AI 识别） | `(app)` | 二级 |
| `/login` | 邮箱验证码登录 | `(auth)` | 无 |
| `/onboarding` | 新人引导 | `(auth)` | 无 |
| `/admin` | 后台首页（额度监控） | `admin/` | 后台侧栏 |
| `/admin/users`、`/admin/codes`、`/admin/settings` | 用户与封禁、兑换码、全站配置 | `admin/` | 后台侧栏 |
| `/dev`、`/dev/playbook/*` | 调试区与设计系统 | `dev/` | 无，生产 404 |

- 打卡入口（"＋"弹层）是客户端状态，不是路由；选好板块后进入 `/goals/[goalId]/checkin`。
- 一级页面就是导航项，定义在 `src/components/layout/nav-items.ts`，改这里要同步改上表。

## 3. 目录约定

```
src/app/
├── (auth)/            登录、引导：无导航的简洁布局
├── (app)/             登录后的应用：layout.tsx 是应用外壳（底栏 / 侧栏）
│   ├── page.tsx       → /
│   ├── todo/          → /todo
│   └── goals/[goalId]/checkin/
├── admin/             后台：独立布局，桌面优先，layout 里校验管理员身份（放在 Suspense 里）
├── dev/               调试区：layout 里做生产守卫，挂批注工具
└── api/
    ├── health/        健康检查
    ├── auth/[...all]/ Better Auth
    └── v1/            业务 REST 接口
```

- 路由组 `(name)` 只用来共享布局，不出现在 URL 里。
- 只在一个路由里用的组件放该路由下的 `_components/`（私有文件夹，不生成路由）。
- 动态段用 camelCase 加实体名：`[goalId]`、`[checkinId]`，不用 `[id]`，嵌套时不会混淆。
- `page.tsx` 只做组合（通常 30 行以内）：读 `params` / `searchParams`、调 service 取首屏数据、拼组件。
- 每个页面导出 `metadata` 或 `generateMetadata`，`title` 和导航文字一致，由根 layout 的模板补上"· DayDayOn"。注意：和 layout 同一层的 `page.tsx` 不套用该 layout 的 `title.template`，需要写 `title.absolute`。

## 4. 查询参数

- 需要刷新后保留、能分享、能用返回键回退的视图状态放查询参数：`?view=`、`?range=`、`?date=2026-10-31`。
- 只在当前交互里有效的状态（弹层开关、输入中的表单）用组件状态，不进 URL。
- 参数名用小写单词；值用枚举字符串，非法值回落到默认值，不报错。
- 读取 `searchParams` 的组件要放在 `<Suspense>` 里（Cache Components 规则）。

## 5. 调试区 `/dev`

- 目录是 `src/app/dev/`，URL 是 `/dev/*`。`dev/layout.tsx` 统一做生产守卫：`if (process.env.NODE_ENV === 'production') notFound()`，整个子树在生产环境返回 404，并带 `robots: noindex`。读数据的调试页在页面顶部再加一次守卫。
- 不用 `_dev`：下划线开头的文件夹是 Next 的[私有文件夹](../../node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md)，整个子树不生成路由。
- 也不用官方提供的 `%5Fdev` 写法：Next 16.4.3 下 `next typegen` 生成的路由类型是 `/_dev`，而 `next dev` 生成的是 `/%5Fdev`，两份类型对不上，`pnpm typecheck` 会失败（2026-10-31 实测）。
- `dev/` 可以引用正式代码，正式代码不得引用 `dev/`。
- 调试区内部的私有代码放 `dev/_annotate/`、`dev/playbook/_components/` 这类私有文件夹。

## 6. 接口路由

- 业务接口统一在 `/api/v1/` 下，Web、APK 壳、Kotlin 客户端共用（架构基线第 4 节）。
- 资源用复数名词 kebab-case：`/api/v1/goals`、`/api/v1/goals/{goalId}/checkins`。
- 标准方法表达增删改查；不适合 CRUD 的动作做成子资源并用 POST：`POST /api/v1/admin/ai/pause`（暂停全站 AI）、`POST /api/v1/redeem-codes/redeem`。
- 错误响应体统一为 `{ "code": "...", "detail": "..." }`，前端只认 `code`。
- 不兼容的改动升级为 `/api/v2/`，旧版本保留到客户端全部迁移完。
- 更细的接口规范（挂载方式、错误码、分页、幂等键、限流头）见 [api-conventions.md](./api-conventions.md)。

## 7. 链接与跳转

- 站内链接用 `next/link`；不在 `onClick` 里 `router.push` 代替普通链接，否则失去预取和中键新标签页。
- 二级页面的返回按钮：有站内历史时 `router.back()`，没有（例如从深链接直接打开）时跳到上一级路径。
- APK 壳的系统返回键行为和上面一致；弹层打开时返回键先关闭弹层。
