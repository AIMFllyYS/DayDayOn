# DayDayOn v0.1 产品需求（PRD）

> 创建：2026-11-01 · 更新：2026-11-01 · 状态：approved（负责人 2026-11-01 确认补卡规则、主页动态，并授权无人值守落地）
> 范围以 [ADR-0003](../adr/0003-project-scope.md) 为准；视觉与交互以 `/dev/playbook`（含"页面预览"）为准；技术做法以 [docs/conventions/](../conventions/README.md) 为准。
> **第 7 节审查决议优先于第 0–6 节。** 本文与规范冲突时以规范为准，并在同一次改动里修正本文。实施拆分见 [plan-mvp-build.md](../plans/plan-mvp-build.md)。

## 背景

DayDayOn 是负责人和朋友（华科同学为主）互相督促的多人打卡 PWA。ADR-0003 定了 5 项 MVP，架构基线第 8 节列了必须在 PRD 里写清的边界条件，Playbook 已经有六个页面原型（登录、主页、打卡、待办、排行、我的）和应用外壳。本文把这些合成一份可以直接拆给多个 Agent 实现的需求。

## 目标

跑通"登录 → 引导 → 定目标 → 打卡 → 看进度 → 和朋友比"的闭环，并把 AI 花钱前必须有的额度、风控、后台一次带齐。

验收标准（全部满足才算 v0.1 功能完成）：

1. 白名单邮箱收验证码登录；新用户走完引导后进入主页。
2. 五个板块都能建目标、手动打卡；饮食能拍照识别成草稿，确认后入库。
3. 主页显示今日完成度、连续天数、各目标进度、体重、心情、本周热力图、榜单动态。
4. 排行榜按本周 / 本月显示公开用户；待办能增删改、勾选、看 DDL。
5. 后台能看花费、暂停 AI、封号、调额度、生成兑换码、改全站配置。
6. `pnpm check`、`pnpm test`、`pnpm build` 通过；关键页面在 390px 和 1280px 下实际走通。

## 0. 术语与全局规则

| 术语 | 含义 |
|---|---|
| 板块 module | `exercise` 运动 · `diet` 饮食 · `sleep` 睡眠 · `study` 学习 · `custom` 自定义 |
| 目标 goal | 用户在某个板块下的一项计划，带每日目标量 |
| 打卡 checkin | 对某个目标的一次记录 |
| 打卡日 localDate | 按用户时区和"日切换时间"算出的日期（`src/lib/time/localDateOf`） |
| 业务周期 | 额度周、排行周 / 月、全站日上限，一律按北京时间（time-and-dates.md 第 2 节） |
| 微元 | 金额单位，1 元 = 1,000,000 微元 |

- 所有接口单位遵守 api-conventions.md 第 5 节：时长秒、体重克、热量千卡、金额微元，界面层才换算。
- 所有 POST 创建类请求带 `idempotency-key`。
- 未登录访问 `(app)` 页面跳 `/login`；已登录但没完成引导跳 `/onboarding`；接口返回 403 `ONBOARDING_REQUIRED`（`/me`、`/me/onboarding`、`/me/profile` 读取除外）。
- 文案语气按 ui-design-system.md 第 11 节；错误文案只来自 `src/lib/api/error-messages.ts`。

## 1. 用户旅程

1. 打开站点 → `/login` 输入邮箱 → 收 6 位验证码 → 登录（新邮箱自动注册）。
2. 首次登录 → `/onboarding` 五步：昵称 → 预设头像 → 基础资料 → 选择想打卡的板块（自动建默认目标）→ 是否上榜 + 健康数据单独同意 → 完成，本周 AI 额度补到 10 元。
3. 主页看今天 → 点"＋"（手机底栏中间 / 桌面侧栏顶部）→ 打卡弹层列出今天的目标和状态 → 选一项进入 `/goals/[goalId]/checkin` → 提交 → 盖章 + 团团欢呼。
4. 饮食打卡选"拍照识别" → 拍照 / 选图 → 浏览器压缩 → 识别中 → AI 草稿卡 → 逐项改份量和热量 → 确认记录。
5. 待办页记事、勾选；排行页看本周 / 本月；我的页改外观、偏好、兑换额度、导出数据、注销、退出。
6. 管理员在 `/admin`（桌面）看花费和异常，处理封号、额度、兑换码、配置。
## 2. 功能模块

### 2.1 登录（auth）

- 邮箱白名单 11 个域名、规范化规则、限流阈值全部按 ADR-0002 第 3、6 节与 auth.md 第 3、4 节。
- 验证码 6 位、5 分钟有效、错 5 次作废。发送后按钮 60 秒倒计时。
- 开发环境（`NODE_ENV !== 'production'`）且没有配置 `SMTP_USER` 时，`src/server/mail/` 把验证码打印到服务端控制台，方便本地登录；生产环境永不打印。
- 新注册时记录注册 IP；每次登录更新最近登录 IP（只取 `x-real-ip`）。
- 被封号的用户登录时提示"账号已被停用"，带原因和到期时间。
- 页面：`/login`，原型 `LoginScreen`；验证码输入用 `OTPField`。

### 2.2 新人引导（onboarding）

