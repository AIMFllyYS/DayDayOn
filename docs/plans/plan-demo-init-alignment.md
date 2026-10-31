# demo-init 新版流程：重走进度

> 日期：2026-10-31 · 依据：demo-init 2026-08-30 版（已同步到 Kiro：`~/.kiro/skills/demo-init`）
> 本文件跟踪五个阶段的进度、各阶段待确认的事项和本次会话积累的未提交改动。每轮只问一个主问题。

## 1. 进度

| 阶段 | 状态 | 产出 |
|---|---|---|
| Phase 0 分流 | ✅ 正式项目（B），走完整流程 | — |
| Phase 1 需求对齐 | ✅ 负责人 2026-10-31 确认 | [ADR-0003 项目范围](../adr/0003-project-scope.md)（Accepted） |
| Phase 2 通用规范 | ✅ 负责人 2026-10-31 全部采用，无偏离项 | 第 3 节 |
| Phase 3 组件库对齐 | ✅ 负责人 2026-10-31 全部采纳：ADR-0004 至 0020 改为 Accepted，[libraries.md](../libraries.md) 定稿，并编写 9 份落地规范 | 第 4 节 |
| Phase 4 落盘交接 | 🔶 自进化四件套、lessons 文件、落地规范已建；**待确认**：批量结算提交、skills 绑定；封装层骨架随依赖安装（M1、M3）；交接说明最后写 | 第 5 节；后续里程碑见 [roadmap.md](./roadmap.md) |

当前阶段的定位（负责人 2026-10-31）：还没有正式开发，目前只有 `/dev/playbook`。正式搭建业务之前，先把基础组件库和各打卡板块的专用组件做扎实。所以 Phase 3 先做前端关注点，后端关注点放在搭建业务之前。

## 2. Phase 1：对齐纪要

纪要全文在 ADR-0003。负责人 2026-10-31 确认了"MVP 只上 5 项、其余列入暂不做"的切法，ADR-0003 已改为 Accepted。

## 3. Phase 2：默认规范清单（负责人 2026-10-31 全部采用）

以下默认值已经写进对应文档（未提交，随批量结算一起提交）：

1. **代码长度与组织**：长度是触发器不是规则（[code-size-and-organization.md](../conventions/code-size-and-organization.md)）。
2. **Code review 清单**：新增"依赖"一节，`package.json` 改动按最高风险审（[code-review.md](../conventions/code-review.md)）。
3. **Git 工作流**：沿用本项目已有约定（`dev` 集成、`main` 发布、中文描述），偏离 skill 默认的"从 main 切出"。新增：AI 代理 push、开 PR、合并前都要确认；开 PR 前查 skills 注册表（[git-workflow.md](../conventions/git-workflow.md)）。
4. **文档体系**：八目录 + `adr/`、`lessons/`、`libraries.md`、`skills-registry.md`（[docs/README.md](../README.md)）。
5. **依赖纪律**：写进 AGENTS.md 的"依赖纪律"段。
6. **元规范**：写具体禁令、标明约束强度（[conventions/README.md](../conventions/README.md)）。

## 4. Phase 3：组件库对齐

### 4.0 结论（2026-10-31，负责人全部采纳）

负责人 2026-10-31 答复："确认，都采纳，都按照你最终分析的结果来，制定最终规范。"落实情况：

- ADR-0004 至 0020 状态改为 Accepted；ADR-0002 第 4 节的图片参数随 ADR-0011 生效。
- [libraries.md](../libraries.md) 合并为一张所有者总表，互斥禁令全部生效，新增"不需要单独安装的包"清单。
- 按 demo-init 4.2"未内置的栈"规则，联网核对官方文档后写了 9 份落地规范（[conventions/README.md](../conventions/README.md) 有清单），文档头部都标注"未经实战验证"。
- 为 11 个库建了 lessons 文件，预置核对时发现的坑。

拍板后核对官方文档时新发现、已写进规范的事项：

- Better Auth 的 Drizzle 适配器已由 `better-auth` 依赖并转出 `better-auth/adapters/drizzle`，不单独安装；`auth.api` 的服务端调用不受限流。
- Hono 挂到 Next 不需要 `@hono/vercel`，直接 `app.fetch(request)`。
- Nodemailer 10 自带类型，`@types/nodemailer` 会冲突（roadmap M3 原计划要装，已删除）。
- Vite 8 内置 `resolve.tsconfigPaths`，不需要 `vite-tsconfig-paths`；`server-only` 未安装，Vitest 里要用别名。
- Drizzle 官网默认展示 1.0 RC 写法，本项目 0.45.4 要按类型声明写（`casing` 选项、`migrate(db, { migrationsFolder })`）。
- React DayPicker 官网改用 `@daypicker/react` 包名（转发包），本项目仍装 `react-day-picker`。
- DeepSeek V4 默认开启思考模式，识别类调用要显式关闭；`deepseek-flash` 支持图像理解。
- "AI 草稿确认前不入库"与 routing.md 里 `checkins/{checkinId}/confirm` 的示例冲突：按 AGENTS.md 硬规则，草稿只存在前端，确认后走普通创建接口；routing.md 的示例已替换。

