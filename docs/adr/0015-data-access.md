# ADR-0015：数据访问——Drizzle ORM + drizzle-kit + pg

- 状态：Accepted（负责人 2026-10-31 拍板：Phase 3 的 17 项建议全部采纳）
- 日期：2026-10-31
- 决策人：项目负责人（AI 提供分析）
- 对比页：[docs/designs/library-showcase/12-data-access.html](../designs/library-showcase/12-data-access.html)

## 背景

- PostgreSQL 18（服务器 127.0.0.1:23432）
- TypeScript 写 schema，生成可审阅的 SQL 迁移文件
- 事务和原子更新（额度预占与结算）
- Better Auth 适配器

先定的层：SQL 风格的 ORM + 迁移工具；数据库驱动单独选。

## 面临的选项

- **Drizzle ORM 0.45 + drizzle-kit**（`drizzle-orm`）：推荐。和需求最贴合，运行时零依赖。
- **Drizzle ORM 1.0 RC**：备选。省掉以后一次升级，但生产环境不用 RC。
- **Prisma**（`prisma`）：不采用。需要生成步骤，稳定线不清晰。
- **Kysely**（`kysely`）：不采用。没有从 schema 生成迁移的能力。

## 决定

Drizzle ORM + drizzle-kit + pg，版本 drizzle-orm 0.45.4、drizzle-kit 0.31.11、pg 8.23.1。

- 封装层入口：src/server/db/（client.ts、schema/<领域>.ts、migrations/）；只有 src/server/ 可以 import drizzle-orm 和 pg
- 迁移用 drizzle-kit generate 生成并提交，PR 里审 SQL；生产环境不用 push
- Better Auth 的表用 npx auth generate 生成到 Drizzle schema

## 理由

和需求最贴合，运行时零依赖。

- drizzle-orm 0 个依赖
- drizzle-kit generate 生成 SQL 迁移
- Better Auth 的 peer 依赖接受 drizzle-orm ^0.45.2 或 1.0 RC

## 放弃了什么

- Drizzle 1.0 RC：生产不用 RC
- Prisma：latest 指向 RC
- Kysely：没有迁移生成

已知代价：1.0 稳定后需要升级一次（drizzle-kit up）。

## 何时重审

- Drizzle 1.0 发布稳定版时