| 步骤 | 内容 | 规则 |
|---|---|---|
| 1 昵称 | 1–12 个字符 | 去首尾空白；禁止控制字符和换行；可重名 |
| 2 头像 | 预设头像 | 形象（团团 / 墩墩）× 表情 × 板块色，存为 `mascot:<character>:<mood>:<tone>`（ADR-0021）；可跳过，跳过显示昵称首字 |
| 3 基础资料 | 性别、出生年份、身高、当前体重、时区 | 全部可选；时区默认 `Asia/Shanghai`；填了体重就同时写一条体重记录 |
| 4 板块 | 多选五个板块 | 每选一个建一个默认目标（见 2.3 默认值）；至少选一个 |
| 5 隐私 | 是否加入排行榜（默认否）；健康数据单独同意（必选，附 `/privacy` 链接） | 不同意健康数据处理就不能完成引导 |

- 完成时一次 `POST /me/onboarding`，服务端在一个事务里写资料、建目标、写体重、把本周额度补到 10 元、记 `onboardedAt`。
- 已完成引导再提交返回 409 `ALREADY_ONBOARDED`。

### 2.3 目标（goal）

- 字段：板块、标题（1–20 字）、说明（≤ 100 字，可空）、每日目标量、计划星期（ISO 1–7，默认每天）、计划时间（`HH:mm`，可空，只用于显示）、状态（active / archived）、排序。
- 每日目标量 `target = { kind: 'duration' | 'count', value }`：

| 板块 | 默认标题 | 默认目标量 | 进度怎么累计 |
|---|---|---|---|
| 运动 | 动一动 | 时长 1800 秒 | 累加 `durationSeconds` |
| 饮食 | 好好吃饭 | 3 次 | 每餐 1 次 |
| 睡眠 | 早点睡 | 时长 28800 秒 | 当天那次睡眠的时长 |
| 学习 | 学一点 | 2 次 | 每条记录 1 次 |
| 自定义 | 我的小目标 | 1 次 | 每条记录 1 次 |

- 自定义目标带字段定义（动态表单），字段类型固定清单：数字（单位、最小、最大）、文本、单选、多选、布尔、时长、评分。没有图片类型（图片不落盘）。最多 10 个字段。
- 改了字段定义就生成新版本（`goal_field_versions`），打卡记录存当时的版本号，历史按当时版本展示。
- 每人最多 20 个进行中的目标（409 `GOAL_LIMIT_REACHED`）；睡眠目标最多 1 个进行中。
- 归档后不出现在今天和打卡弹层里，历史保留，可以恢复；删除目标要二次确认，连同打卡记录一起删除。
- 页面：`/goals` 列表（进行中 / 已归档），`/goals/new` 新建（先选板块），`/goals/[goalId]` 详情（打卡日历 + 历史列表 + 编辑抽屉 + 归档 / 删除）。

### 2.4 打卡（checkin）

- 入口：底栏"＋" / 侧栏"打卡"打开 `CheckinSheet`（原型 `checkin-sheet.tsx`）：今天计划内的目标逐行显示状态，另有"体重""今日心情"两行快捷记录（在同一个弹层里切换内容，不再开第二层弹层），底部"拍照记一餐"直达饮食目标的拍照识别。
- 打卡页 `/goals/[goalId]/checkin`（原型 `CheckinScreen`）：顶部目标信息和今天进度；各板块表单如下；底部可选"这一项今天满意吗"评分；"补昨天"开关（见第 3 节）；提交成功显示盖章 + 团团欢呼 + 今天进度。

| 板块 | 表单 | 校验 |
|---|---|---|
| 运动 | 品类（组合框：跑步、快走、骑行、游泳、跳绳、球类、力量、瑜伽、舞蹈、其他，可新建）、时长（分钟）、强度（轻松 / 适中 / 吃力） | 时长 1–600 分钟 |
| 饮食 | 方式（拍照识别 / 手动填写）、餐次（早 / 午 / 晚 / 加餐）、食物条目（名称、份量说明、热量） | 1–20 条；单条热量 0–5000 千卡；手动填写时热量可空 |
| 睡眠 | 入睡时间、起床时间（`TimeRangeField`，跨午夜显示"次日"并实时算时长）、睡眠质量 1–5 | 时长 30 分钟–20 小时；入睡等于起床视为错误 |
| 学习 | 学了什么（≤ 60 字）、时长（可选） | — |
| 自定义 | `SchemaForm` 按字段定义渲染 | 由 `buildSchema(fields)` 生成的 zod schema |

- 运动消耗由代码估算：`MET × 体重(kg) × 时长(h)`，MET 按品类和强度查表；没有体重记录时不估算。界面标注"估算结果，非医疗建议"。
- 打卡可以删除（二次确认），v0.1 不支持修改：删掉重记。
- 页面上的打卡日历：`Calendar`，已打卡的日子用板块色标记，补卡日用描边样式区分。

### 2.5 每日指标（metric）