以下为拍板前的调研记录。

负责人确认了下面的功能盘点（头像用预设方案，见 [ADR-0021](../adr/0021-preset-avatars.md)），并委托 AI 系统性分析全部 17 个关注点。调研方法：

- npm registry 完整数据（版本、发布时间、12 个月发布次数、维护者、许可证、依赖、peer 依赖、安装脚本）
- GitHub 仓库活跃度（gh api）
- 在临时目录安装全部候选，扫描传递依赖的许可证和安装脚本
- 用 esbuild 按本项目实际会用到的导出组合实测 min+gzip 体积
- 抓取官方文档核对关键能力和限制

全部原始数据在 [data.json](../designs/library-showcase/data.json)，结论见 [对比页总览](../designs/library-showcase/index.html)。要点：

- **前端新增 7 个包**：Base UI（交互原语、Toast、表单）、react-day-picker、date-fns、@date-fns/tz、d3-shape、TanStack Query、zod。
- **明确不引入**：动效库、表单库、图表库、图片压缩库、Service Worker 工具库、任务队列、tailwind-merge。
- **服务端**：Better Auth、Drizzle + pg、Hono + @hono/zod-openapi、Nodemailer、Vitest。
- 调研中发现、已写进 ADR 和 libraries.md 禁令的坑：
  - vaul 已停止维护（Radix 方案缺抽屉的原因）；
  - react.dev 点名 react-hook-form 的 `watch` 与 React Compiler 不兼容；
  - Safari 不支持用 canvas 编码 WebP，图片改为 JPEG（取代 ADR-0002 第 4 节的参数）；
  - DeepSeek Files API 会在 DeepSeek 一侧存文件，禁止使用；
  - AI SDK 写字符串模型 id 时默认走 Vercel AI Gateway，必须用 provider 实例；
  - `import { z } from 'zod'` 实测 90.8 KB，`import * as z from 'zod'` 25.6 KB；
  - tailwind-merge 默认配置会把 `text-body text-muted` 合并成 `text-muted`；
  - Prisma 的 npm latest 标签指向 8.0 RC；postgres.js 4.0.0 是 2026-10-30 刚发布的大版本。

### 4.1 功能盘点（负责人 2026-10-31 确认）

| 板块 / 页面 | 需要的界面能力 | MVP |
|---|---|---|
| 通用 | 打卡入口（手机底部抽屉、桌面对话框）+ 板块宫格；确认对话框；toast；空状态、骨架屏、错误态；打卡成功盖章 | ✅ |
| 运动 | 运动品类选择（可搜索、可自定义 → 组合框）；时长输入；强度选择；热量估算展示 | ✅ 手动 |
| 饮食 | 拍照 / 相册选图 + 浏览器压缩；识别草稿卡（已有 `AiDraftCard`）；食物列表逐项调份量（步进 / 滑块）；餐次分段；热量与营养素环形 / 条形展示 | ✅ |
| 睡眠 | 入睡与起床时间（跨午夜的时间区间）；时长自动计算；质量评分 | ✅ 手动 |
| 学业 | 逐条记录列表（增删、勾选）；时长；科目标签 | ✅ |
| 自定义目标 | 字段编辑器（数字、文本、单选、多选、布尔、时长、评分、图片）+ 按 schema 渲染的动态表单 | ✅ 手动表单 |
| 每日指标 | 每板块满意度 1–5（已有 `Rating`）；体重输入（一位小数）；体重曲线 | ✅ |
| 待办 | 列表与勾选动画；DDL 日期时间选择；优先级 | ✅ |
| 主页仪表盘 | 卡片网格；进度环（已有）；连续天数；打卡日历 / 周热力图；体重曲线 | ✅ 固定布局 |
| 排行榜 | 排名列表、头像、领奖台、周 / 月切换（已有 `SegmentedControl`） | ✅ |
| 我的 | 菜单列表、开关（已有）；**头像选择** | ✅ |
| 后台 | 表格（用户、花费）、筛选、花费曲线、确认对话框 | ✅ 桌面端 |

**头像**：负责人确认用预设头像（团团的不同表情 × 板块配色，昵称首字兜底），不支持上传。见 [ADR-0021](../adr/0021-preset-avatars.md)。

