# 本地开发环境

## 需要的工具

| 工具 | 版本 | 说明 |
|---|---|---|
| Node.js | 24 | 见 `.nvmrc` |
| pnpm | 11.7 | `corepack enable` 后按 `package.json` 的 `packageManager` 自动使用 |
| Git | 任意新版本 | Windows 上确认 `git` 在 PATH 里（PATH 条目要带盘符，如 `C:\Program Files\Git\cmd`） |
| Docker Desktop | 任意新版本 | 本地 PostgreSQL（接入数据库后需要） |
| gitleaks | 8.x，可选 | 提交前扫描密钥：`winget install Gitleaks.Gitleaks` |

## 启动

```powershell
pnpm install   # 同时安装 git hooks（lefthook）
pnpm dev       # http://localhost:23329
```

端口：应用 23329，本地数据库 23432，与服务器一致，见 [ports.md](../conventions/ports.md)。

环境变量：复制 `.env.example` 为 `.env.local` 后填写。`.env.local` 不会被提交。

本地数据库与测试（规则见 [database.md](../conventions/database.md)、[testing.md](../conventions/testing.md)）：

```powershell
pnpm db:up        # 启动 Docker PG（postgres:18.6-alpine3.24，127.0.0.1:23432），等到健康检查通过
pnpm db:generate  # 改完 src/server/db/schema/ 后生成迁移（drizzle-kit generate）
pnpm db:migrate   # 执行迁移（scripts/dev/migrate.ts，drizzle-orm 的 migrate()）
pnpm db:seed      # 写入本地假数据
pnpm test         # 单元测试（vitest run，不进入监听模式）
pnpm db:down      # 停止并移除容器，数据保留在 .data/postgres
```

- 本地库的用户、库名都是 `daydayon`，口令 `daydayon-dev`（只用于本机，写在 `scripts/dev/docker-compose.db.yml`）。`.env.local` 的 `DATABASE_URL` 填 `postgres://daydayon:daydayon-dev@127.0.0.1:23432/daydayon`。
- 数据目录是仓库根的 `.data/postgres`（已 gitignore）。要清空本地库：`pnpm db:down` 后删除 `.data/postgres`。
- `db:migrate` 选用程序化的 `migrate(db, { migrationsFolder })` 而不是 `drizzle-kit migrate`：和生产部署闸门将来调用的方式一致；还没有迁移文件时直接跳过。
- `drizzle.config.ts` 和 `scripts/dev/migrate.ts` 会自己读取 `.env.local`（drizzle-kit 不会自动加载）。
- 没有 `db:push`：所有环境都走 generate + migrate，禁止 `drizzle-kit push`。

## 常用检查

```powershell
pnpm check     # lint + typecheck + 格式检查
pnpm build     # 生产构建
```

## 常见问题

- **pnpm 命令卡住不动**：在自动化环境里先执行 `$env:CI = "true"`，避免 pnpm 11 的交互提示。
- **`pnpm install` 报 `EEXIST: file already exists, symlink`**：上一次安装被中断留下了半成品，删除 `node_modules` 后重装。
- **安装时提示有依赖的构建脚本被忽略**：pnpm 11 默认拦截安装脚本。确认需要后在 `pnpm-workspace.yaml` 的 `allowBuilds` 里登记。