- 体重：千克一位小数输入（`NumberField`），存克。每个打卡日一条，再记就覆盖。和上一条相差超过 3 千克时，服务端返回 409 `WEIGHT_CHANGE_UNCONFIRMED`，界面问"和上次差了 X kg，确认没输错吗？"，确认后带 `confirmLargeChange: true` 重提。
- 体重永远不公开、不参与排行。主页卡片显示今天（或最近一次）体重、和 7 天前的差值、30 天走势小图（`Sparkline`）。
- 满意度：每天一个"今日心情"（overall）和每个板块各一个，1–5 分（`Rating`，很糟 → 屏幕轻震、一般 → 波纹、不错 / 超棒 → 撒花，按 2026-11-01 批注）。同一天再评就覆盖。只能评今天。
### 2.6 饮食拍照识别（agent）

- 流程按 ai-and-quota.md 第 3、5、6 节：`ImagePicker`（拍照 / 相册，`capture="environment"`）→ `src/lib/image/compress.ts` 压成 JPEG → `POST /ai/diet-recognitions`（multipart，字段 `image`，可附 `mealType`、`note`）→ 返回草稿 → `AiDraftCard` 展示，逐项改名称、份量、热量，可删可加 → "确认记录"调普通创建打卡接口（`source: 'ai'`、`aiRunId`）。
- 草稿结构：`items[{ name, portion, kcalLow, kcalHigh, proteinGrams?, fatGrams?, carbGrams? }]`、`totalKcalLow/High`、`confidence 0–1`、`summary`（一句话解析文本，入库时存进打卡的 `parsedText`）。入库时每项热量取区间中值，用户改过的以用户为准。
- prompt：`src/server/ai/prompts/diet-recognition.ts`，`thinking: disabled`，`maxOutputTokens: 800`，中文输出。
- 降级：校验失败、超时（30 秒）、`confidence < 0.6` 都在卡片上提示，并给"手动填写"按钮；已产生的费用照常结算。
- 识别中显示 `AgentTurn` 活动条（"正在看照片"），默认展开推理链、完成后自动折叠（2026-11-01 批注）。
- 用户放弃草稿什么也不写。图片任何时候都不落盘、不进日志、不展示原图（"1 张照片 · 识别后不保存"）。

### 2.7 AI 额度与兑换码（quota）

- 账本、计价、预占 / 结算 / 释放、周期键、全站日上限全部按 ADR-0002 第 5 节和 ai-and-quota.md。
- 新账号本周 2 元，完成引导补到 10 元；之后每周一 00:00（北京时间）重置为 10 元，不累积。
- 兑换码：管理员批量生成（1–100 个），码形如 `DDON-XXXX-XXXX-XXXX`（去掉易混字符），只显示一次，库里只存 SHA-256；一次性，面值 10 元，加到长期有效的加购余额。兑换限流按 ADR-0002 第 6 节。
- 我的页：`QuotaMeter` 显示本周剩余 + 加购余额；"兑换额度"抽屉输入兑换码；"使用记录"列最近 20 次 AI 调用（用途、时间、花费）。

### 2.8 主页仪表盘（dashboard）

固定布局（原型 `HomeScreen`），一次 `GET /dashboard/today` 取齐：

1. 今日总览贴纸卡：今日完成度环（完成的目标数 / 今天计划的目标数）、连续天数、今天的日期印章。
2. 今日进度：每个今天计划内的目标一行（图标、标题、进度条、`32 / 30 分钟` 这类文字），点击进入打卡页。
3. 体重卡、今日心情卡（没记录时显示"记一下"，点开打卡弹层的对应行）。
4. 本周热力图 `WeekHeatmap`：周一到周日 × 五个板块，格子深浅表示完成度。
5. 榜单动态（负责人 2026-11-01 决定，替代原型里的"朋友动态"）：只展示已上榜用户最近 24 小时的打卡事件，只含昵称、头像、板块和时间（"阿柚 · 完成了运动 · 07:42"），不含任何数值和备注；最多 10 条；不做点赞评论。自己没上榜时不出现在别人的动态里。
- 没有任何目标时显示团团空状态和"去设定目标"按钮。

### 2.9 排行榜（rank）

- 范围：本周（ISO 周）/ 本月（自然月），北京时间。`/rank?range=week|month`，非法值回落到 week。
- 只包含 `leaderboardOptIn = true` 且未被封的用户。
- 计分：打卡天数 = 范围内有至少一次**非补卡**打卡的打卡日数。并列时按连续天数降序，再按最后一次打卡时间升序（先到先得）。
- 显示：前三名领奖台、其余列表（最多 50 名）、"我"固定在底部（我未上榜时显示"你还没加入排行榜"和开关入口）、"再打卡 N 天追上前一名"。
- 只显示昵称、头像、打卡天数、连续天数。体重、饮食、睡眠的数值一律不出现。

### 2.10 待办（todo）

- 字段：标题（1–60 字）、DDL（`datetime-local`，可空，存时刻）、优先级（普通 / 重要）、完成时间。
- 列表：进行中按 DDL 升序（无 DDL 的排后）、已完成按完成时间降序只显示最近 30 天；DDL 在 24 小时内显示"快到期"，已过期显示"已过期"。
- 勾选、取消勾选、新建、编辑（抽屉）、删除（可撤销的 Toast，5 秒内撤销）。勾选用乐观更新。
- 每人最多 500 条未完成待办。`?view=log` 显示时间日志占位（v0.2）。

### 2.11 我的（me）

