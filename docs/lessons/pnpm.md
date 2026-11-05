# lessons — pnpm

### 在代理的非交互终端里 pnpm 命令会挂住
- 症状：`pnpm add` / `pnpm install` 没有输出，一直到超时被中断。
- 根因：以为 pnpm 11 在没有 TTY 时会自动用默认值；实际会停在交互确认上。
- 规则：AI 代理执行任何 pnpm 命令前先设 `$env:CI = "true"`；耗时较长的安装用后台进程跑并轮询输出。
- 元：pnpm@11.7.0 | 2026-10-31 | 候选毕业方向：无（已写进 AGENTS.md Shell Environment）

### 安装被中断后再装报 EEXIST symlink
- 症状：`ERR_PNPM_EEXIST ... symlink ... file already exists`。
- 根因：以为 pnpm 能从中断的半成品状态续装；上一次中断留下的 `node_modules/.pnpm` 链接不完整。
- 规则：出现 EEXIST 时删除 `node_modules` 后重装；不要删 `pnpm-lock.yaml`。
- 元：pnpm@11.7.0 | 2026-10-31 | 候选毕业方向：无


### git worktree 里第一次提交，pre-commit 报 EPERM unlink esbuild
- 症状：lefthook 的 eslint 和 prettier 两个任务同时触发 pnpm 的依赖检查重装，其中一个报 `EPERM: operation not permitted, unlink ...node_modules\.pnpm\node_modules\esbuild`，提交失败。
- 根因：以为工作树装过一次依赖就不会再装；`git worktree move` 之后路径变了，pnpm 判定需要重装，lefthook 并行任务各自跑一遍 install 互相抢文件。
- 规则：新建或移动工作树后，先在工作树里单独跑一次 `pnpm install --frozen-lockfile`，再提交；提交失败就跑一次 install 后重试，不要 `--no-verify`。
- 元：pnpm@11.7.0 + lefthook@2.2.2 + Windows | 2026-11-05 | 候选毕业方向：无
