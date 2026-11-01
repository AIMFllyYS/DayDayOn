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

### PostgreSQL 的 sum / count 聚合返回字符串，直接比较或加减会出错
- 症状：`sql<number>\`coalesce(sum(${col}), 0)\`` 运行时拿到的是 `'12000'`（string），做数值加法变成字符串拼接。
- 根因：`pg` 驱动把 PostgreSQL 的 `bigint` / `numeric`（`sum`、`count` 的返回类型）解析为 JS string 以防精度丢失，TypeScript 泛型 `<number>` 只是编译期断言。
- 规则：聚合列在 SQL 里显式 `::int`（不超过 2^31-1 时）或在 JS 侧套 `Number(row.total ?? 0)`。
- 元：drizzle-orm@0.45.4、pg@8.23.1 | 2026-11-01 | 候选毕业方向：无

### casing: 'snake_case' 下手写 sql 模板引用表字段仍要用列对象
- 症状：在 `sql\`...\`` 里手写驼峰列名报错列不存在。
- 根因：`casing: 'snake_case'` 只自动转换 Drizzle 生成的标识符，不解析原样字符串。
- 规则：`sql` 模板里一律插值列对象（如 `sql\`${quotaAccounts.bonusMicros} + ${delta}\``），由 Drizzle 映射为对应的 snake_case 列名。
- 元：drizzle-orm@0.45.4 | 2026-11-01 | 候选毕业方向：无