- 原型 `MeScreen`：互动版团团 + 昵称 + 连续天数 + 是否上榜；额度卡；外观（主题色 5 选 1、陪伴形象团团 / 墩墩）；偏好（加入排行榜、日切换时间 0–6 点、打卡提醒时间仅作应用内提示）；个人资料入口；账号（使用记录、兑换额度、导出数据、注销账号、退出登录）。
- 主题色、陪伴形象存到用户偏好（`profiles.theme`、`profiles.mascot`），根布局按偏好提前写 `data-theme`，未登录时用 localStorage（`src/lib/theme.ts` 已有）。
- `/me/profile`：昵称、头像、性别、出生年份、身高、时区。
- 导出数据：`GET /me/export` 返回 JSON 附件（资料、目标、打卡、体重、满意度、待办），不含其他用户数据。
- 注销账号：输入"注销"二字确认 → 删除用户及全部业务数据（级联），`ai_runs` 与 `quota_ledger` 把用户外键置空保留金额（账本只增不删），兑换码使用记录同理。
- `/privacy` 隐私说明页（静态）：收集哪些数据、健康数据用途、图片不保存、如何导出与注销。

### 2.12 后台（admin）

- 入口 `/admin`，桌面优先；权限、两步验证、封号按 ADR-0002 第 7 节与 auth.md 第 6 节。
- `/admin`：今日全站花费 / 上限、全站 AI 开关（暂停 / 恢复）、近 30 天每日花费曲线（`LineChart`）、异常列表（单人单日 > 5 元、每小时 > 60 次、同 IP > 3 账号、兑换失败过多）。
- `/admin/users`：表格（昵称、邮箱、注册时间、注册 IP、同 IP 账号数、本周花费、调用次数、状态），偏移分页，按邮箱搜索；操作：封号（原因、到期时间可空）、解封、调整额度（加购余额 ± 金额 + 原因，写流水）。
- `/admin/codes`：批量生成、列表（前缀、状态、使用者、使用时间）、作废未使用的码。
- `/admin/settings`：全站日上限、每周额度、新账号首周额度、各项限流阈值，存 `app_settings`。
- 每个管理员操作写 `admin_audit_logs`（谁、做了什么、对象、时间），只增不删。
- 阈值告警邮件按"每天每种一次"去重。
## 3. 边界条件（架构基线第 8 节）

| 问题 | 规则 |
|---|---|
| 打卡日归属 | 服务端用 `localDateOf(occurredAt, profile.timeZone, profile.dayStartHour)` 算，不信任客户端；默认 4 点换日 |
| 睡眠归属 | 记到起床时刻所在的打卡日 |
| 跨时区出行 | 按资料里的时区算；改时区只影响之后的打卡，历史的 `localDate` 不重算 |
| 补卡 | 只能补"昨天"（今天的打卡日减一天），在打卡页打开"补昨天"开关；补卡记 `isMakeup = true`，`occurredAt` 取昨天的打卡日中午（用户时区），睡眠用表单里的实际时刻 |
| 连续天数 | 从今天（今天还没打卡就从昨天）往回数，连续有任意打卡（含补卡）的打卡日数；断一天归零 |
| 排行计分 | 只数非补卡打卡日；同一天多次打卡只算一天 |
| 频次 | `count` 类目标：当天记录数 ≥ 目标值算完成；`duration` 类：当天时长合计 ≥ 目标值；睡眠：当天那条的时长 ≥ 目标值 |
| 一天一次 | 睡眠目标每个打卡日最多一条（409 `CHECKIN_EXISTS`），饮食每个餐次可以多条 |
| 计划日 | 不在计划星期里的日子也能打卡，计入进度，但不计入当天的"计划目标数" |
| 目标修改 | 改目标量只影响之后的进度计算；改自定义字段生成新版本 |
| AI 异常 | 失败、超时、低置信度都降级为手动；AI 结果用户可改 |
| 体重异常值 | 与上一条相差 > 3kg 需要确认；单次范围 20–300kg |
| 隐私 | 体重、饮食、睡眠属敏感个人信息：引导里单独同意；默认不上榜；体重永不公开；提供导出与注销 |
| 图片 | 不存储；接口 4MB 上限；只收 JPEG；HEIC 在浏览器端解码失败时提示换图 |
| 幂等与并发 | 创建打卡、AI 识别、兑换都带幂等键；按钮提交中禁用 |
| 注销 | 级联删除业务数据；上榜数据随之消失；账本类记录去关联后保留 |
| 内容安全 | 昵称是唯一公开的用户文本：限制长度和字符，后台可封号；头像只用预设 |
| 被封用户 | 会话吊销；接口 403；从榜单和动态里消失 |

## 4. 数据模型

表名、列类型、命名遵守 database.md。业务表都有 `id`（uuidv7）、`createdAt`、`updatedAt`，用户外键 `onDelete: cascade`（另有说明的除外）。

