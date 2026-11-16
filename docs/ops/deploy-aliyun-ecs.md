# 阿里云 ECS 部署

> 日期：2026-11-02
> 状态：**生产部署体系已全面跑通并处于持续运行中**（域名、HTTPS 证书、Docker PG18 数据库、PM2 进程、环境变量与 GitHub Actions 自动部署闸门均已就绪并经过多次线上发布验证）。

## 1. 原则

- 部署方式与 1037Solo 系列相同：GitHub Actions 构建 Linux 制品 → 通过受限 SSH 部署闸门上传 → 服务器解包、健康检查、切换，失败自动回滚到上一版。
- **与 1037Solo 完全隔离**：不使用 1037Solo 的目录，不修改它的部署脚本、项目登记和 PM2 服务。
- 服务器上不执行 `next build`（2 核，且已经在用 swap）。
- 不使用腾讯云的任何服务。

## 2. 服务器配置现状

| 项 | 值 |
|---|---|
| 主机 | `ssh MainECS`，阿里云武汉（`cn-wuhan-lr`），Alibaba Cloud Linux 3 |
| 资源 | 2 vCPU、7.3 GiB 内存 |
| 运行时 | Node 24.19（`/www/server/nodejs/v24.19.0`）、PM2、Docker 26.1、宝塔 Nginx 1.28 |
| 域名 | `daydayon.husteread.com`（A 记录已解析至 `8.162.4.159`） |
| 证书 | acme.sh 签发 ECC 证书（`/www/server/panel/vhost/cert/daydayon.husteread.com/`，自动续期） |
| 端口 | 应用 `127.0.0.1:23329`，数据库 `127.0.0.1:23432`（约定见 [ports.md](../conventions/ports.md)） |
| 环境变量 | `/www/wwwroot/daydayon/.env`（0600 权限，已完整配置数据库、Better Auth、SMTP 邮件与 DeepSeek API 密钥） |

## 3. 目录结构

```
/www/wwwroot/daydayon/              属主 daydayon，0751
├── .env                            运行时环境变量（0600，已配置真实值）
├── ecosystem.config.cjs            PM2 进程定义
├── app/                            当前运行版本（node server.js，监听 127.0.0.1:23329）
├── app.prev/                       上一个成功版本（健康检查失败时秒级回滚）
├── app.failed/                     最近一次健康检查失败的版本（排查用）
├── releases/                       独立持久化版本与安装包目录（Nginx 直出 & 应用更新检查读取）
│   ├── manifest.json               版本清单（与 download/manifest.json 同步）
│   ├── CHANGELOG.md                用户更新日志
│   └── apk/DayDayOn.apk            Android 安装包（Nginx /download/DayDayOn.apk 别名直出）
├── logs/                           app.out.log、app.err.log、deploy.log、deploy-state
├── home/                           daydayon 用户的家目录（.ssh、.pm2）
└── webroot/                        仅用于 ACME 证书验证

/mnt/data/daydayon/                 属主 root，0700（数据放数据盘）
├── postgres/                       PG 数据目录（容器 bind mount）
├── backups/                        每日 pg_dump 与部署前备份，保留 14 天
└── compose/                        docker-compose.yml、.env（数据库密码）、backup-db.sh
```

## 4. 组件与安装位置

仓库里的文件是唯一来源，由 `scripts/setup/provision-server.sh` 安装：

| 组件 | 仓库文件 | 服务器位置 | 状态 |
|---|---|---|---|
| 运行用户 | — | 系统用户 `daydayon`（密码锁定，只能用部署公钥登录） | 已建立 |
| 部署闸门 | `scripts/deploy/daydayon-deploy-gate.sh` | `/usr/local/sbin/daydayon-deploy-gate`（root:root 0755） | 已同步最新加固版 |
| 部署公钥 | — | `/www/wwwroot/daydayon/home/.ssh/authorized_keys`，forced-command 绑定闸门 | 已生效 |
| PM2 服务 | `scripts/deploy/pm2-daydayon.service` | `/etc/systemd/system/pm2-daydayon.service`（独立守护进程） | 运行中 |
| PM2 进程定义 | `scripts/deploy/ecosystem.config.cjs` | `/www/wwwroot/daydayon/ecosystem.config.cjs` | 已生效 |
| 数据库 | `scripts/deploy/docker-compose.db.yml` | 容器 `daydayon-db`，`postgres:18.6-alpine3.24`，绑定 `127.0.0.1:23432` | 运行中（healthy） |
| 数据库备份 | `scripts/deploy/backup-db.sh` | `/mnt/data/daydayon/compose/backup-db.sh`，支持每日 cron（04:30）与部署闸门免密触发（`/etc/sudoers.d/daydayon-backup`） | 已生效 |
| 日志轮转 | `scripts/deploy/logrotate-daydayon` | `/etc/logrotate.d/daydayon`，每周轮转，保留 8 份 | 已生效 |
| Nginx 站点 | `scripts/deploy/nginx-daydayon.conf` | `/www/server/panel/vhost/nginx/daydayon.husteread.com.conf`（HTTP/2、强制 HTTPS、对端 IP 覆盖、AI 流式无缓冲） | 运行中 |

## 5. 发布流程

```
工作分支 → PR → dev（ci：lint、typecheck、format、test、build、制品组装、密钥扫描）
  → 项目负责人对每一次发布明确同意
  → dev → main 发布 PR，合并
  → deploy workflow：构建 → 组装制品（含 migrations 与 static）→ ssh "deploy-artifact <sha>" < artifact.tar.gz
  → 闸门：校验制品 → 备份数据库（sudo backup-db.sh）→ 当前版本移为 app.prev → 切换 → pm2 重启
        → 服务启动钩子（instrumentation.ts）幂等执行 Drizzle 迁移
        → 健康检查（/api/health 返回的 commit 必须等于本次 sha）→ 失败切回 app.prev
  → workflow 再从公网检查一次 /api/health
```

