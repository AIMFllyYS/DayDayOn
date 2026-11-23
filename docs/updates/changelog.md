# DayDayOn 变更日志 (Changelog)

所有关键版本与功能更新记录于此。

---

## [v0.1.14] - 2026-11-23（网页热更新：待办四象限 2×2 固定尺寸独立滚动修复、新建悬浮球视口定位修复与近期更新官方公告）

### 🛠️ 缺陷修复与热更新
- **真正的 2×2 固定尺寸四象限布局**：重构 `TodoQuadrantView` 为全端严格 `grid-cols-[minmax(0,1fr)_minmax(0,1fr)] grid-rows-2` 四象限矩阵，四个子象限固定统一高度（`h-60 sm:h-72 md:h-80`），内容区通过 `min-h-0 flex-1 overflow-y-auto overscroll-contain` 实现每个子象限独立滚动，并收紧 `TodoRow` 在四象限紧凑态下的水平间距避免窄屏挤压标题。
- **修复待办新建悬浮球沉底问题**：根因是 `AppPage` 内容区带 `@container`（`container-type: inline-size` 触发布局包含，使后代 `position: fixed` 相对于长内容区而非视口定位）；`TodoFab` 正式页面态改为通过 `createPortal(..., document.body)` 脱离 `@container` 与 `<div class="isolate">`，固定贴于视口右下角（`z-[35]`，稳定盖在页面内容与底栏之上、模态抽屉下方）。
- **官方公告单一数据源与启动幂等同步**：抽离 `src/server/db/announcements-catalog.ts` 并接入 `src/server/db/startup-migrate.ts` 与 `scripts/dev/seed.ts`，随生产部署自动幂等发布置顶的 `v0.1.12 – v0.1.14` 近期综合更新公告（按 `slug` 更新，完整保留用户历史公告已读状态）。

---

## [v0.1.13] - 2026-11-23（待办—清单 Todo v2 系统性重构、AI 稳定性与工具上限全面升级，含安卓壳 v0.1.13 / `versionCode = 10`）

### ✨ 待办—清单系统性升级（Todo v2）
- **紧凑可折叠面板与完整生命周期**：新增 `todo_groups`、`todo_tags`、`todo_events` 表及 `todos` 无损存量回填迁移（`0012`），存量待办自动归入「默认待办」分组；支持用户自定义分组、超 DDL 自动归入「已过期」、完成/放弃默认自动折叠及满 30 天自动归档（不做手动归档，无外置 cron，遵循 `ADR-0020`）。
- **四象限优先级、双视图与单条深度管理**：优先级升级为四象限双维度选择器（默认「不重要不紧急」），支持最多 5 个自定义标签、2000 字备注、删除二次确认（`ConfirmDialog`）、列表/四象限双视图切换（四象限仅进行中、忽略分组、按创建时间倒序）。
- **交互与性能优化**：保留全局 `TopBar` 与左上角「清单 | 时间日志」，右上角升级为「过程」独立单页（`/todo/timeline`）与「菜单」（含 `/todo/archived` 归档页、分组管理、视图切换），右下角新增置顶悬浮加号球（与悬浮团团自动避让）；支持零依赖原生 Pointer Events 长按待办与长按分组拖拽排序；首屏仅发轻量 `/todos/overview`，折叠面板零预请求零 DOM 挂载。
- **AI 渐进式披露待办工具链与缓存优化**：独立封装 `src/server/ai/agent-todo-tools.ts`（`getTodoOverview` / `listTodos` / `getTodoDetail` / `getTodoTimeline` / `draftTodo`），支持单轮内存记忆化缓存与静态 System Prompt 前缀缓存复用。

### 🛠️ AI Agent 与裁判稳定性加固（PR #90）
- **根治会话毒化与裁判截断**：新增 `createRepairToolCall()` 确定性修复 DeepSeek Flash 畸形工具入参，`convertToModelMessages` 传 `ignoreIncompleteToolCalls: true`，过滤空助手消息并修复重试切片；裁判 `stopWhen` 改为校验真实提交回调，联网搜索补 15s 超时与兜底。
- **放宽输出与工具上限**：Agent 对话步数提至 32 步（普通 4096 / 深度思考 8192 tokens/步，联网 15 次），裁判提至 10 步 / 4096 tokens/步（联网 6 次），保持默认不开启思考、深度思考开启时 `reasoningEffort: 'low'`。

