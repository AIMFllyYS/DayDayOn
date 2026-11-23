# 数据库与迁移规范

> 日期：2026-10-31（2026-11-16 对齐最新实现） · 状态：已按最新服务端代码与部署脚本核对同步。踩坑经验见 [lessons/drizzle.md](../lessons/drizzle.md)。
> 依据：[ADR-0015](../adr/0015-data-access.md)（Drizzle ORM 0.45 + pg）、[ADR-0001](../adr/0001-ecosystem-or-standalone.md)（本机 PostgreSQL 18）、[ADR-0002](../adr/0002-account-quota-risk.md) 第 5 节（额度账本）。
> 官方资料（2026-10-31 抓取）：drizzle-orm@0.45.4 与 drizzle-kit@0.31.11 的类型声明、Drizzle 迁移文档、Better Auth 的 Drizzle 适配器与性能指南、[PostgreSQL 18 发布说明](https://www.postgresql.org/docs/18/release-18.html)（`uuidv7()`）。
> **注意**：Drizzle 官网现在默认展示 1.0 RC 的写法（安装命令带 `@rc`、`snakeCase.table`、`defineRelations`、`migrate(db)` 不带参数）。本项目锁定 0.45.4，照抄官网前先读 [lessons/drizzle.md](../lessons/drizzle.md)。

## 1. 连接

- 只有 `src/server/`（以及 `drizzle.config.ts`、`scripts/`）可以 import `drizzle-orm` 和 `pg`。
- `src/server/db/client.ts` 通过 `Proxy` 懒初始化并导出全项目唯一的 `db`（以及事务类型 `Tx`、`DbOrTx`）：

```ts
// src/server/db/client.ts（核心结构）
import 'server-only'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { env } from '@/server/env'
import * as schema from './schema'

const globalForDb = globalThis as typeof globalThis & { __daydayonPool?: Pool }
let pool: Pool | undefined = globalForDb.__daydayonPool
let instance: NodePgDatabase<typeof schema> | undefined

function getDb(): NodePgDatabase<typeof schema> {
  if (instance) return instance
  pool ??= new Pool({ connectionString: env.DATABASE_URL, max: 10 })
  if (process.env.NODE_ENV !== 'production') globalForDb.__daydayonPool = pool
  instance = drizzle({ client: pool, schema, casing: 'snake_case' })
  return instance
}

export const db: NodePgDatabase<typeof schema> = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, key) {
    const real = getDb()
    const value: unknown = Reflect.get(real, key, real)
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value
  },
})
```

- 为什么用 `Proxy` 懒初始化：首次访问 `db` 属性时才创建 `Pool` 并读取 `env.DATABASE_URL`，`next build` 或单元测试加载模块时不触发环境变量校验、不建连。
- `drizzle.config.ts` 里同样写 `casing: 'snake_case'`。两处必须一致，否则生成的迁移和运行时的列名对不上。
- 开发环境热更新会重复执行模块，把 `pool` 挂在 `globalThis`（`__daydayonPool`）上复用，避免连接数涨满。
- 连接串只从 `src/server/env.ts`（zod 校验过的环境变量）读取。本地和服务器都是 `127.0.0.1:23432`（[ports.md](./ports.md)）。
- 连接池上限 10。数据库容器限制 512 MB 内存，不要调大。

## 2. 目录与表清单

```
src/server/db/
├── client.ts           Proxy 懒初始化 db，导出 Tx / DbOrTx
├── startup-migrate.ts  生产启动钩子调用的幂等迁移入口 runStartupMigrations()
├── schema/
│   ├── index.ts        汇总导出 15 个业务与鉴权表模块
│   ├── columns.ts      共用列：id（uuidv7）、timestamps（createdAt / updatedAt）、timestamptz
│   ├── auth-indexes.ts 手动索引扩展位（当前为空占位 `export {}`，见第 8 节）
│   ├── auth.ts         Better Auth CLI 生成的 6 张表（只通过 CLI 重新生成，不手改）
│   └── <领域>.ts       14 个业务领域模块（共 30 张业务表）
└── migrations/         drizzle-kit generate 产出的 SQL 与 meta/ 快照，全部提交
drizzle.config.ts       schema: ./src/server/db/schema，out: ./src/server/db/migrations，dialect: postgresql
scripts/dev/migrate.ts  本地执行迁移（pnpm db:migrate）
scripts/dev/seed.ts     本地假数据（pnpm db:seed）
```

当前 `schema/` 下 16 个核心模块（15 个表模块 + `columns.ts`，另有 `index.ts` 与空占位 `auth-indexes.ts`）与全部 39 张表：

| 模块文件 | 数据表（`pgTable`） | 说明 |
|---|---|---|
| `columns.ts` | — | 共用列 `id`（`uuidv7()`）、`timestamps`、`timestamptz` |
| `auth.ts` | `user`、`session`、`account`、`verification`、`two_factor`、`rate_limit` | Better Auth CLI 自动生成 |
| `auth-indexes.ts` | — | 空占位（`export {}`），预留未来手补索引 |
| `profiles.ts` | `profiles` | 用户资料、时区、引导完成时间、注册/最近登录 IP |
| `quota.ts` | `quota_accounts`、`quota_ledger`、`redeem_codes`、`account_tombstones`、`redeem_attempts` | 额度账户、流水、兑换码、注销防薅快照、兑换试错记录 |
| `goals.ts` | `goals`、`goal_targets`、`goal_field_versions` | 目标、目标量历史、自定义字段版本 |
| `checkins.ts` | `checkins`、`checkin_revisions`、`body_metrics`、`daily_ratings`、`step_metrics` | 打卡、留痕、体重、日评、步数 |
| `todos.ts` | `todo_groups`、`todo_tags`、`todos`、`todo_events` | 待办自定义分组（含默认「默认待办」）、标签词库、待办条目（四象限/2000 字备注/30 天懒归档/排序）与过程事件流 |
| `ai.ts` | `ai_runs`、`ai_daily_spend` | AI 调用记录（含幂等键）、全站每日花费聚合 |
| `agent.ts` | `agent_conversations`、`agent_messages` | Agent 对话与消息历史 |
| `friends.ts` | `friend_invites`、`friendships` | 好友邀请与好友关系 |
| `chat.ts` | `chat_messages` | 好友私聊消息 |
| `pet-interactions.ts` | `friend_pet_interactions` | 好友宠物互动（投喂/加油） |
| `notifications.ts` | `notifications` | 站内通知 |
| `announcements.ts` | `announcements`、`announcement_reads` | 全站公告与已读记录 |
| `moderation.ts` | `moderation_violations` | 内容合规拦截与禁言记录 |
| `platform.ts` | `app_settings`、`rate_limit_counters`、`idempotency_keys`、`admin_audit_logs`、`alerts_sent` | 全站配置、限流/人机 nonce 计数、幂等键、后台审计、告警去重 |

## 3. 命名

- 业务表名：snake_case 复数，`goals`、`checkins`、`ai_runs`、`quota_ledger`。
- Better Auth 的表保留 CLI 生成的名字（`user`、`session`、`account`、`verification`、`two_factor`、`rate_limit`），不改 `usePlural`，这样升级时重新生成的 diff 最小。
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

- 业务表展开 `...id`、`...timestamps`（`createdAt` 与 `updatedAt`）；自然主键表（`app_settings`、`ai_daily_spend`、`rate_limit_counters`、`alerts_sent`）只展开 `...timestamps`。
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

- 额度预占、结算、释放、兑换码兑换、周期重置都在 `db.transaction(async (tx) => { … })` 里完成，写函数一律接收 `tx: Tx`，事务内只用 `tx`，不混用 `db`。
- 余额变动用带条件的原子更新：`UPDATE … SET balance = balance - $x WHERE user_id = $u AND balance >= $x RETURNING …`，没有返回行就是余额不足。禁止"先 SELECT 余额、在 JS 里判断、再 UPDATE"。
- 每次余额变动在同一事务里写一条 `quota_ledger` 流水。流水只增不改，余额可以由流水重算。
- 幂等键表有唯一约束 `(user_id, key)`，插入冲突即重复请求（[api-conventions.md](./api-conventions.md) 第 9 节）。
- 周期重置：读写额度行时比较 `period_key`，不同就在同一事务里先重置再操作（[ADR-0020](../adr/0020-jobs.md)）。周期键由 `src/server/quota/period.ts` 计算。

## 7. 迁移

- 本地流程：改 `schema/*.ts` → `pnpm db:generate`（`drizzle-kit generate`）→ 读一遍生成的 SQL → 本地 `pnpm db:migrate`（`scripts/dev/migrate.ts`）→ 提交 schema 和 `migrations/`。
- **禁止 `drizzle-kit push`**，本地也不用。所有环境都走 generate + migrate，保证迁移文件和真实库一致。
- 生成的迁移文件不手改。还没合并的迁移要改，就删掉重新生成；已经合并进 `dev` 的迁移只增不改。
- 改列名、删列分两次发布：先加新列并双写，再删旧列。`drizzle-kit generate` 询问"是否重命名"时按实际情况回答，并在 PR 里写明。
- 程序里执行迁移用 0.45 的 `migrate(db, { migrationsFolder })`（`drizzle-orm/node-postgres/migrator`），`migrationsFolder` 是必填参数。
- **生产迁移机制**：
  1. `scripts/build/pack-artifact.sh` 把 `src/server/db/migrations/` 一并打进 standalone 部署制品；
  2. `scripts/deploy/daydayon-deploy-gate.sh` 在切换 `app` 并重启 PM2 前，先调用 `/mnt/data/daydayon/compose/backup-db.sh`（`pg_dump -Fc`）完成一次热备份；
  3. 服务启动时，Next.js 的 `src/instrumentation.ts`（`register()` 在 `NEXT_RUNTIME === 'nodejs' && NODE_ENV === 'production'` 时）动态导入 `src/server/db/startup-migrate.ts` 并调用 `runStartupMigrations()`，幂等执行未应用的 SQL 迁移；若迁移失败导致启动异常，闸门 `/api/health` 健康检查不通过并自动回滚至 `app.prev`。
- 新增或修改迁移以及任何服务器操作属于"先问再做"（AGENTS.md Boundaries）。

## 8. Better Auth 的表

- 因 `auth@1.7.14` 的 CLI 使用 `jiti` 加载配置，无法解析 `import 'server-only'` 与 `@/` 路径别名，故使用独立无服务端依赖的 CLI 配置入口 `src/server/auth/auth.cli.ts`（其 `plugins` 列表必须与 `src/server/auth/auth.ts` 保持一致）。
- 生成命令（版本必须与 `package.json` 中的 `better-auth` 一致，不用 `npx auth@latest`）：
  ```powershell
  pnpm dlx auth@1.7.14 generate --config src/server/auth/auth.cli.ts --output src/server/db/schema/auth.ts --yes
  ```
- 生成后照常走 `pnpm db:generate` 出迁移。不用 Better Auth 的 `migrate` 命令（它只支持内置的 Kysely 适配器）。
- 升级 Better Auth 或增删插件后重新生成，在 PR 里审 diff。
- `auth@1.7.14` CLI 已实测会自动生成性能指南所需的索引（`session_userId_idx`、`account_userId_idx`、`verification_identifier_idx`、`twoFactor_secret_idx`、`twoFactor_userId_idx`，以及 `user.email`、`session.token`、`rate_limit.key` 的唯一约束），因此 `src/server/db/schema/auth-indexes.ts` 当前为空占位文件（`export {}`）。后续若需给 Better Auth 表追加额外索引，写到 `auth-indexes.ts`，不手改 `auth.ts`。

## 9. 本地数据库

- Docker 运行 `postgres:18.6-alpine3.24`，绑定 `127.0.0.1:23432`，与服务器同版本（[local-setup.md](../ops/local-setup.md)）。
- 种子数据：`pnpm db:seed`，只造假数据。生产数据不拉到本地。

## 10. 工具强制

| 规则 | 形式 | 状态 |
|---|---|---|
| `drizzle-orm`、`pg` 只能在 `src/server/`、`drizzle.config.ts`、`scripts/` import | ESLint `no-restricted-imports`（`eslint.config.mjs`） | 已落地 |
| `package.json` 脚本：`db:generate`、`db:migrate`、`db:seed`（不提供 `db:push`） | 脚本即约定 | 已落地 |
| 迁移文件与 schema 一致 | CI 跑 `drizzle-kit generate`，有新文件产生就失败 | 待补入 `.github/workflows/ci.yml` |


