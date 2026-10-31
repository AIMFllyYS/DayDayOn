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
