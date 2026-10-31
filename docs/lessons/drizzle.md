# lessons — Drizzle ORM（drizzle-orm、drizzle-kit）

> 适用版本：drizzle-orm@0.45.4、drizzle-kit@0.31.11（M3 安装）。以下条目来自 2026-10-31 对官网文档和这两个版本类型声明的核对，尚未在本项目代码里踩到。

### 官网文档默认是 1.0 RC 的写法
- 症状：照官网写 `snakeCase.table(…)`、`defineRelations(…)`、`migrate(db)`，在 0.45 上类型报错或不存在。
- 根因：官网安装命令已经是 `drizzle-orm@rc`，示例按 1.0 RC 写；本项目锁定 0.45.4。
- 规则：以 0.45.4 的类型声明为准：命名映射用 `drizzle({ client, schema, casing: 'snake_case' })`，关系用 `relations()`，迁移用 `migrate(db, { migrationsFolder })`。不确定时查 `node_modules/drizzle-orm/*.d.ts`。
- 元：drizzle-orm@0.45.4 | 2026-10-31 | 候选毕业方向：无（升级到 1.0 时整体重审本文件）

### 运行时和 drizzle-kit 的 casing 不一致
- 症状：迁移里的列名是 camelCase，运行时查询用 snake_case，报列不存在。
- 根因：`casing` 要在 `drizzle()` 和 `drizzle.config.ts` 两处分别设置。
- 规则：两处都写 `casing: 'snake_case'`；M3 首次生成迁移时检查 Better Auth 表的列名。
- 元：drizzle-orm@0.45.4、drizzle-kit@0.31.11 | 2026-10-31 | 候选毕业方向：无

### drizzle-kit 带进有安装脚本的 esbuild
- 症状：pnpm 11 安装 drizzle-kit 时提示有依赖的构建脚本未被允许。
- 根因：drizzle-kit 依赖 esbuild，esbuild 有 postinstall（Phase 3 传递依赖扫描）。
- 规则：安装前向负责人说明，再在 pnpm 的 `allowBuilds` 里只放行 esbuild。
- 元：drizzle-kit@0.31.11、pnpm@11.7.0 | 2026-10-31 | 候选毕业方向：无

