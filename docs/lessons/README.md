# docs/lessons/ — 踩坑经验库

> 一库一文件（`<lib>.md`），平台和环境的坑也各一文件（如 `aliyun-ecs.md`、`windows-powershell.md`）。
> AI 使用某个库或平台写代码前，**对应的 lessons 文件存在则必读**。

## 现有文件

| 文件 | 范围 |
|---|---|
| [nextjs.md](./nextjs.md) | Next.js 16.4 |
| [pnpm.md](./pnpm.md) | pnpm 11.7 |
| [windows-powershell.md](./windows-powershell.md) | 本地 Windows PowerShell 5.1 环境，以及从它调用 ssh / gh |
| [aliyun-ecs.md](./aliyun-ecs.md) | 服务器 MainECS：Docker 镜像源、部署闸门脚本、bash 运维 |
| [base-ui.md](./base-ui.md) | Base UI 1.9（交互原语、Toast、Form / Field） |
| [react-day-picker.md](./react-day-picker.md) | React DayPicker 10 |
| [date-fns.md](./date-fns.md) | date-fns 4 与 @date-fns/tz |
| [tanstack-query.md](./tanstack-query.md) | TanStack Query 5 |
| [zod.md](./zod.md) | zod 4 |
| [better-auth.md](./better-auth.md) | Better Auth 1.7 |
| [drizzle.md](./drizzle.md) | Drizzle ORM 0.45、drizzle-kit 0.31 |
| [hono.md](./hono.md) | Hono 4、@hono/zod-openapi 1.6 |
| [nodemailer.md](./nodemailer.md) | Nodemailer 10 |
| [vitest.md](./vitest.md) | Vitest 5 + Vite 8 |
| [ai-sdk.md](./ai-sdk.md) | AI SDK 7、@ai-sdk/deepseek、DeepSeek API |
| [turnstile.md](./turnstile.md) | 自托管手账点选人机验证（`turnstile.tsx` / `captcha.ts`，原 Cloudflare Turnstile 迁移经验） |

不需要单独文件的：`d3-shape` 只在 `src/components/charts/` 里用到 4 个函数，踩到坑时再建。不引入库的关注点（动效、表单、图片压缩、PWA、定时任务）的规则写在对应规范里。

**预置条目**：2026-10-31 新建的 11 个库文件里的条目，是 Phase 3 调研和编写规范时对照官方文档核实的已知坑，还没有在本项目代码里真正踩到，文件头部都有说明。实战中证实的保留，被推翻的删除。

## 写入触发器（常驻规则）

凡"AI 因对某库或平台的错误认知出错、后来被修正"的事件，修正后必须申请追加一条。

## 条目格式（一条 ≤ 5 行）

```
### <一句话坑名>
- 症状：<什么报错 / 什么异常行为>
- 根因：<对库的什么错误假设>
- 规则：<今后必须怎么做（具体禁令措辞）>
- 元：<库名@版本 | 日期 | 候选毕业方向：lint / 封装层 / 脚本 / 无>
```

## 同意机制

条目先落为未提交的 diff，会话收尾时批量结算，负责人确认后才 commit。被拒的条目直接丢弃。

## 压缩与毕业

- 单个文件超过 20 条 → 下次会话先合并同类、删除过期条目（也走确认）。
- 升级某个库的大版本 → 重审该库的全部条目（坑可能已经被上游修掉）。
- 能落成 lint / CI 规则或脚本的 → 毕业成硬约束，从本库删除。
- 反复出现的第三方调用姿势问题 → 收进封装层，从本库删除。
- 毕业一条删一条：文档保持精瘦，约束的形态持续升级。

已经毕业、不再记录的例子：`tsc` 找不到 `LayoutProps`（已固化为 `pnpm typecheck` = `next typegen && tsc --noEmit`）；lefthook 在无 TTY 环境卡住和多行 shell 在 Windows 报错（已固化为 `no_tty: true` 和 `scripts/dev/gitleaks-staged.mjs`）。
