# DayDayOn

和朋友一起每天打卡：运动、饮食、睡眠、学习，以及你自己定义的小目标。

手机、电脑都能用，可以安装到桌面（PWA）。拍照或上传截图后，AI 帮你识别并整理成记录；图片本身不会上传保存。

> 状态：初始化阶段（v0.1.0），功能尚未上线。

## 规划中的功能

- **五类打卡**：运动（AI 估算消耗热量，可上传运动软件记录）、饮食（拍照识别、热量缺口）、睡眠（手动或截图解析）、学业规划（逐条记录）、其他目标（自定义表单或自定义 AI 解析）
- **评估指标**：每天按板块打满意度分，体重等精确指标
- **待办**：to-do 清单与 DDL，可切换为时间日志
- **仪表盘**：汇总各项指标，可自定义布局
- **排行榜**：所有用户进入总榜，可以选择是否公开

## 技术栈

Next.js 16 · React 19 · TypeScript 6 · Tailwind CSS 4 · PostgreSQL 18 · Drizzle ORM · Better Auth · AI SDK 7 + DeepSeek

## 本地开发

需要 Node 24 和 pnpm 11（`corepack enable` 后会按 `packageManager` 字段自动使用正确版本）。

```powershell
pnpm install
pnpm dev
```

提交前会自动运行 ESLint、Prettier 和密钥扫描；提交信息需符合 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)。

## 文档

- [AGENTS.md](./AGENTS.md) — 开发规范索引（AI 编码代理与人类开发者共用）
- [docs/](./docs/) — 规范、设计决策、运维文档