### 4.1.1 现有组件与缺口

| 能力 | 现状 | 归属关注点 |
|---|---|---|
| 按钮、卡片、徽章、进度条 / 环 / 分段、输入框、开关、分段控件、评分、菜单列表、骨架屏、印章、头像、图标、团团 | ✅ 已有（`src/components/ui/`、`mascot/`） | — |
| Agent 回合、AI 草稿卡、额度条 | ✅ 已有（`src/features/agent/`） | — |
| 底部抽屉 / 居中弹层 | 🔶 已有 `Sheet`（原生 `<dialog>`，只有进场动画，没有拖拽关闭） | 1 交互原语 |
| 确认对话框、下拉菜单、Popover | ⬜ | 1 交互原语 |
| 下拉选择、可搜索组合框（运动品类）、多选（自定义字段、科目标签） | ⬜ | 1 交互原语 |
| 滑块（份量）、数字步进器（体重、时长） | ⬜ | 1 交互原语（步进器可能自研） |
| 列表进出场、勾选、打卡庆祝、团团动画 | 🔶 CSS 预设已有 | 2 动效 |
| 提示消息 | ⬜ | 3 提示消息 |
| 日期选择、时间选择、跨午夜时间区间（睡眠）、DDL 日期时间 | ⬜ | 4 日期与时间选择器 |
| 打卡日归属、周一重置、时长计算 | ⬜ | 5 日期与时区计算 |
| 表单校验与错误展示、自定义字段编辑器、按 schema 渲染表单 | 🔶 已有 `Field` 外观，无表单状态 | 6 表单与动态表单 |
| 体重曲线、打卡日历 / 周热力图、营养素环 / 条 | ⬜ | 7 图表 |
| 拍照 / 选图、压缩、上传进度 | ⬜ | 8 图片压缩 |
| 后台数据表格（排序、分页） | ⬜ | 并入 1 或单独评估（桌面端，优先级低） |
| 空状态、错误态 | ⬜ | 自研（基于团团与现有组件，不选型） |

### 4.2 关注点分组（编号对应 libraries.md）

| 组 | 关注点 | 先要回答的"层"问题 |
|---|---|---|
| **A 基础组件库** | 1 交互原语（弹层、抽屉、下拉、组合框、滑块、焦点管理） | 继续自研 + 原生 `<dialog>` / Popover API，还是无样式原语（Base UI / Radix / React Aria）+ 自有样式，还是带样式全家桶（shadcn/ui / HeroUI）？底部抽屉要不要手势拖拽关闭？ |
| | 2 动效 | 只做组件微交互和打卡庆祝（不是滚动叙事）。CSS 预设够不够？团团的动画要不要上 Rive？ |
| | 3 提示消息 | 自研还是 sonner 一类 |
| **B 板块专用** | 4 日期与时间选择器 | 原生 `<input type="date/time">`、自研，还是库？跨午夜的睡眠区间怎么选？ |
| | 5 日期与时区计算 | 原生 `Intl` / Temporal、date-fns + tz、Day.js |
| | 6 表单与动态表单 | 原生 FormData + zod、react-hook-form、TanStack Form；动态表单按 schema 渲染 |
| | 7 图表 | 体重曲线、热力图、营养素环：自研 SVG 还是轻量图表库 |
| | 8 浏览器端图片压缩 | 原生 canvas / `createImageBitmap`，还是 browser-image-compression |
| **C 业务基础设施** | 9–17 | 正式搭建业务前处理（数据请求、校验、鉴权、数据访问、接口层、发信、测试、PWA、定时任务） |

### 4.3 每个关注点的做法

1. 先回答"层"的问题。
2. 联网核实 2–4 个候选的七项硬指标：最近发版、维护者数量、gzip 体积与传递依赖数、有无安装脚本、许可证与依赖树里的 copyleft、与本项目技术栈（React 19.3、Next 16.4、Tailwind 4、Cache Components）的兼容性、文档与 TS 支持。查不到的标"未核实"。
3. 生成对比页 `docs/designs/library-showcase/<concern>.html`：每条数据都对应本次会话抓到的官方内容或 registry 数据，底部有决策历史区。"自研"也作为一个候选，展示现有 Playbook 组件的实际情况。
4. 负责人拍板 → 写 ADR → 更新 libraries.md → 建 lessons 文件 → 需要封装的库建封装层入口。
5. 每组看一次对比页、拍一次板：A 组 3 个关注点放在同一轮。

## 5. Phase 4：落盘状态

