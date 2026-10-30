# 阿里云 ECS 部署

> 日期：2026-10-31
> 状态：服务器侧已配置完成；**域名解析与 HTTPS 证书待完成**（见第 8 节）。

## 1. 原则

- 部署方式与 1037Solo 系列相同：GitHub Actions 构建 Linux 制品 → 通过受限 SSH 部署闸门上传 → 服务器解包、健康检查、切换，失败自动回滚到上一版。
- **与 1037Solo 完全隔离**：不使用 1037Solo 的目录，不修改它的部署脚本、项目登记和 PM2 服务。
- 服务器上不执行 `next build`（2 核，且已经在用 swap）。
- 不使用腾讯云的任何服务。

## 2. 服务器

| 项 | 值 |
|---|---|
| 主机 | `ssh MainECS`，阿里云武汉（`cn-wuhan-lr`），Alibaba Cloud Linux 3 |
| 资源 | 2 vCPU、7.3 GiB 内存 |
| 运行时 | Node 24.19（`/www/server/nodejs/v24.19.0`）、PM2、Docker 26.1、宝塔 Nginx 1.28 |
| 域名 | `daydayon.husteread.com` |
| 端口 | 应用 `127.0.0.1:23329`，数据库 `127.0.0.1:23432`（约定见 [ports.md](../conventions/ports.md)） |

## 3. 目录

```
/www/wwwroot/daydayon/              属主 daydayon，0751
├── .env                            运行时环境变量（0600）
├── ecosystem.config.cjs            PM2 进程定义
├── app/                            当前版本（node server.js，监听 127.0.0.1:23329）
├── app.prev/                       上一个成功版本
├── app.failed/                     最近一次健康检查失败的版本（排查用）
├── logs/                           app.out.log、app.err.log、deploy.log、deploy-state
├── home/                           daydayon 用户的家目录（.ssh、.pm2）
└── webroot/                        仅用于 ACME 证书验证

/mnt/data/daydayon/                 属主 root，0700（数据放数据盘）
├── postgres/                       PG 数据目录（容器 bind mount）
├── backups/                        每日 pg_dump，保留 14 天
└── compose/                        docker-compose.yml、.env（数据库密码）、backup-db.sh
```

## 4. 组件

仓库里的文件是唯一来源，服务器上的副本由 `scripts/setup/provision-server.sh` 安装（可重复执行，不覆盖已有 `.env` 与数据库密码）。

| 组件 | 仓库文件 | 服务器位置 |
|---|---|---|
| 运行用户 | — | 系统用户 `daydayon`（密码锁定，只能用部署公钥登录） |
| 部署闸门 | `scripts/deploy/daydayon-deploy-gate.sh` | `/usr/local/sbin/daydayon-deploy-gate` |
| 部署公钥 | — | `/www/wwwroot/daydayon/home/.ssh/authorized_keys`，forced-command 绑定闸门，禁止 pty 与端口转发 |
| PM2 服务 | `scripts/deploy/pm2-daydayon.service` | `/etc/systemd/system/pm2-daydayon.service`（独立守护进程） |
| PM2 进程定义 | `scripts/deploy/ecosystem.config.cjs` | `/www/wwwroot/daydayon/ecosystem.config.cjs` |
| 数据库 | `scripts/deploy/docker-compose.db.yml` | 容器 `daydayon-db`，`postgres:18.6-alpine3.24`，只绑定 `127.0.0.1:23432`，内存上限 512MB |
| 数据库备份 | `scripts/deploy/backup-db.sh` | `/etc/cron.d/daydayon-backup`，每天 04:30 |
| 日志轮转 | `scripts/deploy/logrotate-daydayon` | `/etc/logrotate.d/daydayon`，每周轮转，保留 8 份 |
| Nginx 第一阶段 | `scripts/deploy/nginx-daydayon.http.conf` | 只开 80 端口做证书验证，其余返回 503 |
| Nginx 正式站点 | `scripts/deploy/nginx-daydayon.conf` | HTTPS，反代到 `127.0.0.1:23329`，用对端地址覆盖 `X-Forwarded-For` |

