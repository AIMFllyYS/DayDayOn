# lessons — Windows PowerShell（本地环境）

### 双引号里的 `$(...)` 和 `$变量` 会在本地先执行
- 症状：`ssh MainECS "echo \$(pgrep ... || true)"` 报 "标记 `||` 不是此版本中的有效语句分隔符"；`awk '{print $1}'` 变成 `{print \}`。
- 根因：以为反斜杠能转义 `$`；PowerShell 的转义符是反引号，双引号字符串里的 `$()` 是本地子表达式。
- 规则：远程脚本超过一行或含 `$`、`||`、`awk` 时，写成单引号 here-string，用 `$s | ssh MainECS "tr -d '\r' | bash -s"` 从标准输入传过去；不要把它塞进双引号命令行。
- 元：Windows PowerShell 5.1 + OpenSSH | 2026-10-31 | 候选毕业方向：脚本（`scripts/dev/` 里放一个远程执行包装）

### gh 的 `--jq` / `--template` 写不了字符串插值
- 症状：`--jq '"\(.url) ..."'` 报 "unexpected token"；`--template '{{"\n"}}'` 报 "unexpected \\"。
- 根因：以为单引号能原样传参；PowerShell 5.1 传给原生程序时会改写内嵌的双引号和反斜杠。
- 规则：需要结构化结果时用 `--json <字段>` 再 `ConvertFrom-Json` 在 PowerShell 里取值，或直接用 gh 的默认表格输出。
- 元：gh@2.102 + Windows PowerShell 5.1 | 2026-10-31 | 候选毕业方向：无

### 原生命令的 stderr 被当成错误记录
- 症状：`git` / `gh` / `ssh` 正常执行，却输出红色 `NativeCommandError`，`$LASTEXITCODE` 与实际结果不符。
- 根因：以为 `2>&1` 只是合并输出；PowerShell 5.1 会把原生程序写到 stderr 的每一行包装成 ErrorRecord。
- 规则：需要看原生命令的完整输出时写 `cmd 2>&1 | ForEach-Object { "$_" }`；判断成败只看 `$LASTEXITCODE` 或命令自身的结果，不看是否出现红字。
- 元：Windows PowerShell 5.1 | 2026-10-31 | 候选毕业方向：无
