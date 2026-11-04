# lessons — Next.js

### 下划线开头的调试目录不生成路由
- 症状：`src/app/_dev/` 下的页面访问一直 404。
- 根因：以为 `_dev` 只是普通目录名；Next 把 `_` 开头的文件夹当作私有文件夹，整个子树不生成路由。
- 规则：调试区用 `src/app/dev/`（URL `/dev`），由 `dev/layout.tsx` 做生产守卫；不要用 `_dev`，也不要用 `%5Fdev`（`next typegen` 与 `next dev` 生成的路由类型不一致，`pnpm typecheck` 会失败）。
- 元：next@16.4.3 | 2026-10-31 | 候选毕业方向：无（已写进 routing.md 第 5 节）

### 同一仓库里已有 next dev 在跑时新开的会直接退出
- 症状：`pnpm dev` 打印 "Another next dev server is already running"，退出码 1，新端口没有监听。
- 根因：以为改了端口就能再开一个；Next 16 按项目目录检测已有的开发服务器，与端口无关。
- 规则：启动前先看提示里的 PID，确认是自己的进程后再 `taskkill /PID <pid> /F`；别的会话开的开发服务器不要擅自结束。
- 元：next@16.4.3 | 2026-10-31 | 候选毕业方向：无

### cacheComponents 开启时动态路由没有 generateStaticParams 会让 next build 失败
- 症状：`pnpm build` 报 `Route "/goals/[goalId]" is missing a 'generateStaticParams()' so it cannot be prerendered when 'cacheComponents' is enabled`。
- 根因：Next 16 开启 `cacheComponents` 后，所有动态路由也必须做ビルド时预渲染验证；没有 `generateStaticParams` 时不知道用什么参数试跑。
- 规则：动态路由里访问用户数据的部分放在 `<Suspense>` 内，并在 `page.tsx` 导出 `export function generateStaticParams() { return [{ goalId: '_' }] }` 给构建验证一个占位参数（占位只用于预渲染外壳，真实请求按 URL 参数走 Suspense）。
- 元：next@16.4.3 | 2026-11-01 | 候选毕业方向：规范（`nextjs-16-patterns.md`）

### cacheComponents 开启时不能写 `export const dynamicParams`
- 症状：`pnpm build` 报 `Route segment config "dynamicParams" is not compatible with nextConfig.cacheComponents. Please remove it.`
- 根因：以为可以照旧用 `dynamicParams = false` 把动态路由限定在 `generateStaticParams` 的结果里；Cache Components 下这条路由段配置被禁用。
- 规则：只导出 `generateStaticParams`，未知参数在处理函数里 `notFound()`（例：`src/app/icons/[name]/route.tsx`）。
- 元：next@16.4.3 | 2026-11-02 | 候选毕业方向：规范（`nextjs-16-patterns.md`）

### Vitest 里 import 带 `import 'server-only'` 的模块报错
- 症状：服务端模块的单元测试在 Vitest（Node 环境）下报 `Cannot find package 'server-only'`。
- 根因：`server-only` 是 Next 打包器内置的虚拟边界，没有独立装进 `node_modules`，Vitest 原生解析不到。
- 规则：`vitest.config.ts` 的 `resolve.alias` 把 `'server-only'` 指向 `src/test/server-only-stub.ts`（空模块），不额外安装 `server-only` 包。
- 元：next@16.4.3、vitest@5.0.5 | 2026-11-01 | 候选毕业方向：已沉淀到 `vitest.config.ts`

### Client Component 在 useState 初始化器里用 typeof window 或读 localStorage 触发 Hydration Mismatch
- 症状：悬浮团团（`FloatingPet`）首屏报错 `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties`，服务端 `style={{ left: "0px", top: "0px" }}` 与客户端水合帧 `left: 365, top: 728` 不一致。
- 根因：`'use client'` 组件仍会在服务端执行首帧 SSR；在 `useState(() => ...)` 初始化器中按 `typeof window === 'undefined'` 分支或直接读 `localStorage` / `window.innerWidth` 会导致服务端与客户端首帧渲染结果不同。
- 规则：依赖浏览器视口或 `localStorage` 的初始状态，首帧（SSR 与客户端 Hydration）必须使用同一份确定性初值（并可用 `ready=false` + `opacity-0` 防止位置跳变闪烁），在 `useEffect` + `requestAnimationFrame` 中完成客户端测量后再更新状态与 `ready=true`。
- 元：next@16.4.3、react@19.3.0 | 2026-11-02 | 候选毕业方向：已沉淀到 `src/features/agent/use-pet-drag.ts`

### next/dynamic 不传 loading 且未设 ssr:false 时不生成 Suspense 边界导致整页闪屏
- 症状：点击底部导航栏“＋”打卡或页面内按钮首次打开 `next/dynamic` 懒加载的 `Sheet` / `ConfirmDialog` 时，整个页面瞬间被隐藏或闪回全屏骨架屏（`<PageSkeleton />`），加载完后才弹出抽屉。
- 根因：Next.js `loadable.js` 中 `const hasSuspenseBoundary = !opts.ssr || !!opts.loading`，裸调 `dynamic(loader)` 只包 `React.Fragment`；首次挂载时 `React.lazy` 抛出的 Promise 向上冒泡击穿页面级或根布局的 `<Suspense>`。
- 规则：所有用 `next/dynamic` 按需加载的弹层或局部组件，必须显式传入 `{ loading: () => null }`（或局部骨架占位），将挂起边界锁死在组件自身内部。
- 元：next@16.4.3 | 2026-11-03 | 候选毕业方向：规范（`ui-primitives.md` 第 3 节）
