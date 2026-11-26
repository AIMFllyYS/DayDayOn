# lessons — TanStack Query（@tanstack/react-query）

> 适用版本：@tanstack/react-query@5.105.0。以下条目已结合官方指南与 `src/lib/api/` 实战踩坑持续维护。

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

### `enabled: false` 搭配 `initialData` 在父级刷新后永远滞留首帧旧值
- 症状：Agent 或外部 mutation 刷新父查询后，子查询虽传入了更新后的 `initialData`，但因 `enabled: false` 页面仍一直显示首次挂载时的旧列表（如待办默认分组不刷新）。
- 根因：TanStack Query 仅在缓存 `state.data === undefined` 时初始化 `initialData`，此后 `initialData` 变更不会覆盖已有缓存。
- 规则：禁止用 `enabled: false` + 变化中的 `initialData` 透传父查询数据；当子查询禁用时直接消费父级 props（如 `const items = enabled ? query.data : parentItems`），仅启用远端拉取时才读 `query.data`。
- 元：@tanstack/react-query@5.105.0 | 2026-11-26 | 候选毕业方向：无
