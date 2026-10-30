# 端口约定

> 日期：2026-10-31。本地开发与服务器使用同一组端口，配置里出现端口号的地方都要与本文一致。

## 端口表

| 用途 | 端口 | 监听地址 | 说明 |
|---|---|---|---|
| 应用（Next.js） | **23329** | 本地 `localhost`；服务器 `127.0.0.1` | `pnpm dev` / `pnpm start` 与服务器 PM2 进程都用它 |
| 数据库（PostgreSQL） | **23432** | 只绑定 `127.0.0.1` | 容器内仍是 5432，映射到宿主机 23432；末尾 432 对应 PostgreSQL 默认端口 5432 |
| 预留 | 23330–23339 | — | 以后的辅助服务（如本地邮件调试、任务面板），按需从这里分配 |

公网只经过宝塔 Nginx 的 80 / 443，应用和数据库端口都不对外开放。

## 为什么选这两个端口

- **避开常用端口**：3000、5432 等经常被其他项目占用，本地同时跑多个项目时会冲突。
- **避开 Linux 临时端口段**：服务器的 `ip_local_port_range` 是 32768–60999，系统给对外连接分配源端口时会用到这一段。监听端口放在段外，就不会和出站连接撞车。
- **避开 Windows 动态端口段**：本机动态端口从 49152 开始，Hyper-V / WSL / Docker Desktop 还会在这一段里保留端口块，导致"端口已被排除"的启动错误。
- 2026-10-31 实测：23329、23432 在本机和服务器上都没有被占用，也不在本机的保留端口块里。

## 用到端口的地方

改端口时这些地方必须一起改：

| 位置 | 内容 |
|---|---|
| `package.json` | `dev` / `start` 脚本的 `-p 23329` |
| `.env.example` | `NEXT_PUBLIC_APP_URL`、`BETTER_AUTH_URL`、`DATABASE_URL` |
| `scripts/deploy/ecosystem.config.cjs` | PM2 的 `PORT` |
| `scripts/deploy/daydayon-deploy-gate.sh` | 健康检查地址 `HEALTH_URL` |
| `scripts/deploy/nginx-daydayon.conf` | `proxy_pass` |
| `scripts/deploy/docker-compose.db.yml` | 数据库端口映射 |
| `scripts/setup/provision-server.sh` | 生成的 `DATABASE_URL` |
| 服务器 `/www/wwwroot/daydayon/.env` | `DATABASE_URL`（已有文件不会被初始化脚本覆盖，需手动改） |
| [deploy-aliyun-ecs.md](../ops/deploy-aliyun-ecs.md)、[local-setup.md](../ops/local-setup.md) | 文档中的地址 |

检查是否有遗漏：

```powershell
git grep -nE '3000|3043|5432|55432|55438' -- . ':!pnpm-lock.yaml'
```

（容器内部的 5432 是正常的。）