---

## [v0.1.12] - 2026-11-19（睡眠规则取消上限、三餐总评全天汇总修复与原生报告图片分享）

### 🛠️ 缺陷修复
- **睡眠打卡取消时长上限**：移除 `SleepRulesSchema.maxHours` 与 `judgeSleep` 的上限门槛（老数据历史 `maxHours` 字段自动平滑剥离兼容），按时入睡且睡满最短时长即计为有效早睡。
- **修复「好好吃饭」三餐总评仅展示单餐**：扩展 `buildReport` 接收当日全量打卡记录，三餐结算后「今日营养素总计」「今日三餐总分与热量汇总」「今日逐菜分析」统一按一日三餐 + 加餐全天口径汇总，逐菜分析按 `早餐 → 午餐 → 晚餐 → 加餐` 顺序平铺并带餐次前缀。

### ✨ 原生分析报告 PNG 海报分享与双端小 Dock 栏（含安卓壳 v0.1.12 / `versionCode = 9`）
- **原生 Canvas 2D 手账跨页海报引擎**：新增零依赖纯 TypeScript ISO/IEC 18004 二维码编码器 `src/lib/qr.ts` 与海报引擎 `src/features/checkin/share/report-poster.ts`，默认 16:9 横版双栏 Bento 手账跨页（1920×1080，可切 9:16 竖版），融入品牌 Logo、当前陪伴宠物 SVG、手账印章、分板块结构化数据面板与可扫码的 DayDayOn 推广二维码。
- **原生 `ReportShareSheet` 底部小 Dock 栏与安卓原生桥接**：五大板块分析页顶栏右上角统一新增「分享」入口；Android 壳新增 `NativeImageShareHelper.kt` 与 `CameraTempFileProvider` 分享通道，支持一键保存系统相册（`Pictures/DayDayOn`）、复制图片与调起系统原生分享面板；网页端与旧版壳自动无报错降级至下载 PNG / 剪贴板 / Web Share 兼容方案。

---

## [v0.1.11] - 2026-11-16（目标周期统一闭环、单次骨架加载、全量规范同步与双端发版）

### ✨ 核心体验与闭环升级（目标周期统一与单次骨架首屏加载）
- **目标周期、总坚持进度与全局设置重构**：新增 `src/features/goal/period.ts` 与共享组件 `PeriodPlanPicker`（支持 7 / 14 / 21 / 30 / 60 / 100 天与截止日期双向联动 + 每日总提醒时间），同步接入新人引导「想打卡什么 · 定总周期」与全局「目标设置」（重构为顶部总览卡 +「板块与周期」「目标与计划」「达标规则」三页签手风琴结构，并支持直接调整每日目标量、每周几天与计划时段）；主页首卡 `SummaryCard` 同步新增「总打卡进度」环形图展示 `已打卡天数 / 目标坚持天数`。
- **根治进入首页两类骨架屏连续加载两次问题**：通过 `React.cache()` 复用服务端会话校验并在 `src/app/(app)/page.tsx` 内并行预取 `dashboardToday` 与 `insights` 经 `HydrationBoundary` 脱水给客户端 `HomeView`，将认证与首屏数据收敛至 `(app)/layout.tsx` 单层 `<Suspense>` 边界内，消除 `PageSkeleton` → `HomeSkeleton` 二次加载闪烁。

