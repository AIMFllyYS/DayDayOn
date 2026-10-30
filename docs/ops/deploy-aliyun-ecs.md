# 阿里云 ECS 部署方案

> 状态：**方案草稿，服务器侧尚未配置**。所有服务器改动都要先得到项目负责人确认。
> 日期：2026-10-31

## 1. 原则

- 部署方式与 1037Solo 系列相同：GitHub Actions 构建 Linux 制品 → 通过受限 SSH 部署闸门上传 → 服务器解包、健康检查、切换，失败自动回滚到上一版。
- **与 1037Solo 完全隔离**：不使用 1037Solo 的目录，不修改它的部署脚本、项目登记和 PM2 服务。
- 服务器上不执行 `next build`（2 核，且已经在用 swap）。
- 不使用腾讯云的任何服务。

## 2. 服务器事实（2026-10-31 只读实测）

| 项 | 值 |
|---|---|
| 主机 | `ssh MainECS`，阿里云武汉（`cn-wuhan-lr`），Alibaba Cloud Linux 3 |
| 资源 | 2 vCPU、7.3 GiB 内存（swap 已用 2.3 GiB） |
| 磁盘 | 系统盘 `/` 已用 67%；数据盘 `/mnt/data` 已用 15%，剩余约 40G |
| 运行时 | Node 24.19（`/www/server/nodejs/v24.19.0`）、PM2、Docker 26.1、宝塔 Nginx 1.28 |
| 空闲端口 | 3043、55438（实施前再核对） |

## 3. 目录

```
/www/wwwroot/daydayon/          # 应用
├── .env                        # 权限 600，属主 daydayon
├── app/                        # 当前版本（PM2: node server.js）
├── app.prev/                   # 上一个成功版本
└── logs/

/mnt/data/daydayon/             # 数据（放数据盘，系统盘空间紧）
├── postgres/                   # PG 数据目录（容器 bind mount）
├── backups/                    # 每日 pg_dump
└── compose/docker-compose.yml
```

## 4. 组件

| 组件 | 方案 |
|---|---|
| 运行用户 | 独立系统用户 `daydayon`，不用 root 跑应用 |
| 进程管理 | 独立的 `pm2-daydayon` systemd 服务，进程名 `daydayon`，监听 `127.0.0.1:3043` |
| 数据库 | Docker `postgres:18.6-alpine3.24`，容器名 `daydayon-db`，只绑定 `127.0.0.1:55438`，内存上限 512MB |
| 部署闸门 | 新建 `/usr/local/sbin/daydayon-deploy-gate`，机制与 1037Solo 的闸门相同：只接受 `status` 和 `deploy-artifact <sha40>`，校验大小和 gzip，全局加锁 |
| 部署密钥 | 一把专用 ed25519 公钥，写进 `daydayon` 用户的 `authorized_keys`，用 forced-command 绑定到闸门，禁止 pty 和端口转发 |
| Nginx | 宝塔新建站点，HTTPS（Let's Encrypt），反代到 `127.0.0.1:3043`，写入 `X-Real-IP` / `X-Forwarded-For` |
| 备份 | cron 每日 `pg_dump` 到 `/mnt/data/daydayon/backups/`，保留 14 天 |

## 5. 发布流程

```
工作分支 → PR → dev（CI：lint、typecheck、build、密钥扫描）
  → 项目负责人明确同意
  → dev → main 发布 PR，合并
  → deploy-mainecs workflow：
      构建 standalone → 组装制品（复制 public/、.next/static/）→ 校验（无 .env*、大小上限）
      → ssh "deploy-artifact daydayon <sha40>" < artifact.tar.gz
  → 服务器：解包到临时目录 → 当前 app/ 移为 app.prev/ → 切换 → pm2 restart
      → 健康检查 GET /api/health → 失败则切回 app.prev/
```

- 数据库迁移不在 workflow 里自动执行：先手动迁移，再合并发布。
- 回滚：`git revert` 有问题的提交，再走一次发布。

## 6. GitHub 配置

| 类型 | 名称 | 内容 |
|---|---|---|
| Secret | `MAINECS_SSH_KEY` | 部署私钥 |
| Secret | `MAINECS_KNOWN_HOSTS` | 服务器 host key（固定，不用 `StrictHostKeyChecking=no`） |
| Variable | `MAINECS_HOST` / `MAINECS_USER` | 服务器地址 / `daydayon` |
| Variable | `MAINECS_DEPLOY_ENABLED` | 为 `true` 时才部署，否则 job 跳过 |
| Variable | `NEXT_PUBLIC_APP_URL` | 站点地址（构建时写入客户端） |

## 7. 待确认

1. 域名。
2. 第 4 节的服务器改动由谁执行：项目负责人自己做，还是授权 AI 代理按清单逐项执行、每一步先确认。
3. 独立 PM2 服务 + 独立系统用户（隔离更好，多一个 systemd 服务），还是直接挂到现有的 `pm2-1037solo` 下（少一个服务，但与 1037Solo 耦合）。建议前者。
