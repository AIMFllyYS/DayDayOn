# scripts/deploy/

服务器侧文件的唯一来源。由 `scripts/setup/provision-server.sh` 安装到服务器，说明见 [deploy-aliyun-ecs.md](../../docs/ops/deploy-aliyun-ecs.md)。

| 文件 | 服务器位置 | 作用 |
|---|---|---|
| `daydayon-deploy-gate.sh` | `/usr/local/sbin/daydayon-deploy-gate` | SSH 部署闸门：校验制品、切换版本、健康检查、失败回滚 |
| `ecosystem.config.cjs` | `/www/wwwroot/daydayon/ecosystem.config.cjs` | PM2 进程定义 |
| `pm2-daydayon.service` | `/etc/systemd/system/pm2-daydayon.service` | 独立的 PM2 守护进程 |
| `docker-compose.db.yml` | `/mnt/data/daydayon/compose/docker-compose.yml` | 生产数据库容器 |
| `backup-db.sh` | `/mnt/data/daydayon/compose/backup-db.sh` | 每日数据库备份 |
| `logrotate-daydayon` | `/etc/logrotate.d/daydayon` | 日志轮转 |
| `nginx-daydayon.http.conf` | Nginx 站点（第一阶段） | 证书签发前，只开放 ACME 验证 |
| `nginx-daydayon.conf` | Nginx 站点（正式） | HTTPS 反代 |

改了这些文件后，需要重新在服务器上执行安装（Nginx 站点文件存在时不会被覆盖，需手动替换）。
