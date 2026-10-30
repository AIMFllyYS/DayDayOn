# docs/conventions/

项目规范。格式、lint、提交信息由工具强制，这里只写工具管不到的约定和背后的理由。

## 现有文档

- [project-structure.md](./project-structure.md) — 目录结构与分层规则
- [code-size-and-organization.md](./code-size-and-organization.md) — 代码长度与文件组织（长度阈值、colocation 原则、拆分判断方法）
- [nextjs-16-patterns.md](./nextjs-16-patterns.md) — Next.js 16.4 关键模式与陷阱（proxy.ts、async API、Cache Components、standalone）
- [code-style.md](./code-style.md) — 代码风格
- [code-review.md](./code-review.md) — Code review 检查清单
- [git-workflow.md](./git-workflow.md) — 分支、提交、PR、发布
- [ports.md](./ports.md) — 端口约定（应用 23329、数据库 23432）及所有引用位置

## 与 AGENTS.md 的关系

`AGENTS.md` 是给 AI 编码代理的精简索引；本目录是完整规范。两边内容要一致，冲突时以代码和工具配置为准，并在同一次改动里修正文档。