Nginx 站点文件位于 `/www/server/panel/vhost/nginx/daydayon.husteread.com.conf`。它是手工维护的配置，**不会出现在宝塔面板的网站列表里**，不要在面板里为这个域名再建站点。

## 5. 发布流程

```
工作分支 → PR → dev（ci：lint、typecheck、format、build、制品组装、密钥扫描）
  → 项目负责人对这一次发布明确同意
  → dev → main 发布 PR，合并
  → deploy workflow：构建 → 组装制品 → ssh "deploy-artifact <sha>" < artifact.tar.gz
  → 闸门：校验 → 当前版本移为 app.prev → 切换 → pm2 重启
        → 健康检查（/api/health 返回的 commit 必须等于本次 sha）→ 失败切回 app.prev
  → workflow 再从公网检查一次 /api/health
```

- 仓库变量 `MAINECS_DEPLOY_ENABLED` 不为 `true` 时只构建不部署。
- 数据库迁移不在 workflow 里自动执行：先手动迁移，再合并发布。
- 回滚：`git revert` 有问题的提交，再走一次发布。紧急情况可在服务器上把 `app.prev` 换回 `app` 后 `pm2 restart daydayon`。

## 6. GitHub 配置（已完成）

| 类型 | 名称 | 内容 |
|---|---|---|
| Secret | `MAINECS_SSH_KEY` | 部署私钥（ed25519，`SHA256:H+VMK+a4Ipw40j/uQ6dOHeyRb9zEMRTbVxDXugk/BYo`），只存在 GitHub |
| Secret | `MAINECS_KNOWN_HOSTS` | 服务器 host key，已与本机信任的指纹核对 |
| Variable | `MAINECS_HOST` / `MAINECS_USER` | 服务器地址 / `daydayon` |
| Variable | `MAINECS_DEPLOY_ENABLED` | 当前为 `false`，HTTPS 就绪后改为 `true` |
| Variable | `NEXT_PUBLIC_APP_URL` | `https://daydayon.husteread.com` |

## 7. 常用运维命令（在服务器上以 root 执行）

```bash
# 应用进程
sudo -u daydayon env PM2_HOME=/www/wwwroot/daydayon/home/.pm2 PATH=/www/server/nodejs/v24.19.0/bin:/usr/bin:/bin pm2 ls
# 部署记录
tail -n 50 /www/wwwroot/daydayon/logs/deploy.log
# 数据库
docker compose -f /mnt/data/daydayon/compose/docker-compose.yml ps
# 修改运行时环境变量后重启
sudo -u daydayon env PM2_HOME=/www/wwwroot/daydayon/home/.pm2 PATH=/www/server/nodejs/v24.19.0/bin:/usr/bin:/bin \
  pm2 startOrRestart /www/wwwroot/daydayon/ecosystem.config.cjs --update-env
```

`NEXT_PUBLIC_*` 变量在构建时写入客户端代码，修改后必须重新部署，只重启不生效。

## 8. 待完成

1. **DNS**：在阿里云云解析的 `husteread.com` 下添加 A 记录 `daydayon` → `8.162.4.159`。
2. **证书**：解析生效后签发并安装证书，再把 Nginx 换成正式站点配置：

   ```bash
   /root/.acme.sh/acme.sh --issue -d daydayon.husteread.com -w /www/wwwroot/daydayon/webroot --keylength ec-256
   mkdir -p /www/server/panel/vhost/cert/daydayon.husteread.com
   /root/.acme.sh/acme.sh --install-cert -d daydayon.husteread.com --ecc \
     --key-file /www/server/panel/vhost/cert/daydayon.husteread.com/privkey.pem \
     --fullchain-file /www/server/panel/vhost/cert/daydayon.husteread.com/fullchain.pem \
     --reloadcmd "nginx -s reload"
   ```

3. **运行时密钥**：在 `/www/wwwroot/daydayon/.env` 填写 `SMTP_USER`、`SMTP_PASS`、`DEEPSEEK_API_KEY`。
4. 以上完成后，把 `MAINECS_DEPLOY_ENABLED` 改为 `true`，发起第一次 `dev → main` 发布。
