# docs/designs/

架构设计、UI 设计与组件库选型的决策现场。决策记录（ADR）本身在 [docs/adr/](../adr/README.md)。

## 现有文档

- [architecture-baseline.md](./architecture-baseline.md) — 架构基线 v0.1 快照（不再更新，各节去向见文件头）
- [reviews/](./reviews/) — Playbook 批注导出的 JSON
- [library-showcase/](./library-showcase/index.html) — 组件库对比页（demo-init Phase 3 生成，每个关注点一个 HTML）。负责人 2026-10-31 已全部拍板，这些页面作为决策现场归档，每页底部的决策历史记录了拍板结果。重新生成：`node scripts/dev/library-showcase/build.mjs`

UI 设计稿不单独画图，直接用代码写在 Playbook（`/dev/playbook`，规范见 [ui-design-system.md](../conventions/ui-design-system.md)）。