### 🛠️ 深度一致性缺陷修复（5 项）
- **`dayStartHour` 时钟全链路对齐用户偏好**：`loadClock`、`goals/repo.ts`、`rank`、`insights`、`pet-interactions`、`agent` 与 `checkin-flow` 等全链路统一读取 `profiles.dayStartHour`（默认 `4` 点）与 `timeZone`，消除硬编码换日点或遗漏字段导致的跨日偏差。
- **OpenAPI 流式路由与 `ErrorSchema.draft` / 幂等中间件对齐**：将流式接口（`/agent/chat`、`/goals/{goalId}/referee`）及 `ErrorSchema.draft` 敏感词草稿回传字段完整纳入 OpenAPI 契约校验，与 `idempotency` 中间件及流式 `rejectReusedKey` 防重放语义保持一致。
- **4 吉祥物全链路与开屏适配**：全站同步支持 `tuan`（团团）/ `dun`（墩墩）/ `mian`（绵绵）/ `you`（柚柚）四种陪伴形象（含引导、偏好设置、悬浮宠物、Agent 对话自称、裁判提示词、好友小窝舞台及 Web/原生开屏形象）。
- **时间格式化收敛与持久风控告警修复**：将散落的日期时间格式化统一收敛至 `src/lib/time/` 封装层；将聊天防刷静音冷静期持久化至 PostgreSQL `rate_limit_counters`（替代纯内存状态）；修复注册钩子中同 IP 超过 `3` 个账号触发 `ip-multi-account` 告警（达到 `signupPerIpDaily` 才拦截）及幂等防重放边界。
- **UI 失效 Token、层级、退场动画与 Mermaid 动态主题修复**：清理界面失效样式 Token；提升 `Combobox` 浮层层级；补全弹层退场过渡动画；修复 `MermaidDiagram` 监听 `data-theme` / `class` / `style` 变更后实时读取根元素 CSS 变量同步渲染主题配色。

### 📚 全量规范文档与 ADR 系统性对齐
- **规范与 ADR 全面同步代码现状**：同步更新 `ai-and-quota.md`、`checkin-modules.md`、`ADR-0002`、`ADR-0024`、`ADR-0027`、`ADR-0022`、`ADR-0025` 等核心文档，消除接口路径、工具列表、步数上限、风控阈值与文件目录漂移。
- **修订 `ADR-0026` 好友体系规范**：正式修订原"放弃站内聊天"决定，确认已上线的可控 1v1 好友私聊（本地 DFA 敏感词过滤 + PostgreSQL 持久化防刷冷静期 + 解除好友只读归档），并补全 `50` 人好友上限、串门小窝动态舞台与轻互动（戳戳/6 格零食架投喂/提醒打卡、30 分钟冷却与 24h 静默造访足迹）、顶栏 `AvatarStack`（`max = 4`）及长按二级管理菜单。

### 📱 Android APK 打包与双端同步发版流程对齐
- **本地离线签名构建与双端分发闭环**：完整对齐双端发版流——升版 `package.json`、`src/lib/app-version.ts`、`download/manifest.json` 与 `download/CHANGELOG.md` → 运行 `powershell -ExecutionPolicy Bypass -File android/build-apk.ps1`（使用持久化密钥库 `android/keystore/daydayon-release.jks` 离线签名产出 `download/apk/DayDayOn.apk` 并回填 `sha256` / `size`）→ 同步上传至 **GitHub Release** 与阿里云 ECS 持久化直出目录 **`/www/wwwroot/daydayon/releases/`**（配合启动/部署校验与 `sha256` 核对，保证网页与安卓壳双端一致更新）。

---

## [v0.1.10] - 2026-11-12（通知页顶部双卡片防溢出与防左右滑动、智能上传系统文件直传 AI 根因修复）

### 🛠️ 交互与布局边界热修（安装包壳 v0.1.10 / `versionCode = 7`）
- **消息与通知页全链路防横向溢出（修复 #83）**：修复 `MessageCenter`、Playbook `NotificationsScreen` 与 `TwoLevelNotificationCenterDemo` 顶部双 `<button>` 在 Blink UA 默认 `align-items: flex-start` 下交叉轴按 `max-content` 撑宽、文字无法 `truncate` 的布局溢出问题；统一收紧 `grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`、`items-stretch w-full max-w-full min-w-0 overflow-hidden`、滚动区 `overflow-x-hidden overscroll-x-none` 及二级卡片/聊天气泡 `break-words [overflow-wrap:anywhere]`。
- **智能上传「+ 系统文件 / 附件」直传 AI 根因修复与原生内存流桥接（修复 #83）**：修复 `PhotoAlbumSheet.handleLocalFilesImport` 在 `Array.from(fileList)` 前清空 `e.target.value` 导致动态 `FileList` 原地清零提前返回的问题，并将 `<input>` 移入 `Sheet` 活跃模态 `footer` 内防止 `inert` 阻断；`MainActivity` 新增 `pickSystemFiles` + `/__native__/media/picked/{token}` 内存流桥接（零落盘，支持 HEIC/DNG 转码与文本附件读取）并移除国产 ROM `DocumentsUI` 窄 `EXTRA_MIME_TYPES` 置灰限制；`src/lib/image` 新增 `sniffIsImageFile` 文件头魔数嗅探。

