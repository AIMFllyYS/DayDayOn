# lessons — Better Auth（better-auth）

> 适用版本：better-auth@1.7.14。以下条目已对照当前源码（`src/server/auth/`）与自动化测试实测核对。

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

### CLI 不是 @better-auth/cli，且加载 auth.ts 会因 server-only 失败
- 症状：`npx auth@latest` 版本漂移；CLI 用 `jiti` 加载含 `import 'server-only'` 或 `@/` 别名的 `auth.ts` 会报 `MODULE_NOT_FOUND`。
- 根因：当前 CLI 包名是 `auth`，`jiti` 不支持 Next.js 的 `server-only` 与 `@/` 别名。
- 规则：用 `pnpm dlx auth@1.7.14 generate --config src/server/auth/auth.cli.ts --output src/server/db/schema/auth.ts --yes`，表迁移统一走 `drizzle-kit`。
- 元：better-auth@1.7.14 | 2026-11-16 | 候选毕业方向：已沉淀到 `src/server/auth/auth.cli.ts`

### twoFactor 插件不拦截 emailOTP 验证码登录
- 症状：管理员绑定了 TOTP 两步验证，但通过 `/sign-in/email-otp` 登录时直接拿到正式 session，完全跳过了 TOTP 校验。
- 根因：Better Auth 1.7.14 的 `twoFactor()` 插件 after-hook 只匹配密码/手机号登录路由，不匹配 `emailOTP` 的 `/sign-in/email-otp`。
- 规则：在 `twoFactorPlugins()` 的 `daydayon-two-factor-gate` 插件里复用 `twoFactorPlugin.hooks.after[0].handler` 拦截 `/sign-in/email-otp`：删正式 session、返回 `{ twoFactorRedirect: true }`，并在 `/two-factor/verify-totp` 成功后吊销其他旧会话。
- 元：better-auth@1.7.14 | 2026-11-16 | 候选毕业方向：已沉淀到 `src/server/auth/two-factor-gate.ts`

### 纯 OTP 无密码应用启用 twoFactor 必须显式开 allowPasswordless
- 症状：纯邮箱验证码应用里管理员调用 `/two-factor/enable` 报 `INVALID_PASSWORD`，无法生成 TOTP 密钥。
- 根因：Better Auth 的 `twoFactor()` 插件默认校验用户密码；`better-auth@1.7.14` 需显式传 `allowPasswordless: true` 才允许无密码账号绑定与验证。
- 规则：配置 `twoFactor({ issuer: 'DayDayOn', allowPasswordless: true })`，并在门禁插件里屏蔽 `/two-factor/disable`（禁止直接关闭 2FA）。
- 元：better-auth@1.7.14 | 2026-11-16 | 候选毕业方向：已沉淀到 `src/server/auth/two-factor-gate.ts`

### admin 插件默认暴露高危端点，由 two-factor-gate.ts 拦截返回 403
- 症状：引入 `admin()` 插件以复用封号/解封能力后，`/api/auth/admin/create-user`、`/set-role`、`/impersonate-user`、`/remove-user` 等端点一并对外开放。
- 根因：`admin()` 插件一次性注册全部管理路由，不支持按端点挑选。
- 规则：在 `two-factor-gate.ts` 的 `hooks.before` 里做端点分类（`classifyAuthPath`），未在 `ALLOWED_ADMIN_PATHS`（`ban-user`、`unban-user`、`revoke-user-sessions`）的 `/admin/*` 与 `/two-factor/disable` 一律抛 `APIError('FORBIDDEN', { code: 'FORBIDDEN' })` 返回 403，放行端点也强制校验 `role === 'admin'` 与 `twoFactorEnabled`。
- 元：better-auth@1.7.14 | 2026-11-16 | 候选毕业方向：已沉淀到 `src/server/auth/two-factor-gate.ts`

### hooks.before 里抛自定义错误用 APIError，且修改邮箱需返回 context.body
- 症状：`hooks.before` 里 `throw new Error()` 返回 500；不返回修改后的 `ctx.body` 时下游 handler 仍读到未规范化的邮箱。
- 根因：Better Auth 只把从 `better-auth/api` 导入的 `APIError` 映射成结构化 HTTP 错误体（`{ code, message, ... }`）。
- 规则：规范化后返回 `{ context: { body: { ...ctx.body, email: checked.email } } }`；拦截请求抛 `new APIError('BAD_REQUEST' | 'FORBIDDEN' | 'TOO_MANY_REQUESTS', { code, message, ... })`。
- 元：better-auth@1.7.14 | 2026-11-16 | 候选毕业方向：已沉淀到 `src/server/auth/hooks.ts`

### 内置限流对 `/sign-in/*` 默认设为 10 秒 3 次
- 症状：只给 `/email-otp/send-verification-otp` 配置了 `customRules`，用户在登录页重试或同局域网多人登录 `/sign-in/email-otp` 时立即触发 429。
- 根因：Better Auth 的 `getDefaultSpecialRules()` 对所有 `/sign-in*` 路径内置了 `window: 10, max: 3` 的严苛规则。
- 规则：在 `rateLimit.customRules` 中显式为 `AUTH_PATHS.signInOtp` 配置 `{ window: 60, max: 30 }`，单验证码防爆破由 `emailOTP({ allowedAttempts: 8 })` 负责。
- 元：better-auth@1.7.14 | 2026-11-02 | 候选毕业方向：已沉淀到 `src/server/auth/auth.ts`与 `paths.ts`

