# lessons — Vitest

> 适用版本：vitest@5.0.5 + vite@8.x（M3 安装）。以下条目来自 2026-10-31 对 Next、Vite 官方文档的核对，尚未在本项目代码里踩到。

### 照 Next 指南安装 vite-tsconfig-paths
- 症状：为了解析 `@/` 别名多装一个插件。
- 根因：Next 的 Vitest 指南仍推荐该插件；Vite 8 已内置 `resolve.tsconfigPaths`。
- 规则：`vitest.config.ts` 写 `resolve: { tsconfigPaths: true }`，vite 装 8.x。
- 元：vitest@5.0.5、vite@8 | 2026-10-31 | 候选毕业方向：无

### import 'server-only' 在测试里解析失败
- 症状：测试 `src/server/` 下的模块时报找不到 `server-only`。
- 根因：项目没有安装 `server-only` 包，Next 在内部处理它（Next 文档：安装是可选的）；Vitest 不经过 Next。
- 规则：`vitest.config.ts` 用 `resolve.alias` 把 `server-only` 指向一个空模块。
- 元：vitest@5.0.5、next@16.4.3 | 2026-10-31 | 候选毕业方向：无

### pnpm test 挂住不退出
- 症状：CI 或代理终端里 `vitest` 一直不结束。
- 根因：不带 `run` 时 vitest 默认进入监听模式。
- 规则：`"test": "vitest run"`。
- 元：vitest@5.0.5 | 2026-10-31 | 候选毕业方向：脚本（`package.json`）

