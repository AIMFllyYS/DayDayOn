# lessons — 阿里云 ECS（MainECS）

### Docker 镜像源拉取会长期卡在某个层上
- 症状：`docker pull postgres:18.6-alpine3.24` 前台超时；后台跑了 30 分钟，日志一直是 `Waiting` / `Retrying`，镜像不出现。
- 根因：以为配置了镜像源（`docker.1ms.run`）就能快速拉取；实测约 60 KB/s，个别层会一直卡住。
- 规则：新镜像在需要之前提前用 `nohup docker pull ... &` 后台拉取；用 `du -sk /mnt/data/docker/tmp` 观察进度，5 分钟不增长就结束进程重拉；镜像到位后再改 compose。
- 元：Docker 26.1 + docker.1ms.run | 2026-10-31 | 候选毕业方向：无

### 用 sudo -u 从 /root 调用脚本时 find 报无法回到原目录
- 症状：部署闸门里的 `find` 输出 "Failed to restore initial working directory: /root: Permission denied"。
- 根因：以为切换用户后工作目录无关紧要；目标用户读不了调用者的当前目录。
- 规则：以其他用户身份运行的脚本开头先 `cd` 到该用户可读的目录（闸门里是 `cd "$ROOT"`）。
- 元：Alibaba Cloud Linux 3 / bash 4.4 | 2026-10-31 | 候选毕业方向：无（已改进 `daydayon-deploy-gate.sh`）

### set -u 的 forced-command 脚本里 SSH_CLIENT 可能未定义
- 症状：不经 SSH、直接用 sudo 测试闸门时报 "SSH_CLIENT: unbound variable" 并退出。
- 根因：以为 SSH_CLIENT 总会存在；只有经 sshd 登录时才设置。
- 规则：`set -u` 脚本里读取外部环境变量一律写 `${VAR:-默认值}`。
- 元：bash 4.4 | 2026-10-31 | 候选毕业方向：lint（shellcheck SC2154 一类检查进 CI）

### pkill -f / pgrep -f 会匹配到执行它的 bash 自身
- 症状：`bash -c "pkill -f 'docker pull postgres'; ..."` 把自己也结束了，后面的命令没有执行，也没有输出。
- 根因：以为 `-f` 只匹配目标进程；`bash -c` 的命令行里也包含同样的字符串。
- 规则：模式第一个字符加方括号，如 `pkill -f '[d]ocker pull postgres'`。
- 元：procps-ng 3.3 | 2026-10-31 | 候选毕业方向：无
