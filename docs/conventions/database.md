# 数据库与迁移规范

> 日期：2026-10-31 · 状态：初版。本文档由初始化时联网调研生成，条目未经实战验证，踩坑后按 [lessons 机制](../lessons/README.md)修订。
> 依据：[ADR-0015](../adr/0015-data-access.md)（Drizzle ORM 0.45 + pg）、[ADR-0001](../adr/0001-ecosystem-or-standalone.md)（本机 PostgreSQL 18）、[ADR-0002](../adr/0002-account-quota-risk.md) 第 5 节（额度账本）。
> 官方资料（2026-10-31 抓取）：drizzle-orm@0.45.4 与 drizzle-kit@0.31.11 的类型声明、Drizzle 迁移文档、Better Auth 的 Drizzle 适配器与性能指南、[PostgreSQL 18 发布说明](https://www.postgresql.org/docs/18/release-18.html)（`uuidv7()`）。
> **注意**：Drizzle 官网现在默认展示 1.0 RC 的写法（安装命令带 `@rc`、`snakeCase.table`、`defineRelations`、`migrate(db)` 不带参数）。本项目锁定 0.45.4，照抄官网前先读 [lessons/drizzle.md](../lessons/drizzle.md)。

## 1. 连接

- 只有 `src/server/` 可以 import `drizzle-orm` 和 `pg`。
- `src/server/db/client.ts` 导出全项目唯一的 `db`：

```ts
import 'server-only'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { env } from '@/server/env'
import * as schema from './schema'

const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 })

export const db = drizzle({ client: pool, schema, casing: 'snake_case' })
```

- `drizzle.config.ts` 里同样写 `casing: 'snake_case'`。两处必须一致，否则生成的迁移和运行时的列名对不上。
- 开发环境热更新会重复执行模块，把 `pool` 挂在 `globalThis` 上复用，避免连接数涨满。
- 连接串只从 `src/server/env.ts`（zod 校验过的环境变量）读取。本地和服务器都是 `127.0.0.1:23432`（[ports.md](./ports.md)）。
- 连接池上限 10。数据库容器限制 512 MB 内存，不要调大。

## 2. 目录

```
src/server/db/
├── client.ts
├── schema/
│   ├── index.ts        汇总导出
│   ├── auth.ts         Better Auth CLI 生成的表（只通过 CLI 重新生成，不手改）
│   ├── columns.ts      共用列：id、createdAt、updatedAt
│   └── <领域>.ts       goals.ts、checkins.ts、quota.ts、admin.ts…
└── migrations/         drizzle-kit generate 产出的 SQL 与快照，全部提交
drizzle.config.ts       schema: ./src/server/db/schema，out: ./src/server/db/migrations，dialect: postgresql
scripts/dev/seed.ts     本地假数据
```

## 3. 命名

- 业务表名：snake_case 复数，`goals`、`checkins`、`ai_runs`、`quota_ledger`。
- Better Auth 的表保留 CLI 生成的名字（`user`、`session`、`account`、`verification` 等单数名），不改 `usePlural`，这样升级时重新生成的 diff 最小。
- 列名：TypeScript 里写 camelCase，由 `casing: 'snake_case'` 自动映射成 snake_case。业务表不手写列名字符串。
- 外键列：`<实体>Id`（库里是 `<实体>_id`）。
- 索引与约束显式命名：`<表>_<列>_idx`、`<表>_<列>_key`。

## 4. 列类型

| 内容 | Drizzle 写法 | 说明 |
|---|---|---|
| 业务表主键 | `uuid().primaryKey().default(sql\`uuidv7()\`)` | PostgreSQL 18 内置 `uuidv7()`，按时间递增，索引友好，也方便游标分页 |
| 引用用户 | `text().notNull().references(() => user.id, { onDelete: 'cascade' })` | Better Auth 的用户 id 是字符串 |
| 时间点 | `timestamp({ withTimezone: true })` | 即 `timestamptz`，存 UTC 时刻 |
| 本地日期 | `date({ mode: 'string' })` | 打卡日，由 `src/lib/time/` 算好再写入，不在 SQL 里从时间点换算 |
| 金额 | `bigint({ mode: 'number' })` | 整数微元。不用 `numeric`，不用浮点 |
| 时长、热量、体重 | `integer()` | 秒、千卡、克 |
| 枚举 | `text().$type<'a' \| 'b'>()` + zod 校验 | 不用 `pgEnum`：给枚举加值也要迁移，回滚麻烦 |
| 自定义目标的字段定义、动态表单的值 | `jsonb().$type<…>()` | 写入前用 zod 校验；只放这类真正结构不固定的数据 |
| 布尔 | `boolean().notNull().default(false)` | |

- 每张业务表都有 `createdAt`（`notNull().defaultNow()`）和 `updatedAt`（`notNull().defaultNow().$onUpdate(() => new Date())`），从 `columns.ts` 展开。
- 列默认 `notNull()`；允许为空的列在 schema 里注释原因。
- 默认硬删除，用户注销时级联删除其数据。`ai_runs`、`quota_ledger`、管理员操作记录只增不删（账本和审计）。

## 5. 查询

- 查询写在 `src/server/services/`（领域复杂时拆出 `services/<领域>/repo.ts`）。路由层、组件、`src/lib/` 不写查询。
- 用户数据的每条查询都带 `userId` 条件。
- 只取需要的列（`db.select({ … })`）。接口不返回整行。
- 列表查询必须有 `limit`。
- 原生 SQL 只用 `sql` 模板标签（自动参数化），禁止字符串拼接 SQL。
- 关系查询（`db.query.<表>.findMany({ with })`）用 0.45 的 relations v1：`relations()`。不要照抄官网 1.0 的 `defineRelations`。Better Auth 默认的 Drizzle 适配器同样使用 relations v1。

## 6. 事务与并发（额度账本）

- 额度预占、结算、释放、兑换码兑换、周期重置都在 `db.transaction(async (tx) => { … })` 里完成，事务内只用 `tx`，不混用 `db`。
- 余额变动用带条件的原子更新：`UPDATE … SET balance = balance - $x WHERE user_id = $u AND balance >= $x RETURNING …`，没有返回行就是余额不足。禁止"先 SELECT 余额、在 JS 里判断、再 UPDATE"。
- 每次余额变动在同一事务里写一条 `quota_ledger` 流水。流水只增不改，余额可以由流水重算（对账脚本在 v0.2 写）。
- 幂等键表有唯一约束 `(user_id, key)`，插入冲突即重复请求（[api-conventions.md](./api-conventions.md) 第 9 节）。
- 周期重置：读写额度行时比较 `period_key`，不同就在同一事务里先重置再操作（[ADR-0020](../adr/0020-jobs.md)）。周期键由 `src/server/quota/period.ts` 计算。

## 7. 迁移

- 流程：改 `schema/*.ts` → `pnpm db:generate`（`drizzle-kit generate`）→ 读一遍生成的 SQL → 本地 `pnpm db:migrate` → 提交 schema 和 `migrations/`。
- **禁止 `drizzle-kit push`**，本地也不用。所有环境都走 generate + migrate，保证迁移文件和真实库一致。
- 生成的迁移文件不手改。还没合并的迁移要改，就删掉重新生成；已经合并进 `dev` 的迁移只增不改。
- 改列名、删列分两次发布：先加新列并双写，再删旧列。`drizzle-kit generate` 询问"是否重命名"时按实际情况回答，并在 PR 里写明。
- 程序里执行迁移用 0.45 的 `migrate(db, { migrationsFolder })`（`drizzle-orm/node-postgres/migrator`），`migrationsFolder` 是必填参数。
- 生产迁移在部署闸门切换版本前执行，失败则不切换；执行前先做一次数据库备份。闸门脚本的改动在 M3 设计，属于服务器操作，先问。
- 新增或修改迁移本身也属于"先问再做"（AGENTS.md Boundaries）。

## 8. Better Auth 的表

- 用 Better Auth CLI 生成到 `src/server/db/schema/auth.ts`：`pnpm dlx auth@<与 better-auth 相同的版本> generate`（CLI 的包名是 `auth`，参数以 Better Auth CLI 文档为准）。不用 `npx auth@latest`，版本必须和项目里的 `better-auth` 一致。
- 生成后照常走 `drizzle-kit generate` 出迁移。不用 Better Auth 的 `migrate` 命令（它只支持内置的 Kysely 适配器）。
- 升级 Better Auth 或增删插件后重新生成，在 PR 里审 diff。
- Better Auth CLI 暂不生成索引。按其性能指南手动加：`session.userId`、`session.token`、`account.userId`、`verification.identifier`。手动加的索引写在 `schema/auth-indexes.ts`，不改 CLI 生成的文件。
- M3 首次生成时要实测：CLI 读取 `src/server/auth/auth.ts` 时能否解析 `@/` 路径别名和 `import 'server-only'`。不能的话，给 CLI 单独准备一个不含这两者的配置入口，并记入 lessons/better-auth.md。

## 9. 本地数据库

- Docker 运行 `postgres:18.6-alpine3.24`，绑定 `127.0.0.1:23432`，与服务器同版本（[local-setup.md](../ops/local-setup.md)）。
- 种子数据：`pnpm db:seed`，只造假数据。生产数据不拉到本地。

## 10. 工具强制（待落地，M3）

| 规则 | 形式 |
|---|---|
| `drizzle-orm`、`pg` 只能在 `src/server/` import | ESLint `no-restricted-imports` |
| `package.json` 脚本：`db:generate`、`db:migrate`、`db:seed` | 脚本即约定，不提供 `db:push` |
| 迁移文件与 schema 一致 | CI 跑 `drizzle-kit generate`，有新文件产生就失败 |