---

## [v0.1.9] - 2026-11-12（智能上传附件直传、我的多级菜单、计步优化、全屏消息与官方公告模块）

### 📱 安卓原生提醒推送、计步传感器与文件选择加固（安装包壳 v0.1.9 / `versionCode = 6`）
- **智能上传左下角系统文件 / 附件直传识别（修复 #80）**：`PhotoAlbumSheet` 左下角选中任意图片或文档后立即关闭面板并回调上传；`MainActivity` 升级 `ACTION_OPEN_DOCUMENT` 文件选择授权；`smart-handoff` 引入 `requireSessionMatch` 杜绝跨路由 `sid` 载荷被旧实例抢占。
- **手机提醒精确唤醒与真实通知推送**：`LocalReminderScheduler` 升级 `setExactAndAllowWhileIdle` 单次精确闹钟续期链、高优通知渠道 `daydayon_checkin_reminder_v2` 与单色状态栏图标 `ic_stat_reminder.xml`；`syncNativeReminder` 严格校验 `perm === 'granted'` 并提供测试通知一键验证。
- **今日步数传感器准确性与手动记录面板**：`StepCounterManager` 引入独立 `HandlerThread`、`flush` 同步等待、当日重启基线智能判定与 `TYPE_STEP_DETECTOR` 回退；新增 `StepsPanel` 支持硬件一键同步与手动步数记录；主页 `StepsCard` 改为 `col-span-2` 等高横跨双列。

### 🎨 「我的」多级菜单、全屏消息中心与数据库官方公告
- **「我的」多级分组与组件加固（同步修复 #62）**：参考 Material Design 3 设置规范重构 `MeView` 一级分组与二级详情页，全面清理工程化权限名与冗余术语；`Select` 提升浮层层级并支持选项副文案，`MenuItem` 通过判别联合类型根治 `<button>` 嵌套水合警告。
- **全屏消息与通知 + 数据库官方公告模块**：`MessageCenter` 与 `ChatRoom` 升级为无外框全屏布局，顶部独立置顶「打卡房间与动态」与「官方与系统通知」，下方排布好友聊天；新增 PostgreSQL `announcements` + `announcement_reads` 表（迁移 `0011_freezing_crystal`），支持随时向数据库写入全局公告并独立追踪每位用户已读状态。

---

## [v0.1.8] - 2026-11-11（相册时间倒序修复、左上角限高滚动相册目录菜单与安卓壳 v0.1.8 升级）

### 📱 安卓原生相册与图片解码升级（安装包壳 v0.1.8 / `versionCode = 5`）
- **真实拍摄时间归一化严格倒序（修复 #77）**：`MediaAlbumBridge` 废弃单一 `DATE_ADDED` 排序，统一按 `DATE_TAKEN`（含 10 位秒级兼容与未来漂移保护）→ `DATE_MODIFIED * 1000` → `DATE_ADDED * 1000` 归一化毫秒时间戳，过滤 `IS_PENDING` / `IS_TRASHED` 并按 `effectiveTimeMillis DESC, id DESC` 稳定倒序排列，修正 UTC 时区格式化并接入 `MediaStore` 代数快照缓存。
- **相册文件夹聚合与按目录分页桥接**：新增 `getAlbumBucketsJson()` 与 `getAlbumPhotosPageWithBucketJson(offset, limit, bucketId)`，菜单首项固定为「全部」（`__ALL__`），核心相册目录（`Camera` / `Screenshots` / `RAW` / `WeiXin` / `Pictures` / `Download`）固定优先、其余目录按本地化规则稳定排序；`src/lib/native.ts` 同步提供 `sortAlbumPhotosNewestFirst`、`normalizeAlbumBuckets` 与向后兼容回退。
- **RAW（`.dng`）与 HEIC 解码加固**：`NativeCameraHelper` 新增 API 28+ `ImageDecoder`（软件位图分配 + 自动 EXIF 旋转）、`ContentResolver.loadThumbnail` 与 `ExifInterface.thumbnailBitmap` 多级回退。

### 🎨 底部相册抽屉交互升级
- **左上角相册文件夹选择菜单**：`Sheet` 支持 `titleSlot` 自定义无障碍标题槽位；`PhotoAlbumSheet` 顶栏左上角替换为带手绘 `album` SVG 图标的目录选择菜单（首项固定「全部」），隐藏原顶栏辅助文案；弹层菜单限定最大高度（`max-h-56`）并在目录超出时内部独立滚动，不撑高抽屉、不顶出屏幕，跨目录点选完整保留 `1..9` 顺序角标。

