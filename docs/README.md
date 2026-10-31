# docs/

项目内部文档目录。结构按 demo-init 新版：八个目录，加四件"活文档"（自进化机制）。

| 目录 / 文件 | 用途 |
|---|---|
| [`plans/`](./plans/) | 项目计划、路线图、里程碑 |
| [`conventions/`](./conventions/) | 项目规范、编码约定、Git 工作流 |
| [`updates/`](./updates/) | 版本更新说明 |
| [`specs/`](./specs/) | 功能规格（PRD）、接口规格 |
| [`audits/`](./audits/) | 审计报告（性能、安全、代码） |
| [`ops/`](./ops/) | 本地开发、部署 |
| [`issues/`](./issues/) | 已知问题与技术债 |
| [`designs/`](./designs/) | 架构设计、UI 设计、组件库对比页 |
| [`adr/`](./adr/README.md) | 架构决策记录：当时为什么这么选 |
| [`lessons/`](./lessons/README.md) | 踩坑经验库：这个库有什么坑 |
| [`libraries.md`](./libraries.md) | 组件库注册表：每个关注点的所有者是谁 |
| [`skills-registry.md`](./skills-registry.md) | skills 注册表：什么时候必须调用哪个 skill |

## 文档规范

- Markdown 格式，文件名用 kebab-case（如 `diet-checkin-spec.md`）
- 文档开头注明日期与状态
- 规格文档（specs/）包含背景、目标、方案、风险
- 决策记录放 `adr/`，命名 `NNNN-<slug>.md`，用 ADR 模板（见 [adr/README.md](./adr/README.md)）
- 写规范前先读 [conventions/README.md](./conventions/README.md) 的元规范：写具体禁令，标明约束强度
- lessons、规范、ADR、libraries.md 的修改走批量结算：先留作未提交 diff，会话末尾负责人确认后再提交
- 文档与代码冲突时以代码为准，并在同一次改动里修正文档
- 淘汰的文档移到 `docs/archive/`，不要直接删除