| 项 | 状态 |
|---|---|
| nextjs 规则包 | ✅ 已加载并按自托管改写；edgeone、supabase 不加载 |
| AGENTS.md | ✅ 按新模板补"仓库即记忆""依赖纪律""自进化机制"，文档索引改为"触发条件 → 必读文档"，160 行 |
| `docs/adr/` | ✅ 迁入 ADR-0001、0002（编号不变），新建 0003 |
| `docs/lessons/` | ✅ README + nextjs、pnpm、windows-powershell、aliyun-ecs 四个文件（记录了本项目已踩过的坑） |
| `docs/libraries.md` | ✅ 定稿：所有者总表（基础 10 项 + 前端 10 项 + 服务端与平台 12 项）、不需要单独安装的包、互斥禁令全部生效 |
| `docs/designs/library-showcase/` | ✅ 总览 + 17 个对比页 + data.json；生成脚本 `scripts/dev/library-showcase/build.mjs` |
| `docs/adr/` 0004–0021 | ✅ 全部 Accepted |
| 落地规范（4.2 未内置的栈） | ✅ 9 份：api-conventions、database、auth、ai-and-quota、time-and-dates、client-data-and-forms、ui-primitives、testing、pwa |
| `docs/skills-registry.md` | 🔶 采用默认绑定 + 本项目在用的 skill，**绑定方案待负责人确认** |
| lessons 文件（每个选定的库一个） | ✅ 11 个，预置已核实的坑；d3-shape 用到时再建 |
| 封装层骨架 | ⬜ 随依赖安装一起做（M1 前端、M3 服务端，见 roadmap.md），不先建空目录 |
| 交接说明 | ⬜ 批量结算提交后写 |

## 6. 与 skill 默认值的偏差

| 偏差 | 原因 |
|---|---|
| ADR 编号：项目范围是 0003，不是 0001 | 0001、0002 早于新版流程产生，已被已合并的 PR 和代码注释引用；ADR 只增不改，不重排编号 |
| Git 从 `dev` 切出，不是 `main` | 负责人既有约定（Phase 1 第 6 维度：已有约定以用户为准） |
| 调试区用 `src/app/dev/`，不是 `_dev/` | `_dev` 是 Next 私有文件夹，不生成路由（lessons/nextjs.md） |
| 部署平台没有内置规则包 | 阿里云 ECS 部署已实测通过，文档写在 deploy-aliyun-ecs.md，不标"未经实战验证" |
| PR #1–#3 由 AI 直接合并 | 违反了"Push / 创建 PR 先确认"。之后按 AGENTS.md 执行，不再发生 |

## 7. 本次会话的未提交改动（批量结算清单）

按新版规则，以下改动目前都是未提交 diff，等整个流程走完（或负责人要求）时一次性确认后再提交：

- 新建：`docs/adr/README.md`、`docs/adr/0003-project-scope.md`、`docs/libraries.md`、`docs/skills-registry.md`、`docs/lessons/`（5 个文件）、本文件
- 新建（Phase 3）：`docs/adr/0004`–`0021`（18 份）、`docs/designs/library-showcase/`（19 个文件）、`scripts/dev/library-showcase/`（3 个文件）、`docs/plans/roadmap.md`；`.prettierignore` 加一行排除生成的对比页
- 修改（Phase 3）：`docs/adr/0002` 头部加"部分取代"注记
- 新建（拍板后）：`docs/conventions/` 下 9 份落地规范；`docs/lessons/` 下 11 个库文件
- 修改（拍板后）：ADR-0004 至 0020 状态、ADR 索引、ADR-0002 注记；libraries.md 定稿；roadmap.md 定稿；`conventions/README.md`、`project-structure.md`、`code-review.md`、`code-style.md`、`nextjs-16-patterns.md`；`routing.md`（第 6 节两处）、`ui-design-system.md`（第 5 节末段、第 13 节四行，改为已拍板的结论）；`lessons/README.md`；AGENTS.md（Tech Stack、规则与文档索引）；`.env.example` 与 `scripts/setup/provision-server.sh`（加 `BETTER_AUTH_TELEMETRY=0`，去掉 `DEEPSEEK_MODEL`）
- 迁移：`docs/designs/adr-000{1,2}-*.md` → `docs/adr/000{1,2}-*.md`（只补元数据、修链接、追加"何时重审"）
- 修改：AGENTS.md、`docs/README.md`、`docs/designs/README.md`、`docs/conventions/README.md`、`project-structure.md`、`code-review.md`、`git-workflow.md`、`architecture-baseline.md`（改为快照）、`ui-design-system.md`（第 13 节加一行指向 libraries.md）
- 工作区里另有其他会话未提交的设计系统改动（Playbook、原子组件、Agent 组件、团团、批注工具等）。本次只在 AGENTS.md、project-structure.md、code-review.md、ui-design-system.md 上做了增补，没有回退或改写它们的内容。