---

## [v0.1.7] - 2026-11-11（智能打卡切手动 409 修复、跨页缓存同步与焦点无障碍优化）

### 🛠️ 打卡链路断层修复与无障碍加固
- **单次智能识别会话隔离（修复 `409 CHECKIN_EXISTS`）**：新增 `smart-session.ts`，在切回「手动填写」Tab、子维度顺延（如继续记午餐/晚餐）、跨板块切换及单次确认入库后立即清理已消费的 `smart.aiRunId` 与 `method: 'photo'` 标记，杜绝手动或续记请求复用旧 `ai_runs.id` 触发唯一索引冲突。
- **跨页首帧缓存同步与未确认退出守卫**：`useCreateCheckin` 成功后同步更新当日 `checkinDayQuery` 缓存与目标详情 `validDays` 增量，补齐 `invalidationMap.afterCheckinChange` 的 `goals.all` 失效；将手动裁判未确认状态接入 `/checkin/smart` 返回拦截弹窗。
- **悬浮宠物焦点卸载与 `inert` 改造**：`FloatingPet` 在隐藏前通过 `useLayoutEffect` 同步 `blur()` 卸载焦点并改用原生 `inert` 属性，彻底消除浏览器 `Blocked aria-hidden on an element because its descendant retained focus` 警告，同时补齐键盘激活回调。

---

## [v0.1.6] - 2026-11-11（原生 0ms 开屏、落地页闭环、自托管 APK 应用内更新与智能打卡重构）

- **安卓原生 0ms 开屏与自托管 APK 更新闭环**：新增原生开屏覆盖层 `nativeSplashOverlay`、武汉服务器独立持久化 `/www/wwwroot/daydayon/releases/` 直出目录、固定签名证书与应用内实时进度下载/校验/安装器自动拉起闭环。
- **双端选图分流与饮食三餐全天结算**：网页端直调原生多选文件框，安卓壳采用流式缩略图分页相册；`/checkin/smart` 原地复用真实 `<CheckinFlow>`，饮食三餐集齐（3/3）后统一计算全天总分并弹出盖章庆祝。

---

## [v0.1.5] - 2026-11-09（饮食三餐智能识别、温和评分与五大模块同日读写协议统一）

### 🍱 饮食三餐智能识别与状态机修复
- **三餐时间就近匹配与手动锁定**：`guessMainMeal` 按本地时间就近默认早 / 午 / 晚餐（加餐 `snack` 仅限用户手动点击选择）；餐次切换条显示今日已打卡 `✓` 标记，连续智能拍照自动顺延至下一个未打卡正餐，修复第二次智能拍照被重置回早餐的问题。
- **跨餐次去污染与渲染期竞态修复**：隔离已存餐次备注与 AI 摘要，防止第一餐备注污染第二餐识别；对齐 `CheckinFlow` 在 `applySmart` 切餐时的 `seenSyncKey`，消除渲染期误触发 `referee.reset()` 的竞态。
- **温和化评分梯度与三餐结算**：平滑 `dietScore` 的膳食纤维（`>=1g` / `>=5g` / `>=8g`）、蛋白质（`>=10g` / `>=20g`）与 GI（`<=75` / `<=55`）阶梯，使常规家常三餐稳定落在 `3.6 ~ 4.5` 分，进度正常递增 `1/3 → 2/3 → 3/3`，三餐齐全或手动加餐后由 `reconcileDailyDiet` 硬覆盖全天状态。

### 🔄 五大板块同日读写协议与全局闭环
- **五大模块同日 Upsert / 累加协议**：`diet`（同日同餐次）、`sleep`、`custom`、`exercise`（同日单条聚合运动明细）统一走服务端同日 Upsert；`exercise` 智能识别补齐 `km` 与 `sets` 字段；`study` 在今日累计时长未达标时重进默认打开空白表单供累加下一段碎片学习，达标后同步激活当日暂存碎片记录。
- **全局 `/checkin/smart` 跳转闭环**：打卡完成后明确显示所记餐次，点击「查看打卡详情」直达 `/goals/[goalId]/checkin?meal=...` 对应餐次视图。