| 表 | 关键列 |
|---|---|
| Better Auth：`user`、`session`、`account`、`verification`、`two_factor` | CLI 生成；`user` 带 admin 插件的 `role`、`banned`、`banReason`、`banExpires` |
| `profiles` | `userId`（唯一）、`nickname`、`avatar`（预设标识，可空）、`gender`（可空）、`birthYear`（可空）、`heightCm`（可空）、`timeZone`、`dayStartHour`、`leaderboardOptIn`、`healthConsentAt`、`onboardedAt`（可空）、`theme`、`mascot`、`remindAt`（可空）、`signupIp`、`lastLoginIp` |
| `goals` | `userId`、`module`、`title`、`description`、`targetKind`、`targetValue`、`weekdays`（int[]）、`plannedTime`、`status`、`sortOrder`、`fieldVersion`（自定义） |
| `goal_field_versions` | `goalId`、`version`、`fields`（jsonb），唯一 `(goalId, version)` |
| `checkins` | `userId`、`goalId`、`module`、`localDate`、`occurredAt`、`source`（manual / ai）、`isMakeup`、`durationSeconds`（可空）、`count`、`intakeKcal`（可空）、`burnKcal`（可空）、`note`、`parsedText`（可空）、`payload`（jsonb，按板块 schema）、`fieldVersion`（可空）、`aiRunId`（可空）、`rating`（可空）；索引 `(userId, localDate)`、`(goalId, localDate)` |
| `body_metrics` | `userId`、`localDate`、`weightGrams`、`measuredAt`；唯一 `(userId, localDate)` |
| `daily_ratings` | `userId`、`localDate`、`scope`（overall 或板块）、`value`；唯一 `(userId, localDate, scope)` |
| `todos` | `userId`、`title`、`dueAt`（可空）、`priority`、`doneAt`（可空） |
| `quota_accounts` | `userId`（唯一）、`periodKey`、`weeklyLimitMicros`、`weeklyUsedMicros`、`bonusMicros`、`reservedMicros` |
| `quota_ledger` | `userId`（`set null`）、`kind`（reserve / settle / release / reset / redeem / adjust / grant）、`amountMicros`、`bucket`（weekly / bonus）、`aiRunId`、`idempotencyKey`、`note`；只增 |
| `ai_runs` | `userId`（`set null`）、`ip`、`purpose`、`promptVersion`、`status`、`inputMissTokens`、`inputHitTokens`、`outputTokens`、`costMicros`、`reservedMicros`、`durationMs`、`dayKey`；只增 |
| `ai_daily_spend` | `dayKey`（主键）、`spentMicros`、`alertedAt` |
| `redeem_codes` | `codeHash`（唯一）、`prefix`、`valueMicros`、`status`、`createdBy`、`redeemedBy`（`set null`）、`redeemedAt` |
| `app_settings` | `key`（主键）、`value`（jsonb）：`dailySpendCapMicros`、`weeklyQuotaMicros`、`newUserQuotaMicros`、`aiPaused`、限流阈值 |
| `rate_limit_counters` | `key`（主键）、`count`、`expiresAt` |
| `idempotency_keys` | `userId`、`key`、`requestHash`、`status`、`responseStatus`、`responseBody`（jsonb）、`expiresAt`；唯一 `(userId, key)` |
| `admin_audit_logs` | `adminId`（`set null`）、`action`、`targetType`、`targetId`、`detail`（jsonb）；只增 |
| `alerts_sent` | `kind`、`dayKey`；唯一 `(kind, dayKey)` |

## 5. 接口清单（/api/v1）

