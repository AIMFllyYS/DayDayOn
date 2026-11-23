# 项目结构与文件组织

> 本文档是 `AGENTS.md` 中 "Project Structure" 的完整版。
> 文件放置的判断方法（colocation、`src/features/` 提升条件）见 [code-size-and-organization.md](./code-size-and-organization.md)。
> 标注"规划"的目录在对应功能落地时才创建。

## 目录结构

```
.
├── src/
│   ├── proxy.ts                    # Next.js 16 请求代理：入口重定向（未登录 / → /welcome，其余 → /login）
│   ├── instrumentation.ts          # Next.js 服务启动钩子：幂等执行 Drizzle 数据库迁移
│   ├── app/                        # 路由层：只放路由文件
│   │   ├── layout.tsx              # 根 layout（含 <html> <body> 与开屏内联脚本）
│   │   ├── loading.tsx / error.tsx / not-found.tsx / global-error.tsx
│   │   ├── globals.css
│   │   ├── manifest.ts             # PWA Web App Manifest
│   │   ├── icon.tsx / apple-icon.tsx
│   │   ├── (marketing)/            # 公开营销与落地页
│   │   │   └── welcome/            # 落地页（/welcome，含 APK 下载与功能演示）
│   │   ├── (auth)/                 # 登录、新人引导、隐私说明（login / onboarding / privacy）
│   │   ├── (app)/                  # 登录后的应用（底部导航 / 侧边导航）
│   │   │   ├── layout.tsx          # 应用外壳
│   │   │   ├── page.tsx            # 主页（仪表盘）
│   │   │   ├── agent/              # AI 助手（对话与智能识图打卡）
│   │   │   ├── checkin/            # 打卡页（含 smart 智能识图打卡）
│   │   │   ├── friends/            # 好友只读子页（好友目标详情 /friends/[friendUserId]/goals/[goalId]）
│   │   │   ├── goals/              # 目标管理（列表、新建、详情）
│   │   │   ├── todo/               # 待办
│   │   │   ├── rank/               # 排行榜
│   │   │   ├── notifications/      # 全屏消息中心与官方通知
│   │   │   └── me/                 # 我的（设置、个人资料、检查更新）
│   │   ├── admin/                  # 后台管理（用户、兑换码、系统设置）
│   │   ├── dev/                    # 调试区（/dev/*），production 返回 404
│   │   │   ├── playbook/           # 设计系统：token、原子组件、动效、导航、Agent 组件
│   │   │   └── _annotate/          # 调试批注工具与草图画板（只挂在 /dev 下）
│   │   ├── download/[file]/        # APK 本地开发与回源兜底下载 Route Handler（支持 Range）
│   │   ├── icons/[name]/           # 多尺寸图标与 Android 自适应前景图生成路由
│   │   └── api/
│   │       ├── health/route.ts     # 部署健康检查
│   │       ├── auth/[...all]/      # Better Auth + 自托管人机验证 /api/auth/captcha
│   │       └── v1/[[...route]]/    # 只把请求转给 Hono（src/server/api/），见 api-conventions.md
│   ├── components/
│   │   ├── ui/                     # 原子组件：无业务逻辑（组件库选型见 docs/libraries.md）
│   │   ├── layout/                 # 应用外壳：底部导航、侧栏、顶栏、开屏控制器、品牌图标
│   │   ├── mascot/                 # 吉祥物团团：绘制、静态版、互动版、预设头像
│   │   ├── charts/                 # 自研 SVG 图表，d3-shape 的唯一入口
│   │   └── markdown/               # AI 输出渲染：react-markdown / KaTeX / Mermaid 唯一封装入口
│   ├── assets/
│   │   └── fonts/                  # 子集化后的 woff2 与 OFL 许可证（next/font/local 加载）
│   ├── features/                   # 21 个业务领域模块（跨路由复用时才提升）
│   │   ├── admin/                  # 后台管理（用户、兑换码、设置表单、TOTP、金额）
│   │   ├── agent/                  # AI 对话、工具流展示与多模态输入
│   │   ├── app-update/             # 版本检查、更新日志解析与端内更新弹窗
│   │   ├── auth/                   # 登录、验证码、人机校验交互
│   │   ├── chat/                   # 好友聊天与打卡房间消息
│   │   ├── checkin/                # 打卡记录、智能识图打卡与动态表单
│   │   ├── dashboard/              # 仪表盘与今日概览卡片
│   │   ├── diet/                   # 饮食打卡与 AI 饮食识别草稿
│   │   ├── friend/                 # 好友关系与互动
│   │   ├── goal/                   # 目标配置、周期规则与 SchemaForm
│   │   ├── insights/               # 趋势统计与图表分析
│   │   ├── me/                     # 个人资料、主题/吉祥物偏好、设置多级菜单
│   │   ├── metric/                 # 量化指标记录（体重、步数等）
│   │   ├── notification/           # 消息通知中心与官方公告
│   │   ├── onboarding/             # 新用户初始化引导
│   │   ├── quota/                  # AI 额度查看与兑换
│   │   ├── rank/                   # 好友排行榜
│   │   ├── referee/                # AI 裁判规则与判定
│   │   ├── shared/                 # 跨领域共享辅助组件与常量
│   │   ├── todo/                   # 待办清单
│   │   └── welcome/                # 落地页展示模块与下载信息
│   ├── server/                     # server-only 代码，文件顶部 import 'server-only'
│   │   ├── env.ts                  # zod 校验环境变量，服务端只从这里读
│   │   ├── api/                    # Hono 应用、路由、中间件、错误码（api-conventions.md）
│   │   ├── services/               # 业务逻辑：纯 TS 函数，不 import next/*、hono
│   │   ├── db/                     # Drizzle schema、连接、迁移（database.md）
│   │   ├── auth/                   # Better Auth 配置；对外只暴露 getSession / requireUser / requireAdmin（auth.md）
│   │   ├── ai/                     # 模型实例、runAi、计价、图片、prompts（ai-and-quota.md）
│   │   ├── quota/                  # AI 额度预占、结算、释放、周期键
│   │   ├── moderation/             # 内容安全：DFA 敏感词过滤
│   │   ├── mail/                   # 阿里云邮件推送（SMTP，Nodemailer）
│   │   ├── crypto.ts               # 服务端加解密工具
│   │   ├── idempotency.ts          # 幂等键校验与去重
│   │   ├── rate-limit.ts           # 限流计数，/api/v1 与 Better Auth hook 共用
│   │   └── settings.ts / settings-schema.ts  # 运行时系统设置读写与校验
│   ├── lib/                        # 前后端通用的工具函数与 hooks
│   │   ├── api/                    # TanStack Query 与类型化接口客户端（client-data-and-forms.md）
│   │   ├── time/                   # 日期与时区计算的唯一入口（time-and-dates.md）
│   │   ├── image/                  # 浏览器端图片压缩与文件头魔数嗅探
│   │   ├── app-version.ts          # 网页构建版本号（与 package.json / manifest.json 同步）
│   │   ├── auth-client.ts          # Better Auth 浏览器客户端
│   │   ├── cn.ts                   # 自研 className 拼接
│   │   ├── entry-redirect.ts       # 入口路由重定向纯规则函数
│   │   ├── fonts.ts                # next/font/local 字体配置
│   │   ├── native.ts               # Android 原生能力桥（window.DayDayOnNative）唯一封装层
│   │   ├── semver.ts               # SemVer 版本号比较
│   │   ├── splash.ts               # PWA 开屏判断与内联脚本
│   │   └── theme.ts                # 主题与吉祥物偏好读写
│   └── test/                       # Vitest 测试桩（如 server-only-stub.ts）
├── android/                        # Android Kotlin 原生混合外壳工程与离线构建脚本（build-apk.ps1）
├── download/                       # 版本清单（manifest.json）、更新日志（CHANGELOG.md）与本地 APK 输出（apk/）
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
│   └── dev/                        # 开发辅助、数据库迁移/种子、OpenAPI 导出
├── public/                         # 规划（M5 待建）：静态资源（sw.js 等，保持小体积，见下文）
├── .github/workflows/              # CI 与部署
├── AGENTS.md
├── commitlint.config.mjs
├── drizzle.config.ts
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