- 仓库变量 `MAINECS_DEPLOY_ENABLED` 已设为 `true`。
- 数据库迁移打包在制品 `src/server/db/migrations` 中，由 Next.js 服务启动钩子 `instrumentation.ts` 自动幂等运行；部署闸门在解包后、启动前自动对 PG 数据库做一次热备份，若应用启动崩溃或健康检查超时，自动切回上一版本 `app.prev`。
- 回滚机制：
  - 自动回滚：健康检查 30 次（共 60 秒）未就绪时，闸门自动将 `app.prev` 换回 `app` 并重启 PM2；
  - 手动紧急回滚：可在服务器上以 root 执行 `mv /www/wwwroot/daydayon/app.prev /www/wwwroot/daydayon/app && sudo -u daydayon env PM2_HOME=/www/wwwroot/daydayon/home/.pm2 PATH=/www/server/nodejs/v24.19.0/bin:/usr/bin:/bin pm2 restart daydayon`。

### 5.1 APK 打包与服务器同步流程

1. **版本与原生壳准备**：若涉及原生 Kotlin 改动或壳版本升级，同步更新 `android/app/build.gradle.kts`（`versionCode` 递增、`versionName`）与 `android/app/src/main/kotlin/com/husteread/daydayon/MainActivity.kt` UA（`DayDayOnApp/<version>`）；同时更新 `package.json`、`src/lib/app-version.ts`、`download/manifest.json`（`latest`、`publishedAt`、`android.version`、`android.sourceTag`）、`download/CHANGELOG.md`、`docs/updates/changelog.md`。
2. **本地离线签名构建**：执行 `powershell -ExecutionPolicy Bypass -File android/build-apk.ps1`（使用持久化签名 `android/keystore/daydayon-release.jks`），生成 `download/apk/DayDayOn.apk`（`.gitignore` 忽略不入库），并将输出的 `Size` 与 `SHA256` 回填至 `download/manifest.json` 的 `android.size` 与 `android.sha256`。
3. **双端分发（GitHub Release + 服务器 `/www/wwwroot/daydayon/releases/`）**：
   - **先上传 GitHub Release**：打 tag（匹配 `android.sourceTag`，如 `v0.1.10`）并上传 `download/apk/DayDayOn.apk` 到 GitHub Release（作为备用源与 CI 拉取兜底源）。
   - **方式 A（随 `main` 部署同步）**：合并到 `main` 后，`.github/workflows/deploy.yml` 调用 `scripts/build/pack-artifact.sh`（先尝试从 `https://daydayon.husteread.com/download/DayDayOn.apk` 拉取并校验 sha256，不匹配则回退从 GitHub Release `android.sourceTag` 拉取；因此**新包必须先上传 GitHub Release 或先传上服务器**，否则 CI/PR 打包会因 sha256 不匹配失败），再由 `scripts/deploy/daydayon-deploy-gate.sh` 自动将 `manifest.json`、`CHANGELOG.md`、`DayDayOn.apk` 覆盖写入 `/www/wwwroot/daydayon/releases/`（`chmod 0644`）。
   - **方式 B（仅热更新 APK / 清单或立即生效，需负责人许可的 `ssh MainECS` 操作）**：直接将 `download/apk/DayDayOn.apk`（以及热更新时的 `download/manifest.json`、`download/CHANGELOG.md`）上传到 `/www/wwwroot/daydayon/releases/`（属主 `daydayon`、权限 `0644`）。Nginx `location = /download/DayDayOn.apk`（`scripts/deploy/nginx-daydayon.conf`）直接静态直出该目录并支持 HTTP Range 断点续传，`src/server/services/app-update/index.ts` 按 `mtimeMs` 自动刷新缓存，立即生效且无需重启 PM2。
4. **上线后校验**：
   ```bash
   curl -I https://daydayon.husteread.com/download/DayDayOn.apk
   curl -fsS "https://daydayon.husteread.com/api/v1/app/update?web=0.1.0&shell=0.1.0"
   ```

## 6. GitHub 配置（已完成）

| 类型 | 名称 | 内容 |
|---|---|---|
| Secret | `MAINECS_SSH_KEY` | 部署私钥（ed25519），只存在 GitHub |
| Secret | `MAINECS_KNOWN_HOSTS` | 服务器 host key，已核对指纹 |
| Variable | `MAINECS_HOST` / `MAINECS_USER` | `8.162.4.159` / `daydayon` |
| Variable | `MAINECS_DEPLOY_ENABLED` | `true`（生产自动部署开启） |
| Variable | `NEXT_PUBLIC_APP_URL` | `https://daydayon.husteread.com` |

## 7. 常用运维与巡检命令（在服务器上以 root 执行）

```bash
# 查看应用进程状态
sudo -u daydayon env PM2_HOME=/www/wwwroot/daydayon/home/.pm2 PATH=/www/server/nodejs/v24.19.0/bin:/usr/bin:/bin pm2 ls

# 查看最近 50 条部署闸门日志
tail -n 50 /www/wwwroot/daydayon/logs/deploy.log

# 查看数据库容器状态
docker compose -f /mnt/data/daydayon/compose/docker-compose.yml ps

# 查看数据库最新备份
ls -lh /mnt/data/daydayon/backups/

# 手动触发一次数据库备份
sudo -u daydayon sudo -n /mnt/data/daydayon/compose/backup-db.sh

# 查看公网健康检查
curl -fsS https://daydayon.husteread.com/api/health
```
