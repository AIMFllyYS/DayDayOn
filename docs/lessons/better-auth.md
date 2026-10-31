# lessons — Better Auth（better-auth）

> 适用版本：better-auth@1.7.14（M3 安装）。以下条目来自 2026-10-31 对官方文档和 registry 的核对，尚未在本项目代码里踩到。

### 照文档另装 @better-auth/drizzle-adapter
- 症状：`package.json` 多出一个与 better-auth 版本绑定的适配器包，升级时要同步改两处。
- 根因：文档写的是安装独立包；而 better-auth@1.7.14 已经依赖它，并导出 `better-auth/adapters/drizzle` 子路径。
- 规则：从 `better-auth/adapters/drizzle` 导入 `drizzleAdapter`，不单独安装。
- 元：better-auth@1.7.14 | 2026-10-31 | 候选毕业方向：封装层（`src/server/auth/auth.ts`）

### 服务端调用 auth.api 不受限流
- 症状：在 `/api/v1` 里包装 `auth.api.sendVerificationOTP()` 后，验证码可以被无限次触发。
- 根因：官方文档说明限流只作用于客户端发起的请求，`auth.api` 的服务端调用不计数。
- 规则：发验证码和登录只由浏览器请求 `/api/auth/*`；不在别的接口里转调。
- 元：better-auth@1.7.14 | 2026-10-31 | 候选毕业方向：无

### 默认按 x-forwarded-for 识别 IP
- 症状：限流和"同 IP 注册数"能被伪造请求头绕过。
- 根因：默认读取 `x-forwarded-for`，链里最左边的值由客户端控制。
- 规则：`advanced.ipAddress.ipAddressHeaders: ['x-real-ip']`，与 Nginx 配置一致。
- 元：better-auth@1.7.14 | 2026-10-31 | 候选毕业方向：无

### 开发环境限流默认关闭、默认存内存
- 症状：本地测不出限流；生产 PM2 重启后计数清零。
- 根因：`rateLimit` 在开发模式默认关闭，默认存储是内存。
- 规则：显式写 `rateLimit: { enabled: true, storage: 'database', … }`。
- 元：better-auth@1.7.14 | 2026-10-31 | 候选毕业方向：无

### CLI 不是 @better-auth/cli，也不要用 @latest
- 症状：`npx auth@latest generate` 用的 CLI 版本与项目里的 better-auth 不一致，生成的表结构对不上。
- 根因：当前 CLI 的包名是 `auth`；`@latest` 会取最新版。
- 规则：`pnpm dlx auth@<与 better-auth 相同的版本> generate`；表由 drizzle-kit 出迁移，不用 CLI 的 `migrate`。
- 元：better-auth@1.7.14 | 2026-10-31 | 候选毕业方向：脚本（`package.json` 的 `auth:generate`）