---

## [v0.1.4] - 2026-11-08（安卓原生模块、今日步数与饮食裁判升级）

### 📱 安卓原生模块（安装包壳 v0.1.3）

- 新增 Kotlin 壳工程 `android/`：原生高清相机、微信式 1–9 张顺序多选相册、硬件计步器（TYPE_STEP_COUNTER）与 AlarmManager 本地定时提醒，经 `src/lib/native.ts` 单一桥接层暴露，纯网页端全量降级。
- 「我的 → 账号」新增**权限管理**（相机 / 相册 / 计步器 / 通知与本地闹钟四项）。
- 打卡提醒升级为「应用内提醒 / 手机提醒（手机端原生组件）/ 关闭」三档。
- 智能拍照、智能上传与对话输入支持同时选 2 张照片（默认展示首图、保存双路径）。

### 👟 今日步数与数据契约

- `/api/v1` 新增 `PUT/GET /metrics/steps`，新增 `step_metrics` 表与迁移 `0010_remarkable_nebula`。
- 主页新增今日步数卡（近 30 天走势 + 7 天差值）；APK 内进主页自动回传硬件计步。
- `docs/specs/api/openapi.json` 重新导出，供 Kotlin 客户端生成类型化调用代码。

### 🍱 打卡与饮食裁判（Issue #59 / PR #60）

- 打卡日刷新统一为凌晨 0 点零点换日。
- 饮食裁判支持三餐全天总分结算、空腹加分、加餐覆盖入库与跳过打卡核验；裁判与智能识别提示词支持备注优先。
- 打卡页直读当日数据，修复餐次切换串数据。

### 🔧 发布信息

- 网页版本 `0.1.4`；安卓壳版本 `0.1.3`（`download/manifest.json` 的 `android.version`）。
- 数据库迁移 `0010` 由服务启动钩子幂等执行；部署闸门在切换前自动热备份数据库，健康检查失败自动回滚。
- CI：`verify`（lint / typecheck / format / test / build / 制品组装）+ `secrets` 全绿。

---

## [v0.1.3] - 2026-11-06（检查更新与自托管安装包）

### 🔄 检查更新
- 「我的 → 账号」新增**检查更新**：已是最新用 toast 提示；有更新时居中弹窗渲染更新日志 Markdown，网页版点「刷新」，安装包有新版时点「下载安装包」（附 GitHub 备用链接）。
- 新接口 `GET /api/v1/app/update?web=&shell=`（公开、按 IP 限流）：对比页面构建版本、壳 UA 版本与服务器上的版本清单，返回 `none / reload / install`。
- 网页版本与安卓壳版本分开记：网页壳阶段装了 App 的用户只会被提示刷新，不会被要求重装同一个安装包。

### 📦 自托管安装包
- 新增 `download/`：`manifest.json`（版本清单）、`CHANGELOG.md`（面向用户的更新日志，检查更新弹窗按版本截取）、`README.md`（发版流程）。
- 部署制品打包时按清单从 GitHub Release 取安装包并核对 sha256，`/download/DayDayOn.apk` 由我们自己的服务器提供；落地页下载按钮改走自己的服务器。

---

## [v0.1.2] - 2026-11-06（打卡页整页化、全局唯一 Agent 与各板块近况）

### 🧭 打卡页整页化
- 打卡页去掉手机外框，改为真正的整页：手机贴满屏幕，桌面左栏填写、右栏 Agent 分析，底部操作条与内容同宽。
- 打卡结果弹层的「完成」只收起弹层、留在打卡页，不再跳回主页。

### 👻 全局只有一个 Agent
- 打卡页不再出现第二只宠物：分析中 / 已完成的状态点挂在悬浮宠物身上，手机上点它展开或收起分析，桌面上点它打开对话。
- 宠物名字、对话里的自称、输入框提示、扫描镜文案统一跟随用户选的形象（墩墩 / 团团）。
- 点「提交并 Agent 自动解析」会新建一个 Agent 会话并在里面分析，分析过程和结论存进对话历史（标题「目标名 · 打卡分析」），可以在同一个会话里接着追问。
- Agent 对话步数上限 12 → 20，最后一步一定给出文字回答，不会只剩一串工具调用。

