# ADR-0013：数据校验——zod

- 状态：Accepted（负责人 2026-10-31 拍板：Phase 3 的 17 项建议全部采纳）
- 日期：2026-10-31
- 决策人：项目负责人（AI 提供分析）
- 对比页：[docs/designs/library-showcase/10-validation.html](../designs/library-showcase/10-validation.html)

## 背景

- 接口入参与出参
- AI 结构化输出
- 环境变量
- 表单
- 自定义目标的字段 schema

先定的层：服务端和浏览器共用一个 schema 库。

## 面临的选项

- **zod 4**（`zod`）：推荐。生态一致，一个 schema 库贯穿前后端。
- **Valibot**（`valibot`）：备选。体积最小，但其他依赖都用 zod，会变成两个校验库。
- **ArkType**（`arktype`）：不采用。生态不匹配。

## 决定

zod，版本 4.6.7。

- 封装层入口：无封装层（工具库豁免）；schema 放在 src/features/<领域>/schemas.ts
- 统一写 `import * as z from "zod"`；ESLint 用 no-restricted-syntax 禁止 `import { z } from "zod"`
- 浏览器端体积吃紧时，纯客户端 schema 可以改用 zod/mini

## 理由

生态一致，一个 schema 库贯穿前后端。

- AI SDK、Better Auth（直接依赖 zod）、@hono/zod-openapi（peer zod ^4）都以 zod 为中心
- 0 个依赖

## 放弃了什么

- Valibot：和生态里的 zod 重复
- ArkType：生态不匹配

已知代价：客户端校验约 25 KB。

## 何时重审

- 客户端 JS 超预算时（评估 zod/mini）
