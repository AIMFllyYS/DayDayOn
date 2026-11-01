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

### twoFactor 插件不拦截 emailOTP 验证码登录
- 症状：管理员绑定了 TOTP 两步验证，但通过 `/sign-in/email-otp` 登录时直接拿到正式 session，完全跳过了 TOTP 校验。
- 根因：Better Auth 1.7.14 的 `twoFactor()` 插件 after-hook 只匹配密码登录路由（`/sign-in/email`、`/sign-in/username`），不匹配 `emailOTP` 插件的 `/sign-in/email-otp`。
- 规则：在 `hooks.after` 里显式拦截 `/sign-in/email-otp`（以及管理员首次绑定 TOTP 的无密码流程）：当用户 `twoFactorEnabled === true` 时，删除刚创建的正式 session、写入 `two-factor` 临时验证记录并种下签名的 `better-auth.two_factor` cookie，返回 `{ twoFactorRedirect: true }`。
- 元：better-auth@1.7.14 | 2026-11-01 | 候选毕业方向：已沉淀到 `src/server/auth/auth.ts` 与 `totp-setup.ts`

### twoFactor.enable 要求传密码，无密码（纯 OTP）应用无法直接启用
- 症状：纯邮箱验证码应用里管理员调用 `/two-factor/enable` 报缺密码或密码错误，无法生成 TOTP 密钥。
- 根因：Better Auth 内置的 `/two-factor/enable` 强制校验 `account.password`。
- 规则：管理员首次绑定 TOTP 由受保护的服务端流程（`src/server/auth/totp-setup.ts`）用 Better Auth 相同的 `symmetricEncrypt`（`BETTER_AUTH_SECRET`）加密密钥写入 `twoFactor` 表，校验首个 6 位动态码通过后再将 `user.twoFactorEnabled` 置为 `true`。
- 元：better-auth@1.7.14 | 2026-11-01 | 候选毕业方向：已沉淀到 `src/server/auth/totp-setup.ts`

### admin 插件默认暴露创建用户、改角色、冒充等高危端点
- 症状：引入 `admin()` 插件以复用封号/解封能力后，`/api/auth/admin/create-user`、`/set-role`、`/impersonate-user`、`/remove-user` 等端点一并对外开放。
- 根因：`admin()` 插件一次性注册全部管理路由，不支持按端点挑选。
- 规则：在 `/api/auth/[...all]/route.ts` 入口对 `/api/auth/admin/*` 做白名单守卫，只放行 `ban-user`、`unban-user`、`revoke-user-sessions`，其余一律返回 404。
- 元：better-auth@1.7.14 | 2026-11-01 | 候选毕业方向：已沉淀到 `src/app/api/auth/[...all]/route.ts`

### hooks.before 里抛自定义错误用 APIError，且修改邮箱需同时改 context.body
- 症状：`hooks.before` 里 `throw new Error()` 返回 500；只返回 `{ context }` 不改 `ctx.body.email` 时下游 handler 仍读到未规范化的邮箱。
- 根因：Better Auth 的端点只把 `APIError`（从 `better-auth/api` 导入）映射成结构化 HTTP 状态码；部分插件直接读 `ctx.body`。
- 规则：邮箱规范化（`trim().toLowerCase()`）直接改 `ctx.body.email` 并返回 `{ context: ctx }`；拦截请求时抛 `new APIError('FORBIDDEN' | 'TOO_MANY_REQUESTS', { message })`。
- 元：better-auth@1.7.14 | 2026-11-01 | 候选毕业方向：已沉淀到 `src/server/auth/auth.ts`