### 📊 各板块近况
- 主页新增「各板块近况」：每个进行中的目标一张卡，主数字按板块的核心目的（饮食平均分、运动时长、睡眠时长与平均入睡时刻、学习专注时长、自定义达标天数），附达标率、近 7 天走势、最常卡住的规则与期限。
- 本周热力图分出三种状态：完成、打了没达标（虚线斜纹）、没打。
- 新接口 `GET /api/v1/insights?days=7|30`；Agent 新工具 `showStats`，问「这周各板块怎么样」时对话里直接弹出同款近况卡。

---

## [v0.1.1] - 2026-11-05（流式 Agent 裁判上线与打卡全生命周期闭环）

### 🤖 流式 Agent 裁判与分数库落地
- **前后端统一判定契约**：五大打卡板块（运动、饮食、睡眠、学习、自定义）接入前后端共用的纯函数与 `POST /api/v1/goals/{goalId}/referee` 流式 Agent 裁判接口。模型通过专用查询工具（食物营养表、运动 MET 表、近 7 晚睡眠与今日学习记录）获取事实，经 `submitVerdict` 工具交卷；服务端在入库时重新判定，不信任前端传入的分数。
- **达标防作弊与有效统计引擎**：新增迁移 `0008`（`checkins.score`、`is_valid`、`verdict`）；未达标打卡照常保存存档，但**不计入连续天数（Streak）、目标进度与排行榜**。
- **目标设置唯一入口收拢**：「我的 → 目标设置」成为全局唯一目标入口，按板块配置人群档位（新手/进阶/自律）与达标规则；新人引导增加可跳过的「定个标准」一步；打卡弹层在无目标时提供优雅虚线引导卡片。

### 💬 对话团团打卡闭环与审计留痕
- **对话打卡统一裁判标准**：悬浮桌宠团团与 `/agent` 对话打卡接入与打卡页完全一致的裁判体系，用户在点击确认前即可在草稿卡实时预览分数与「达标 / 未达标」判定。
- **改打卡 / 删打卡 / 查留痕工具**：团团支持自然语言改写与删除今天和昨天的打卡（超出时间窗口由接口层 `CHECKIN_LOCKED` 拦截防作弊）；修改时按新内容重新触发裁判。
- **审计留痕表（`checkin_revisions`）**：新增迁移 `0009`，记录打卡的新增、修改、删除全过程快照、操作来源与修改原因。

### 🎨 五大打卡板块 Playbook 整页稿与智能识别交互优化
- **五大板块整页稿重构**：饮食（常吃标签横滑、加餐时间选择器、逐菜分析报告）、运动（自填类型、时间/距离/组数自动计量、加号支持多项运动组合）、睡眠（自有跨夜时间器、双分区并列）、学习（要点逐条添加与报告）及我的小目标（自定义组件拼装）。
- **智能打卡体验完善**：优化扫描镜流式填充、抽离全屏历史识别记录页与只读历史详情视图，补齐未确认退出二次确认守卫。

---

## [v0.1.0] - 2026-11-04（基线冻结正式版 · 含 Android APK 首发）

### ✨ 全板块智能打卡与 AI 识图升级
- **打卡弹层底栏双按钮（方案 C 奶油描边）**：
  - 原单一「拍照记一餐」正式升级为左「智能拍照」+ 右「智能上传」双按钮。
  - 支持拍照/选图（内存内压缩为 JPEG，**绝不落盘、不进数据库、不写日志**）以及上传 `.txt/.html/.md/.csv` 文本附件（自动剥离 HTML 标签提纯正文）。
- **双入口智能识别闭环**：
  - **全局智能识别页（`/checkin/smart`）**：实时扫描镜动效 + 3 步识别轨迹，由 `deepseek-flash` 自动判别所属 5 大板块（运动、饮食、睡眠、学习、自定义）、自动匹配进行中目标并预填结构化草稿，用户确认后入库。
  - **单板块打卡页三态 Tab（`/goals/[goalId]/checkin`）**：统一接入 `手动填写 | 智能拍照 | 智能上传` 三态切换，在已知板块内跳过方向判别直接扫描填表。
- **Playbook 五大打卡板块深度设计专页**：
  - 新增左侧「打卡板块」树形导航及 `/dev/playbook/modules` 总览与 `diet`、`exercise`、`sleep`、`study`、`custom` 五个独立设计专页（涵盖个人体质三档切换、目标检验规则卡与 `<PhoneFrame>` 交互沙盒）。