全部用 `createRoute` 定义并出现在 OpenAPI 里；默认 `requireUser`，并要求已完成引导（另有说明的除外）。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/me` | 当前用户：资料、是否完成引导、偏好、角色（不要求已引导） |
| POST | `/me/onboarding` | 完成引导（不要求已引导） |
| PATCH | `/me/profile` | 改资料 |
| PATCH | `/me/preferences` | 主题、形象、上榜、日切换时间、提醒时间 |
| GET | `/me/quota` | 本周额度、加购余额、预占、周期结束时间 |
| GET | `/me/ai-runs` | 最近 20 次 AI 调用 |
| GET | `/me/export` | 导出 JSON |
| DELETE | `/me` | 注销（请求体 `{ confirm: '注销' }`） |
| GET / POST | `/goals` | 列表（`?status=active\|archived`）/ 新建 |
| GET / PATCH / DELETE | `/goals/{goalId}` | 详情 / 修改（含归档、恢复、自定义字段）/ 删除 |
| GET / POST | `/goals/{goalId}/checkins` | 历史（游标分页，`?from&to`）/ 创建 |
| DELETE | `/checkins/{checkinId}` | 删除打卡 |
| GET | `/goals/{goalId}/calendar?month=YYYY-MM` | 这个月每天的打卡情况 |
| GET | `/checkins/today` | 打卡弹层用：今天各目标状态 + 体重、心情是否已记 |
| PUT | `/metrics/weight` | 记体重（`{ weightGrams, confirmLargeChange? }`） |
| GET | `/metrics/weight?days=30` | 体重走势 |
| PUT | `/ratings` | 记满意度（`{ scope, value }`，只能今天） |
| GET | `/dashboard/today` | 主页全部数据 |
| GET | `/rank?range=week\|month` | 排行榜 + 我的位置 |
| GET | `/rank/feed` | 榜单动态 |
| GET / POST | `/todos` | 列表（`?status=open\|done`）/ 新建 |
| PATCH / DELETE | `/todos/{todoId}` | 修改（含勾选）/ 删除 |
| POST | `/ai/diet-recognitions` | 饮食拍照识别（multipart，带幂等键） |
| POST | `/redeem-codes/redeem` | 兑换 |
| GET | `/admin/overview` | 今日花费、开关、30 天曲线、异常 |
| POST | `/admin/ai/pause`、`/admin/ai/resume` | 暂停 / 恢复全站 AI |
| GET | `/admin/users` | 用户表（偏移分页，`?q=`） |
| POST | `/admin/users/{userId}/ban`、`/unban`、`/quota-adjustments` | 封号 / 解封 / 调额度 |
| GET / POST | `/admin/redeem-codes` | 列表 / 批量生成（响应里一次性返回明文码） |
| POST | `/admin/redeem-codes/{codeId}/void` | 作废 |
| GET / PUT | `/admin/settings` | 全站配置 |

`/admin/*` 挂 `requireAdmin`。新增错误码：`ONBOARDING_REQUIRED`、`ALREADY_ONBOARDED`、`GOAL_NOT_FOUND`、`GOAL_LIMIT_REACHED`、`CHECKIN_NOT_FOUND`、`CHECKIN_EXISTS`、`MAKEUP_NOT_ALLOWED`、`WEIGHT_CHANGE_UNCONFIRMED`、`TODO_NOT_FOUND`、`TODO_LIMIT_REACHED`、`REDEEM_CODE_INVALID`、`REDEEM_CODE_USED`、`REDEEM_LOCKED`、`AI_RECOGNITION_FAILED`、`USER_NOT_FOUND`，加上 api-conventions.md 第 6 节已有的。

## 6. 页面

| 路径 | 页面 | 原型 / 主要组件 |
|---|---|---|
| `/login` | 登录 | `LoginScreen`、`OTPField` |
| `/onboarding` | 新人引导（五步，`StepProgress` 显示进度） | 新做；团团陪伴 |
| `/` | 主页 | `HomeScreen`、`WeekHeatmap`、`Sparkline` |
| `/todo` | 待办 | `TodoScreen` |
| `/rank` | 排行 | `RankScreen` |
| `/me`、`/me/profile` | 我的、个人资料 | `MeScreen`、`InteractivePet` |
| `/goals`、`/goals/new`、`/goals/[goalId]` | 目标列表、新建、详情 | `Calendar`、`SchemaForm`、字段编辑器 |
| `/goals/[goalId]/checkin` | 打卡 | `CheckinScreen`、五个板块表单、`AiDraftCard`、`ImagePicker` |
| `/privacy` | 隐私说明 | 静态 |
| `/admin`、`/admin/users`、`/admin/codes`、`/admin/settings` | 后台 | 自研简单表格、`LineChart` |

- 应用外壳 `(app)/layout.tsx` 按 Playbook 的 `AppShell`：手机顶栏 + 底部悬浮导航（"＋"在底栏内），≥ 768px 侧栏。滚动条全部隐藏（2026-11-01 批注）。
- 每个页面有加载骨架（`Skeleton`）、空状态（团团 + 文案）、错误态（原因 + 重试）。

## 风险

| 风险 | 应对 |
|---|---|
| 规范条目是联网调研写的，未经实战（Better Auth、Hono、Drizzle 写法） | 实施时以 `node_modules` 里的类型和文档为准；踩坑就记 lessons |
| 多个 Agent 并行改同一个文件（schema 汇总、错误码表、路由挂载） | 由基础设施阶段一次建好"注册点"，领域模块只新增自己的文件；见 plan-mvp-build.md 第 2 节 |
| 本地没有 SMTP / DeepSeek 密钥，无法真机验收发信和识别 | 开发环境验证码打印到控制台；识别接口在没有 `DEEPSEEK_API_KEY` 时返回 503 `AI_PAUSED`，测试用 `MockLanguageModelV4` |
| 健康数据合规 | 单独同意、默认不公开、导出与注销在 v0.1 就提供 |
| 额度盗刷 | 预占上限、全站日上限、限流、后台一键暂停，四层叠加 |


## 7. 审查决议（2026-11-01，优先于第 0–6 节）

三路审查（规范冲突、完整性、并行可实施性）后的定稿规则。与前文冲突时以本节为准。

### 7.1 账号与引导

- **profile 行在注册时建**：P1 在 Better Auth `databaseHooks.user.create.after` 里建 `profiles`（`signupIp`、`timeZone='Asia/Shanghai'`、`dayStartHour=4`、`theme='caramel'`、`mascot='tuan'`、`leaderboardOptIn=false`）和 `quota_accounts`（本周 2 元），并写一条 `grant` 流水；`session.create.after` 更新 `lastLoginIp`。`profiles.nickname`、`healthConsentAt`、`onboardedAt` 可空（引导完成前为空），引导是否完成只看 `onboardedAt`。引导接口只做 UPDATE。
- 引导改为**六步**：昵称 → 头像 → 基础资料 → 板块 → 是否上榜（单独一步，ADR-0002 第 8 节）→ 健康数据同意。
- 免引导检查的接口只有 `GET /me`、`POST /me/onboarding`、`DELETE /me`、`GET /me/export`。检查做成 `middleware/auth.ts` 的 `requireOnboarded`（P1），领域路由挂 `[requireUser, requireOnboarded]`；`/admin/*` 只挂 `requireAdmin`。
- 登录页文案"5 分钟内有效"。封号用户登录失败时，P1 的 hook 返回 `ACCOUNT_BANNED` 并带 `ban: { reason, expiresAt }`；`/api/v1` 的 403 `ACCOUNT_BANNED` 同样带 `ban`。文案模板在 `error-messages.ts`。
- **管理员两步验证**：未开启时，`/admin` 在页内显示绑定流程：调 `authClient.twoFactor.enable`，显示 `totpURI` 里的密钥文本供手动输入（不显示二维码、不引入二维码库），再输 6 位码确认（D7）。`/login` 在验证码登录返回需要两步验证时多一步"输入身份验证器上的 6 位码"（D1）。
- **主题**：根布局不读会话。`src/app/layout.tsx` 的 `<head>` 里一段内联脚本在首帧前从 localStorage `daydayon:theme:v1` 读出主题写到 `<html data-theme>`（P3）。`GET /me` 返回 `theme`，外壳登录后调 `setTheme()` 同步（F3）；改偏好成功后前端调 `setTheme()`（D1）。`profiles.theme` 只作跨设备来源。
- 打卡提醒：`remindAt` 为空表示关。设置后，过了提醒时间打开应用、今天还有计划目标没完成时，主页顶部显示可关闭的提示"今天还有 N 项没打卡"，当天关掉后不再出现（localStorage 记日期）。不发邮件、不推送（D4 显示，D1 设置）。
- `/privacy` 放在无导航、不要求登录的 `(auth)` 组。

### 7.2 目标、打卡与统计

- **共享统计只有一份**：`src/server/services/stats.ts`（纯函数，不碰数据库），F1 定签名和类型，P2 实现并带单测；D1、D3、D4 只调用：
  - `isPlannedOn(target, localDate)`、`goalDayProgress(target, module, checkinsOfDay) → { value, target, done }`
  - `dayCompletion(goalsWithProgress) → { done, planned }`
  - `computeStreak(checkinDates, today) → number`（含补卡）
  - `countRankDays(rows) → number`（排除补卡，同日去重）
  - `heatmapCell(goalsOfModule, progresses) → 0..1`
- **目标量历史**：新增 `goal_targets(goalId, effectiveFrom date, targetKind, targetValue, weekdays)`，唯一 `(goalId, effectiveFrom)`。改目标量就插入（当天已有则覆盖）一行，`effectiveFrom` = 今天的打卡日；某天的进度用当天生效的那一行。`goals` 上的同名列是当前值的冗余副本。
- **饮食计次** = 当天不同餐次数（`payload.mealType` 去重）；其余 count 类按记录数；睡眠取当天那条的时长。
- **时刻由服务端定**：非睡眠打卡请求体不收 `occurredAt`，服务端取 now（补卡取昨天打卡日的 12:00，用户时区）。睡眠收 `bedAt`、`wakeAt`（前端用 `sleepRange()` 组合：起床 = 目标打卡日的该时分，入睡晚于起床则取前一天），服务端要求 `wakeAt ≤ now` 且 `localDateOf(wakeAt)` 等于今天（补卡时为昨天），否则 400 `MAKEUP_NOT_ALLOWED`。
- **评分只存 `daily_ratings`**：打卡页的"这一项今天满意吗"调 `PUT /ratings`（`scope = 该板块`）。删除 `checkins.rating`。
- **AI 打卡可改**：`PATCH /checkins/{checkinId}` 只允许改饮食条目（名称、份量、热量）和备注，保留 `parsedText`（D3）。其余打卡仍是删掉重记。
- 打卡弹层：行 = 今天计划内的进行中目标（以 PRD 为准，原型只沿用列表样式），副标题"今天完成了 X / Y 个目标"；"拍照记一餐"在有进行中饮食目标时直达 `sortOrder` 最小的那个，没有就隐藏。
- 热力图按用户打卡日的本周（周一起），格值 = `heatmapCell`：该板块当天已完成目标数 / 该板块当天计划目标数；没有计划但有打卡记满；都没有为 0。
- 排行：先用 `weekKey(now)` / `monthKey(now)` 求北京时间的起止日期，再按 `checkins.localDate` 落在区间内计数，不按 `occurredAt` 过滤。
- 体重：409 `WEIGHT_CHANGE_UNCONFIRMED` 额外带 `previousWeightGrams`。

### 7.3 AI、额度与后台

- **识别接口不流式**：`POST /ai/diet-recognitions` 返回 201 JSON `{ draft, aiRunId }`，走普通幂等重放。活动条由前端按请求状态拼一个本地的 tool part（"正在看照片"），识别中展开、完成后折叠；没有推理段。`features/diet` 不 import `ai`、`@ai-sdk/react`。
- 失败：模型输出校验失败或超时返回 422 `AI_RECOGNITION_FAILED`，带 `aiRunId`，已产生费用照常结算，前端降级手动。`confidence < 0.6` 不是错误，正常返回草稿并提示核对。
- 字段名：草稿 `items[{ name, portion, lowKcal, highKcal, proteinGrams, fatGrams, carbGrams }]`（三项营养素可空）、`totalLowKcal`、`totalHighKcal`、`confidence`、`summary`。`ai_runs` 的耗时列叫 `latencyMs`（内部耗时，不进接口）。
- **全站设置**：F1 写 `src/server/settings-schema.ts`（`AppSettings` zod schema 与默认值）；P1 写 `src/server/settings.ts` 的 `getSettings()`（进程内 10 秒缓存）与 `updateSettings(tx, patch)`（写后失效），D7 只调用。后台可调项：全站日上限、每周额度、新账号首周额度、AI 每小时次数、AI 并发数、兑换失败锁定次数、同 IP 每日注册数、验证码每邮箱 / 每 IP 每日次数。验证码同 IP 每小时 5 次走 Better Auth `customRules`，写死不可调。
- **暂停**：`aiPaused` 只表示手动暂停；日上限暂停 = 今日 `spentMicros >= dailySpendCapMicros`，实时判断。`/admin/ai/resume` 只清 `aiPaused`；当天已到上限时后台提示"先调高今日上限"，改上限当天立即生效。
- **告警**：发给所有 `role = admin` 的邮箱，按 `alerts_sent(kind, dayKey)` 去重，由 P1 的 `src/server/quota/alerts.ts` 的 `maybeAlert(kind, dayKey, detail)` 负责。删除 `ai_daily_spend.alertedAt`。
- **兑换码**：P1 的 `src/server/quota/redeem-code.ts` 是唯一实现：字符表 `23456789ABCDEFGHJKMNPQRSTUVWXYZ`，格式 `DDON-XXXX-XXXX-XXXX`；`normalizeCode()` 转大写、去空白和横线、校验长度与字符表；`hashCode()` SHA-256 十六进制；`codePrefix()`。D6、D7 只调用。兑换失败写只增表 `redeem_attempts(userId set null, ip, ok, createdAt)`，后台据此标异常。
- `POST /admin/redeem-codes` 的幂等记录只存摘要和状态，不存 `responseBody`，明文码不落库；同键重放返回 409 `IDEMPOTENCY_KEY_REUSED`。
- **封号走 Better Auth**：删除 `/api/v1/admin/users/{userId}/ban|unban`。后台调用 `authClient.admin.banUser / unbanUser`（`/api/auth/admin/*`）；P1 在 `auth.ts` 的 `hooks.after` 里按端点写 `admin_audit_logs`。`/api/v1/admin/users` 只保留列表和 `/quota-adjustments`（调用 P1 的 `ledger.adjustBonus(tx, …)`）。

### 7.4 数据模型补充

- 新增表：`goal_targets`、`redeem_attempts`（见上）。
- 部分唯一索引：`checkins (goal_id, local_date) WHERE module = 'sleep'`；`goals (user_id) WHERE module = 'sleep' AND status = 'active'`；`checkins (ai_run_id) WHERE ai_run_id IS NOT NULL`。service 捕获唯一冲突映射成 `CHECKIN_EXISTS` / `GOAL_LIMIT_REACHED` / `IDEMPOTENCY_KEY_REUSED`。
- `app_settings`、`ai_daily_spend`、`rate_limit_counters`、`alerts_sent` 用自然主键，不加 uuid `id`，保留时间列。
- 所有 `set null` 外键可空，注释"注销后去关联，账本保留"；`redeem_codes.createdBy` 为 `set null`。

### 7.5 接口补充

- 状态码：`ONBOARDING_REQUIRED` 403、`ALREADY_ONBOARDED` 409、`GOAL_NOT_FOUND` / `CHECKIN_NOT_FOUND` / `TODO_NOT_FOUND` / `USER_NOT_FOUND` 404、`GOAL_LIMIT_REACHED` / `TODO_LIMIT_REACHED` / `CHECKIN_EXISTS` / `WEIGHT_CHANGE_UNCONFIRMED` 409、`MAKEUP_NOT_ALLOWED` / `REDEEM_CODE_INVALID` 400、`REDEEM_CODE_USED` 409、`REDEEM_LOCKED` 429（带 `Retry-After`）、`AI_RECOGNITION_FAILED` 422。
- 分页：`/goals` 不分页（上限 100）；`/todos?status=open` 不分页（上限 500），`done` 游标分页；`/admin/users`、`/admin/redeem-codes` 偏移分页。
- 路由文件写完整路径，`app.ts` 统一挂在根上：`me.ts`（D1：`/me`、`/me/onboarding`、`/me/profile`、`/me/preferences`、`/me/export`）、`quota.ts`（D6：`/me/quota`、`/me/ai-runs`）、`goals.ts`（D2：`/goals`、`/goals/{goalId}`）、`checkins.ts`（D3：`/goals/{goalId}/checkins`、`/goals/{goalId}/calendar`、`/checkins/today`、`/checkins/{checkinId}`）、`metrics.ts`（D3：`/metrics/weight`、`/ratings`）、`dashboard.ts`、`rank.ts`（D4）、`todos.ts`（D5）、`ai.ts`、`redeem.ts`（D6）、`admin.ts`（D7）。
