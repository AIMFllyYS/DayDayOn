# docs/

项目内部文档目录。

| 目录 | 用途 |
|---|---|
| [`plans/`](./plans/) | 项目计划、路线图、里程碑 |
| [`conventions/`](./conventions/) | 项目规范、编码约定、Git 工作流 |
| [`updates/`](./updates/) | 版本更新说明 |
| [`specs/`](./specs/) | 功能规格（PRD）、接口规格 |
| [`audits/`](./audits/) | 审计报告（性能、安全、代码） |
| [`ops/`](./ops/) | 本地开发、部署 |
| [`issues/`](./issues/) | 已知问题与技术债 |
| [`designs/`](./designs/) | 架构设计与决策记录（ADR） |

## 文档规范

- Markdown 格式，文件名用 kebab-case（如 `diet-checkin-spec.md`）
- 文档开头注明日期与状态
- 规格文档（specs/）包含背景、目标、方案、风险
- 设计文档（designs/）包含问题、方案对比、最终决策、决策理由；决策记录命名为 `adr-<四位编号>-<主题>.md`
- 文档与代码冲突时以代码为准，并在同一次改动里修正文档
- 淘汰的文档移到 `docs/archive/`，不要直接删除
