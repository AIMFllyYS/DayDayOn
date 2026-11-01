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

### Vitest 里 import 带 `import 'server-only'` 的模块报错
- 症状：服务端模块的单元测试在 Vitest（Node 环境）下报 `Cannot find package 'server-only'`。
- 根因：`server-only` 是 Next 打包器内置的虚拟边界，没有独立装进 `node_modules`，Vitest 原生解析不到。
- 规则：`vitest.config.ts` 的 `resolve.alias` 把 `'server-only'` 指向 `src/test/server-only-stub.ts`（空模块），不额外安装 `server-only` 包。
- 元：next@16.4.3、vitest@5.0.5 | 2026-11-01 | 候选毕业方向：已沉淀到 `vitest.config.ts`
