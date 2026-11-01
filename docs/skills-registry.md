# skills 注册表 — DayDayOn

> 本项目可引用的 skills 及必须调用的时机。创建 issue、拆 issue、提 PR 前**必须查本表**并调用对应 skill；issue / PR 正文注明引用了哪些 skill。
> 状态：2026-10-31 定稿。采用 demo-init 的默认绑定，并登记了本项目已在用的 skill；负责人要求全部定稿提交时没有提出修改，按本表执行。以后要增删，见文末"自定义"。

| skill | 用途 | 何时必须调用 | 引用要求 |
|---|---|---|---|
| `issue-creator` | 创建与拆解 issue（双层信息架构、sub-issue 规范） | 创建 issue、拆 issue、建子 issue 时 | issue 正文注明 |
| `issue-to-pr` | issue 驱动开发与 PR 创建（PR 与 issue 关联） | 根据 issue 做 PR 时。本项目 PR 目标分支是 `dev`，不是 `main` | PR 正文注明 |
| `git-commit` | Conventional Commits 提交信息 | 生成提交信息时（格式另由 commitlint 强制） | — |
| `ego-browser` | 浏览器端到端测试、截图 | 界面改动验收时（手机 390px、桌面 1280px 两种宽度） | PR 正文附截图或步骤 |
| `demo-init` | 项目初始化（对齐式流程） | 仅初始化或重走初始化流程时；日常开发不调用 | — |

## 自定义

负责人可以随时增删各方向常用的 skill。变更走批量结算，确认后更新本表。绑定的 skill 本体不在本仓库维护，本表只登记引用关系和调用时机。
