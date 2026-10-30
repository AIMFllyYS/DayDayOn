# Git 工作流

> 提交信息格式由 commitlint 强制，分支保护由 GitHub 强制。本文说明规则和原因。

## 分支

| 分支 | 用途 | 规则 |
|---|---|---|
| `main` | 生产分支，GitHub 默认分支 | 只接受来自 `dev` 的发布 PR 和 `hotfix/*`；合并后自动部署 |
| `dev` | 开发集成分支 | 所有工作分支的 PR 目标 |
| `feat/<issue号>-<简述>` | 新功能 | 从 `dev` 切出 |
| `fix/…` `refactor/…` `docs/…` `chore/…` `ci/…` `test/…` | 其他工作 | 从 `dev` 切出 |
| `hotfix/<简述>` | 线上紧急修复 | 从 `main` 切出，合回 `main` 后再合回 `dev` |

示例：`feat/12-diet-photo-checkin`、`fix/31-streak-timezone`。

## 合并

- 工作分支 → `dev`：**squash merge**，一个 PR 在 `dev` 上留一个提交。
- `dev` → `main`：**merge commit**，保留发布边界。**必须得到项目负责人对这一次合并的明确同意**，AI 代理不得自行合并或推送 `main`。
- 合并后自动删除工作分支。
- `main`、`dev` 均开启分支保护：禁止 force push 和删除，必须通过 PR 合并，CI 必须通过。

## 提交信息

格式：

```
type(scope): 中文描述

可选正文：说明为什么这样改

可选脚注：Closes #12
```

- `type` 与 `scope` 用英文小写；描述用中文，不超过 72 个字符，不以句号结尾。
- `type`：`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`
- 破坏性变更：`feat(api)!: …`，或在脚注写 `BREAKING CHANGE: …`
- `scope` 只能用 `commitlint.config.mjs` 里的白名单，新增 scope 时同步修改该文件。
- 一个提交只做一件事。

示例：

```
feat(diet): 支持拍照识别饮食并生成草稿
fix(quota): 修复并发请求重复预占额度
docs(deploy): 补充回滚步骤
```

## Git hooks（lefthook）

`pnpm install` 时自动安装：

- **pre-commit**：对暂存文件运行 ESLint `--fix`、Prettier `--write`（修复结果自动加入暂存区），以及 gitleaks 密钥扫描（本机没有 gitleaks 时跳过，CI 会再扫）。
- **commit-msg**：commitlint 检查提交信息。

不要用 `--no-verify` 跳过。

## Issue 与 PR

- 创建 issue、拆分子 issue：使用 issue-creator skill。
- 按 issue 做 PR：使用 issue-to-pr skill，**PR 目标分支是 `dev`**，正文末尾写 `Closes #<issue号>`。
- PR 描述写清楚：改了什么、为什么、怎么验证的（含 ego-browser 截图或步骤）。

## 版本与发布

- 0.x 阶段使用 SemVer：新功能升 minor，修复升 patch。
- 每次 `dev` → `main` 发布后打 tag `vX.Y.Z`，更新说明写在 `docs/updates/`。
- 回滚：`git revert` 有问题的提交，再走一次发布 PR。