### 📱 官网（`/welcome`）移动端结构优化与 Android APK 首发
- **移动端官网布局重构**：
  - 顶栏新增「下载 App」与「进入 / 登录」快捷胶囊入口；
  - 首屏互动舞台卡片化收拢，修复 4 角色切换器（团团 / 墩墩 / 绵绵 / 柚柚）在手机宽度下的换行问题；
  - 「五个板块」在手机端将团团表情反应台置顶并采用紧凑双列网格；「AI 帮你记」与「试一试」消除移动端空白断层。
- **Android 安装包（`DayDayOn.apk`）正式挂载 GitHub Release**：
  - 首发签名版 `DayDayOn.apk`（包名 `com.husteread.daydayon`，UA 标识 `DayDayOnApp/0.1.0`），内置「05 连击热力·五彩织锦」自适应图标与 `#fff8f0` 晨曦奶油首帧底色，无缝衔接 Web 开屏动画、相机拍照与文件选择。
  - 官网下载区启用 `APK_AVAILABLE = true`，直连 `releases/latest/download/DayDayOn.apk`。

---

## [v0.1.0-icon] - 2026-11-03

### 🎨 视觉与品牌重塑 (Brand & Visual Identity)
- **应用唯一官方图标全面升级**：
  - 彻底告别原有的单一沉闷焦糖色底块与模糊细碎线稿，升级为 **【05 连击热力·五彩织锦 (Streak Heatmap & Mosaic)】**。
  - **核心寓意**：运动（薄荷绿）、饮食（黄油金）、学习（晴空蓝）、睡眠（薰衣草紫）四色板块积木如同温润手账贴纸交错环抱，中心汇聚成永不停歇、跳动生光的连击火种（Streak Core）。
  - **全链路适配**：
    - **标签页图标 (Favicon)**：经过 16px/32px 特别优化，在极小尺寸下色块分明、清晰透亮；
    - **移动端与桌面 PWA 图标**：全尺寸支持 192px / 512px / Maskable 满版；
    - **Android APK 壳自适应图标**：提供 432px 透明前景层与 `#fff8f0` 奶油底色背景层；
    - **应用内品牌标 (BrandMark)**：侧栏与登录页同步焕新。
- **储备备用社交视觉资产**：
  - 将广受好评的 **【08 信笺、纸飞机与朋友的回音 (Paper Plane & Resonance)】** 纳入全站设计系统储备库。
  - 新增手绘错版印刷风格图标 `<Icon name="paper-plane" />`，并在 `src/components/layout/logo-svg.ts` 中导出 `paperPlaneSvg()`，供后续朋友动态投递、通知与打卡分享场景调用。
- **Playbook 设计系统更新**：
  - 在 `/dev/playbook/foundations` 新增“应用图标 · 品牌主印记”板块，支持在线切换三种外形（圆角、满版、自适应前景）以及 96px 到 16px 全尺寸阶梯实机清晰度检验。
- **规范与设计文档同步**：
  - 同步更新 `ADR-0022`、`ui-design-system.md`、`pwa.md` 及设计归档文档 `docs/designs/app-icons/`。

---

## GitHub Release Notes 文案参考 (可直接复制发版)

```markdown
## 🌟 DayDayOn 视觉焕新：全新应用图标与标签页微标上线！

### 🎨 核心看点
- **全新官方图标【连击热力·五彩织锦】**：
  将运动、饮食、睡眠、学习四大板块凝练为缤纷温润的手账积木，中心汇聚跳动的连击火种。底色采用通透干净的晨曦奶油纸色（#fff8f0），在手机浅色/深色壁纸上均具备卓越的呼吸感与高级感。
- **双端全尺寸高清呈现**：
  - 网页标签页 Favicon（16/32px）焕然一新，微缩辨识度显著提升；
  - PWA 与 Android APK 壳自适应图标无缝同步生成；
  - 侧栏与应用内 BrandMark 细节升级。
- **社交视觉储备【08 纸飞机】**：
  沉淀“信笺与纸飞机”视觉资产并在 Playbook 中落地，作为后续好友互动与打卡投递的专属徽标。

### 🛠️ 质量验证
- 全站 84 个测试套件（757 个用例）全部通过。
- 完整通过 Next.js 静态预渲染与构建验证。
```
