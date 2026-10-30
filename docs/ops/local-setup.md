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

## 常用检查

```powershell
pnpm check     # lint + typecheck + 格式检查
pnpm build     # 生产构建
```

## 常见问题

- **pnpm 命令卡住不动**：在自动化环境里先执行 `$env:CI = "true"`，避免 pnpm 11 的交互提示。
- **`pnpm install` 报 `EEXIST: file already exists, symlink`**：上一次安装被中断留下了半成品，删除 `node_modules` 后重装。
- **安装时提示有依赖的构建脚本被忽略**：pnpm 11 默认拦截安装脚本。确认需要后在 `pnpm-workspace.yaml` 的 `allowBuilds` 里登记。
