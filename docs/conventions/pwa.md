# PWA 规范

> 日期：2026-10-31 · 2026-11-16 按当前代码库现状修订 · 状态：部分落地（Manifest / 图标 / 开屏已实现，Service Worker 与离线页规划于 M5）。
> 依据：[ADR-0019](../adr/0019-pwa.md)（原生 manifest + 手写 Service Worker）。
> 官方资料：Next 16.4 自带文档 `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`。与它冲突时以它为准，并修正本文。
> 落地时间：Service Worker 与离线页为 M5 规划项（[roadmap.md](../plans/roadmap.md)）。

## 1. 文件

| 文件 | 状态 | 作用 |
|---|---|---|
| `src/app/manifest.ts` | 已实现 | Web App Manifest（ADR-0022） |
| `src/app/icons/[name]/route.tsx` | 已实现 | 192、512 尺寸图标、maskable 图标、Android 自适应图标前景层与 SVG 源文件，构建时由 `src/components/layout/logo-svg.ts` 生成（不放 `public/icons/`） |
| `src/app/icon.tsx`、`src/app/apple-icon.tsx` | 已实现 | 标签页图标与 iPhone 主屏幕图标 |
| `src/lib/splash.ts`、`src/components/layout/splash.tsx`、`src/components/layout/splash-controller.tsx` | 已实现 | 手机端已安装 PWA 冷启动开屏逻辑与静态 HTML + CSS 渲染 |
| `public/sw.js` | **M5 规划（尚未落地）** | 手写的 Service Worker（`eslint.config.mjs` 已预先忽略此文件） |
| `src/app/offline/page.tsx` | **M5 规划（尚未落地）** | 离线页，被预缓存（当前仅 `src/lib/entry-redirect.ts` 的 `PUBLIC_PREFIXES` 已预留 `'/offline'`） |

## 2. manifest

- `name: 'DayDayOn'`，`display: 'standalone'`，`start_url: '/'`。
- `theme_color`、`background_color` 只能写色值：取 `globals.css` 对应 token 的值（当前为 `#fff8f0`，对应 `--background`）并在旁边注释 token 名。这是全项目唯一允许写死色值的地方。

## 3. 注册（M5 规划，尚未落地）

- 计划在 M5 新增客户端注册组件并调用 `navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })`（Next 官方指南的写法），当前代码库尚未落地该组件与 `public/sw.js`。
- 只在生产环境注册。开发环境不注册，避免缓存干扰调试；本地测 PWA 时用 `pnpm build` + `pnpm start`。

## 4. 缓存策略（M5 规划）

- **不缓存** `/api/*`（包括 `/api/auth`、`/api/v1`）和任何带用户数据的响应。
- **不缓存**用户上传的图片（[ai-and-quota.md](./ai-and-quota.md) 第 5 节）。
- 预缓存：离线页、图标、字体。
- `/_next/static/*`：缓存优先（文件名带内容哈希）。
- 页面导航请求：网络优先，失败时返回离线页。

## 5. 更新（M5 规划）

- `sw.js` 顶部写 `const VERSION = '…'`。修改 `sw.js` 必须同时修改 `VERSION`；`activate` 时删除旧版本的缓存。
- `next.config.ts` 给 `/sw.js` 设置响应头（Next 官方指南，当前 `next.config.ts` 仅配置 `/:path*` 安全响应头，`/sw.js` 响应头随 M5 一并添加）：
  - `Cache-Control: no-cache, no-store, must-revalidate`，保证用户总能拿到最新的 Service Worker；
  - `Content-Security-Policy: default-src 'self'; script-src 'self'`。
- 修改 `next.config.ts` 属于"先问再做"。

## 6. 开屏与 APK 壳（ADR-0022，已实现）

- 网页层开屏只在手机上以**已安装 PWA** 形式冷启动时播放（`display-mode: standalone` 且触屏 `pointer: coarse`）。浏览器直接打开与桌面端不播；同一次启动（`sessionStorage`）不重播。
- **APK 原生壳（UA 含 `DayDayOnApp/`）跳过网页层开屏**：由 Android 原生层（`MainActivity` 的 `nativeSplashOverlay`）在 0ms 承担开屏，`src/lib/splash.ts` 检测到 `DayDayOnApp/` 后直接返回，不再重复叠加网页 `.splash`（避免公网加载完再播一遍及全屏 `mask-image` 光栅化卡顿）。
- 首帧前由根布局 `<head>` 的内联脚本（`src/lib/splash.ts` 的 `splashScript`）写入 `data-splash`、`data-splash-char`、`data-splash-greet`，开屏是静态 HTML + CSS，不等水合。改开屏时保持第一帧底色等于 manifest 的 `background_color`。
- `src/lib/splash.ts` 与 `src/components/layout/splash.tsx` 支持全部 4 个陪伴角色（`tuan` 团团、`dun` 墩墩、`mian` 绵绵、`you` 柚柚）；登录后由 `ThemeSync` 调用 `rememberSplashMascot()` 写入 `localStorage`（`daydayon:mascot:v1`），下次冷启动按记住的角色展示（默认回退 `tuan`）。
- 效果在 Playbook「动效 → 开屏」查看。
- APK 壳在 WebView UA 末尾追加 `DayDayOnApp/<版本号>`，网页只经 `src/lib/native.ts` 判断运行环境并调用原生桥接。

## 7. 暂不做

- 推送通知、后台同步、离线草稿（v0.2 再评估；离线草稿可接 TanStack Query 的持久化）。

## 8. 验收

- iPhone Safari 和安卓 Chrome 都能"添加到主屏幕"，从主屏幕打开后完成一次完整打卡（M5 完成标准）。
- 断网时打开应用显示离线页，不白屏。

