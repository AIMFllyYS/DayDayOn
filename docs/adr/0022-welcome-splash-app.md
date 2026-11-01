# ADR-0022：落地页、开屏、App 图标与 APK 分发

- 状态：Proposed <!-- 负责人确认后改为 Accepted -->
- 日期：2026-11-02
- 决策人：项目负责人（AI 整理）

## 背景

- 负责人要求新增落地页：未登录打开站点时先看介绍，已登录的人也能手动打开。
- 会自己打包一个 APK 外壳（WebView + 少量 Kotlin 原生组件），安装包发到 GitHub Release，落地页要有下载入口。
- 手机上以 App 形式打开时要有一个全屏开屏动画。
- 要一个和设计风格一致的 App 图标，兼作标签页图标和项目 Logo，IP 是团团和墩墩。
- ADR-0003 把 APK 壳列在"暂不做"，这次是范围调整。

## 决定

1. **路由**：落地页是 `/welcome`（名词，符合 routing.md 第 1 节），放在 `(marketing)` 路由组，独立布局，不要求登录。
   - `src/proxy.ts`（规则在 `src/lib/entry-redirect.ts`）：未登录打开 `/` → `/welcome`；未登录打开其他页面 → `/login?next=…`（不变）。
   - 浏览器、已安装的 PWA、APK 壳统一走这条规则；manifest `start_url` 仍是 `/`。
   - 已登录访问 `/welcome` 照常显示，主按钮换成"进入 DayDayOn"；应用内只有「我的 → 关于 DayDayOn」一个入口。
2. **落地页内容**：全部是写死的演示数据，不调接口、不耗 AI 额度。一屏只放一只互动团团（首屏），其余区块用静态团团。
3. **开屏**：只在手机上以 App 形式冷启动时播放（APK 壳、`display-mode: standalone` 且触屏），浏览器打开网址和桌面不播；同一次启动（sessionStorage）不重播。
   - 根布局 `<head>` 内联脚本在首帧前决定，写 `<html data-splash>`；开屏是静态 HTML + CSS（`globals.css` 的 `.splash`），不等水合；`SplashController` 负责收尾和点按跳过。
   - 约 1.7 秒：团团眨眼 → 蓄力起跳 → 盖章"开始啦" → 以团团为圆心挖开露出页面。用户上次选的形象记在 localStorage，问候按早上 / 白天 / 深夜换。
   - 第一帧底色 = manifest `background_color` = `--background`，和系统开屏衔接成一段。
4. **APK 壳约定**：WebView 的 User-Agent 末尾追加 `DayDayOnApp/<版本号>`；网页经 `src/lib/native.ts` 识别，以后的原生桥接入口也放这里。壳加载 `/`，接口复用 `/api/v1`。
5. **下载**：每次发版的安装包固定命名 `DayDayOn.apk`，落地页链接 `releases/latest/download/DayDayOn.apk`（`src/features/welcome/download.ts`）。第一个 Release 发出前 `APK_AVAILABLE = false`，只显示"去 GitHub Release 看看"。iPhone 显示"添加到主屏幕"三步说明。已在 APK / PWA 里时整块隐藏。
6. **Logo 与图标**：唯一图标源 `src/components/layout/logo-svg.ts`（纯 SVG 字符串）。
   - `full`：团团和墩墩肩并肩、中间一颗小爱心，用于 App 图标（≥ 96px）。
   - `mark`：团团大头，用于标签页图标和界面里的 `BrandMark`。
   - 底色固定为默认主题奶茶焦糖 `#93603f` + 手账点阵，不随用户主题变。
   - `app/icon.tsx`、`app/apple-icon.tsx`、`app/icons/[name]` 在构建时生成 PNG / SVG（含 maskable、Android 自适应图标前景层），PWA manifest 和 APK 工程都从这里取。删除 create-next-app 的占位 `favicon.ico`。

## 理由

- 开屏放在根布局并且只看客户端存储，根布局保持静态（cacheComponents），也不会拖慢浏览器访客。
- 图标只有一份源文件，标签页、PWA、APK、界面里的品牌标识不会各画各的。
- 固定安装包文件名让下载链接永远指向最新版，落地页不用随版本改。

## 放弃了什么

- 不做国内镜像下载（GitHub Release 在国内可能慢）。需要时在 ECS 上放 `/download/DayDayOn.apk`，属于服务器操作，另行批准。
- 落地页不显示版本号（要调 GitHub API 并缓存）。
- iOS 的 PWA 系统开屏需要按屏幕尺寸准备启动图，暂不做，只对齐底色。
- 不用 CSS scroll-driven 动画，进场用现有预设。

## 何时重审

- 第一个 APK 发布时（改 `APK_AVAILABLE`，确认 UA 标识与图标接入）。
- 朋友试用两周后按 ADR-0003 重审范围时。
