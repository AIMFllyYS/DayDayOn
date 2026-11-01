# PWA 规范

> 日期：2026-10-31 · 状态：初版。本文档由初始化时联网调研生成，条目未经实战验证，踩坑后按 [lessons 机制](../lessons/README.md)修订。
> 依据：[ADR-0019](../adr/0019-pwa.md)（原生 manifest + 手写 Service Worker）。
> 官方资料：Next 16.4 自带文档 `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`。与它冲突时以它为准，并修正本文。
> 落地时间：M5（[roadmap.md](../plans/roadmap.md)）。

## 1. 文件

| 文件 | 作用 |
|---|---|
| `src/app/manifest.ts` | Web App Manifest（已实现，ADR-0022） |
| `public/sw.js` | 手写的 Service Worker（ESLint 已忽略此文件） |
| `src/app/offline/page.tsx` | 离线页，被预缓存 |
| `src/app/icons/[name]/route.tsx` | 192、512 尺寸图标、maskable 图标、Android 自适应图标前景层，构建时由 `src/components/layout/logo-svg.ts` 生成（不放 `public/icons/`） |
| `src/app/icon.tsx`、`src/app/apple-icon.tsx` | 标签页图标（团团大头）与 iPhone 主屏幕图标 |

## 2. manifest

- `name: 'DayDayOn'`，`display: 'standalone'`，`start_url: '/'`。
- `theme_color`、`background_color` 只能写色值：取 `globals.css` 对应 token 的值并在旁边注释 token 名。这是全项目唯一允许写死色值的地方。

## 3. 注册

- 在一个客户端组件里调用 `navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })`（Next 官方指南的写法）。
- 只在生产环境注册。开发环境不注册，避免缓存干扰调试；本地测 PWA 时用 `pnpm build` + `pnpm start`。

## 4. 缓存策略

- **不缓存** `/api/*`（包括 `/api/auth`、`/api/v1`）和任何带用户数据的响应。
- **不缓存**用户上传的图片（[ai-and-quota.md](./ai-and-quota.md) 第 5 节）。
- 预缓存：离线页、图标、字体。
- `/_next/static/*`：缓存优先（文件名带内容哈希）。
- 页面导航请求：网络优先，失败时返回离线页。

## 5. 更新

- `sw.js` 顶部写 `const VERSION = '…'`。修改 `sw.js` 必须同时修改 `VERSION`；`activate` 时删除旧版本的缓存。
- `next.config.ts` 给 `/sw.js` 设置响应头（Next 官方指南）：
  - `Cache-Control: no-cache, no-store, must-revalidate`，保证用户总能拿到最新的 Service Worker；
  - `Content-Security-Policy: default-src 'self'; script-src 'self'`。
- 修改 `next.config.ts` 属于"先问再做"。

## 6. 开屏与 APK 壳（ADR-0022）

- 开屏只在手机上以 App 形式冷启动时播放：APK 壳（UA 含 `DayDayOnApp/`），或 `display-mode: standalone` 且触屏。浏览器和桌面不播；同一次启动不重播。
- 首帧前由根布局 `<head>` 的内联脚本决定（`src/lib/splash.ts`），开屏是静态 HTML + CSS，不等水合。改开屏时保持第一帧底色等于 manifest 的 `background_color`。
- 效果在 Playbook「动效 → 开屏」查看。
- APK 壳在 WebView UA 末尾追加 `DayDayOnApp/<版本号>`，网页只经 `src/lib/native.ts` 判断运行环境。

## 7. 暂不做

- 推送通知、后台同步、离线草稿（v0.2 再评估；离线草稿可接 TanStack Query 的持久化）。

## 8. 验收

- iPhone Safari 和安卓 Chrome 都能"添加到主屏幕"，从主屏幕打开后完成一次完整打卡（M5 完成标准）。
- 断网时打开应用显示离线页，不白屏。

