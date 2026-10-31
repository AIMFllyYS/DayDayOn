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
