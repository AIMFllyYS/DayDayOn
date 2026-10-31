# lessons — TanStack Query（@tanstack/react-query）

> 适用版本：@tanstack/react-query@5.105.0（M3 安装）。以下条目来自 2026-10-31 对官方指南的核对，尚未在本项目代码里踩到。

### 用 Server Action 当 queryFn
- 症状：查询一直停在 pending，或报 "Only plain objects … can be passed to Server Actions"。
- 根因：从客户端调用时 Server Actions 串行执行，与 TanStack Query 的并行请求冲突（官方 Advanced SSR 指南的警告）。
- 规则：queryFn 只请求 `/api/v1`（经 `src/lib/api/`）；本项目本来也不用 Server Actions 写业务。
- 元：@tanstack/react-query@5.105.0 | 2026-10-31 | 候选毕业方向：无

### Server Component 渲染了查询结果
- 症状：客户端重新获取数据后，页面上服务端渲染的那部分数字和列表对不上。
- 根因：TanStack Query 不知道怎么让 Server Component 重新渲染。
- 规则：Server Component 只做预取并用 `HydrationBoundary` 传下去，不渲染结果；有服务端预取时 `staleTime` 必须大于 0。
- 元：@tanstack/react-query@5.105.0 | 2026-10-31 | 候选毕业方向：封装层（`src/lib/api/`）

