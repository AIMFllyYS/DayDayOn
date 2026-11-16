# 鉴权与会话规范

> 日期：2026-10-31（2026-11-16 对齐最新实现） · 状态：已按最新服务端代码核对同步。踩坑经验见 [lessons/better-auth.md](../lessons/better-auth.md)。
> 依据：[ADR-0014](../adr/0014-auth.md)（Better Auth 1.7）、[ADR-0023](../adr/0023-captcha.md)（自托管点选人机验证）、[ADR-0002](../adr/0002-account-quota-risk.md) 第 3、6、7 节（邮箱白名单、限流、后台）。
> 官方资料（2026-10-31 抓取）：Better Auth 文档的 Email OTP、Admin、Rate Limit、Hooks、Next.js integration、Drizzle adapter、Telemetry 各页，以及 better-auth@1.7.14 的 registry 数据。

## 1. 文件

```
src/server/auth/
├── auth.ts             betterAuth() 实例，全项目唯一（secret/baseURL/trustedOrigins 懒读取）
├── auth.cli.ts         专供 auth@1.7.14 CLI 读取的精简配置入口（不含 server-only 与 @/ 别名）
├── paths.ts            Better Auth 端点路径常量 AUTH_PATHS（auth.ts、hooks.ts、two-factor-gate.ts 共用）
├── hooks.ts            beforeHook、afterHook 与 databaseHooks（邮箱策略、人机验证、限流、审计、注册建档与 IP 告警）
├── two-factor-gate.ts  twoFactorPlugins()：免密 twoFactor + /sign-in/email-otp 2FA 拦截 + admin 端点白名单门禁
├── captcha-shapes.ts   自托管手账点选验证的 6 种矢量图标与仿射变形出题器（旋转 ±18°、缩放 1.28–1.42）
├── captcha.ts          /api/auth/captcha 出题/核验、rate_limit_counters 持久化 nonce 与 enforceTurnstile()
├── email-policy.ts     邮箱白名单与规范化（纯函数，带单元测试）
├── account-state.ts    loadAccountState()：单条 LEFT JOIN 实时查询封禁字段与 profiles.onboardedAt
├── guards.ts           isBanned()、banInfo()、checkAccount()、checkOnboarded()、checkAdmin()（纯函数，带单元测试）
├── session.ts          getSession()、getSessionFromHeaders()、requireUser()、requireOnboardedUser()、requireAdmin()、isBanned()
├── cookie.ts           转出 getSessionCookie 给 src/proxy.ts 使用（不含 server-only）
├── ip.ts               clientIp()、LOCAL_IP（只读 x-real-ip，本地记 127.0.0.1）
└── index.ts            对外统一导出会话函数（getSession、getSessionFromHeaders、isBanned、requireAdmin、requireOnboardedUser、requireUser）与类型（Session、SessionData、SessionUser）
src/lib/auth-client.ts                 浏览器端 createAuthClient（从 better-auth/react 导入）+ emailOTPClient + adminClient + twoFactorClient
src/app/api/auth/[...all]/route.ts     先拦截 /api/auth/captcha，其余交由 toNextJsHandler(auth)
```

- 业务代码只用 `src/server/auth/index.ts` 导出的会话函数和类型，不直接 import `better-auth`（`eslint.config.mjs` 强制）。
- `src/proxy.ts` 通过 `src/server/auth/cookie.ts` 调 `getSessionCookie()`。
- 登录页和后台的用户管理调用 `src/lib/auth-client.ts` 导出的方法。

## 2. auth.ts 必须包含的配置

| 配置 | 值 | 原因 |
|---|---|---|
| `database` | `drizzleAdapter(db, { provider: 'pg', schema })`，从 `better-auth/adapters/drizzle` 导入 | `better-auth` 已依赖 Drizzle 适配器并转出这个子路径，不另装 `@better-auth/drizzle-adapter` |
| `emailAndPassword` | `{ enabled: false }` | 只用邮箱验证码登录 |
| `plugins` | `emailOTP(…)`、`admin()`、`...twoFactorPlugins()` | ADR-0014、ADR-0002。`twoFactorPlugins()` 含免密 `twoFactor` 与门禁插件 `daydayon-two-factor-gate`。APK 阶段再加 `bearer` |
| emailOTP `allowedAttempts` | `8` | 与 ADR-0023 及 `auth.ts` 一致：单验证码连续错 8 次作废（默认 3） |
| emailOTP `expiresIn` | `300` | 5 分钟 |
| emailOTP `storeOTP` | `'hashed'` | 默认明文。数据库泄露时验证码不可直接使用（已按类型定义与 `auth.ts` 核对） |
| emailOTP `sendVerificationOTP` | 调 `src/server/mail/` 的 `sendOtp()`，**不 await**，但要 `.catch()` 记录失败 | 官方建议不等待发信，避免从响应时间推断邮箱状态 |
| `rateLimit` | `enabled: true`、`storage: 'database'`、`customRules` 见第 3 节 | 默认存内存（PM2 重启就清零），开发环境默认关闭 |
| `advanced.ipAddress.ipAddressHeaders` | `['x-real-ip']` | 默认读 `x-forwarded-for`，最左边的值可以被客户端伪造。Nginx 会覆盖写入 `X-Real-IP` |
| `telemetry` | `{ enabled: false }`；`instrumentation.ts` 另默认设 `BETTER_AUTH_TELEMETRY=0` | 双保险 |
| `trustedOrigins` | `() => [env.NEXT_PUBLIC_APP_URL]`（`secret` / `baseURL` 同用 getter 懒读取） | 只接受本站发起的鉴权请求，且 `next build` 不触发环境变量校验 |
| `hooks` / `databaseHooks` | 挂 `beforeHook`、`afterHook`、`databaseHooks`（`hooks.ts`） | 邮箱策略、人机验证、限流、封号登录改写、管理员审计、注册初始化与 IP 告警 |

- `auth.api.*` 在服务端直接调用时**不经过限流**（官方文档）。所以发验证码、登录只能由浏览器请求 `/api/auth/*` 触发，不要在 `/api/v1` 里包一层再调 `auth.api.sendVerificationOTP()`。
- 不自定义会话 cookie 的名字和前缀。自定义后 `getSessionCookie()` 要同步传参，容易漏。

## 3. 人机验证与限流

依据 [ADR-0023](../adr/0023-captcha.md) 与 [ADR-0002](../adr/0002-account-quota-risk.md) 第 6 节，点击「发送验证码」或「重新发送」后弹出自托管「治愈手账」点选验证框，并放宽同 IP 频控阈值以避免校园网/NAT 误伤：

| 规则 | 实现位置 |
|---|---|
| 发送验证码：点击按钮后弹出自托管手账点选验证框 | 前端调用 `captchaRef.current?.open()`（`src/components/ui/turnstile.tsx`）唤起弹窗，经 `GET / POST /api/auth/captcha` 顺次点选 3 个手账图标换取一次性 `passToken`，自动关窗并通过 `x-captcha-response` 请求头发送；`hooks.before` 在邮箱格式与白名单校验通过后调 `enforceTurnstile()`（`src/server/auth/captcha.ts`），经 `rate_limit_counters` 持久化一次性 nonce 防重放，未通过直接拒绝（`400 MISSING_RESPONSE` / `403 VERIFICATION_FAILED`）且不消耗后续限流计数 |
| 发送验证码：同一 IP 每小时 100 次；验证码登录：同一 IP 每分钟 30 次 | Better Auth `rateLimit.customRules`（覆盖内置对 `/sign-in/*` 的 10 秒 3 次限制） |
| 发送验证码：同一 IP 每天 500 次（可调）；同一邮箱 60 秒 1 次、每天 100 次（可调） | `hooks.before` 里调用与 `/api/v1` 共用的计数函数 `consume()`（`src/server/rate-limit.ts`） |
| 同一 IP 每天最多 100 个新账号（可调）；当日第 4 个起触发异常告警 | `databaseHooks.user.create.before` 按 IP 调 `consume()` 计数：当 `r.count > 3` 时调用 `maybeAlert('ip-multi-account', ...)` 告警，超过 `signupPerIpDaily` 时拒绝 |
| 验证码连续错 8 次作废 | emailOTP `allowedAttempts: 8` |

- 端点路径统一定义在 `src/server/auth/paths.ts` 的 `AUTH_PATHS`（已对照 `better-auth@1.7.14` 插件源码核对），`auth.ts`、`hooks.ts`、`two-factor-gate.ts` 共用，不在多处手写字符串。
- 超限时抛 `APIError('TOO_MANY_REQUESTS', { code: 'RATE_LIMITED', message, retryAfterSeconds }, { 'Retry-After': ... })`（前端展示用 `retryAfterSeconds` 最高封顶 1800 秒），前端按 `code` 显示提示。

## 4. 邮箱策略（email-policy.ts 与 hooks.ts）

- 白名单是 ADR-0002 第 3 节的 11 个域名，写成 `email-policy.ts` 里的常量数组 `ALLOWED_EMAIL_DOMAINS`。新增域名只改这个数组。
- `normalizeEmail()`：去首尾空白、转小写；本地部分含 `+` 拒绝（`plus-address`）；`gmail.com` 去掉本地部分的 `.`。
- 在 `hooks.ts` 的 `beforeHook` 里对 `sendOtp` 和 `signInOtp` 两个端点**最先**执行 `checkEmail()`：
  - 域名不在白名单（`domain-not-allowed`）：抛 `APIError('BAD_REQUEST', { code: 'EMAIL_DOMAIN_NOT_ALLOWED', message: '暂时只支持 QQ、网易、Gmail、Outlook、iCloud 和华科邮箱' })`。
  - 格式不合法或含 `+` 别名（`invalid` / `plus-address`）：抛 `APIError('BAD_REQUEST', { code: 'VALIDATION_FAILED', message, fields: { email: [message] } })`。
  - 通过后把 `ctx.body.email` 改写为规范化结果 `{ context: { body: { ...ctx.body, email: checked.email } } }`。
- 单元测试（`email-policy.test.ts`）覆盖：大小写、首尾空白、`+` 地址、Gmail 点号、白名单外域名、子域名（`mail.qq.com` 不在白名单内）。

## 5. 读会话

- `getSession()` 内部调用 `getSessionFromHeaders(await headers())`（`auth.api.getSession({ headers })`）。
- 调用 `getSession()` 的 Server Component 必须放在 `<Suspense>` 里，layout 顶层不 await 会话（[nextjs-16-patterns.md](./nextjs-16-patterns.md)）。
- 页面保护：在页面里（Suspense 内）调用 `requireUser()` / `requireOnboardedUser()`，未登录 `redirect('/login')`；被封 `redirect('/login?banned=1')`；新人引导未完成 `redirect('/onboarding')`。
- `src/proxy.ts` 只用 `cookie.ts` 转出的 `getSessionCookie()` 判断 cookie 是否存在，用来提前跳转登录页。它不校验会话，不能当作安全检查；真正的校验在页面和接口里。
- Hono 中间件里用 `getSessionFromHeaders(c.req.raw.headers)`。
- `requireUser()`（页面版与 Hono 中间件版）都在会话之外实时查库 `loadAccountState()`（检查 `user.banned` / `banExpires` 与 `profiles.onboardedAt`）：被封用户分别重定向或返回 403 `ACCOUNT_BANNED`（封号会吊销会话，这一步兜住会话缓存的空窗）。

## 6. 管理员与两步验证

- 角色只用 admin 插件默认的 `admin` 和 `user`，v0.1 不定义自定义角色，不用代登录（impersonate）。
- **页面版 vs API 版 `requireAdmin` 职责严格区分**：
  - **页面版 `requireAdmin()`**（`src/server/auth/session.ts`，用于 `src/app/admin/layout.tsx`）：仅调用 `requireUser()` 并校验 `role === 'admin'`（非管理员 `redirect('/')`），**不强制要求已开启两步验证**，而是返回 `{ ...user, twoFactorEnabled: user.twoFactorEnabled === true }`，以便管理员访问 `/admin` 时若 `twoFactorEnabled` 为 `false` 能看到 `<TwoFactorSetup />` 完成绑定。
  - **API 版 `requireAdmin`**（`src/server/api/middleware/auth.ts` 中间件，以及 `src/server/auth/two-factor-gate.ts` 保护的 `/api/auth/admin/*`）：调用 `guards.ts` 的 `checkAdmin()`，**同时强制校验 `role === 'admin'`（否则 `403 FORBIDDEN`）与 `user.twoFactorEnabled === true`（否则 `403 TWO_FACTOR_REQUIRED`）**。
- `twoFactorPlugins()`（`src/server/auth/two-factor-gate.ts`）：开启免密 `twoFactor({ issuer: 'DayDayOn', allowPasswordless: true })`，并在 `hooks.after` 补齐 `/sign-in/email-otp` 的两步验证拦截（已绑定 2FA 的管理员登录时销毁临时会话并返回 `{ twoFactorRedirect: true }`）与绑定成功后吊销其他旧会话；在 `hooks.before` 拦截 `/two-factor/disable` 与白名单（`ban-user`、`unban-user`、`revoke-user-sessions`）之外的全部 `/admin/*` 端点，一律返回 `403 FORBIDDEN`。
- 两步验证只对管理员开放，普通用户界面里不出现入口。
- 第一个管理员：负责人先正常注册，再在服务器数据库里把自己的 `role` 改为 `admin`。这是服务器操作，执行前要得到负责人同意。
- 封号、解封、吊销会话都调用 admin 插件的方法，不直接改 `user` 表的字段。封号附原因，可设到期时间（ADR-0002 第 7 节）。`hooks.ts` 的 `afterHook` 在操作成功后写入 `admin_audit_logs`，并在封号用户尝试登录时把 `BANNED_USER` 改写为带 `ban` 信息的 `403 ACCOUNT_BANNED`。

## 7. 环境变量

| 变量 | 说明 |
|---|---|
| `BETTER_AUTH_SECRET` | 至少 32 字节的随机串（同时用于会话签名与自托管点选人机验证的 AES-256-GCM 令牌加密）。服务器和本地各用各的 |
| `BETTER_AUTH_URL` | 站点地址，本地 `http://localhost:23329` |
| `BETTER_AUTH_TELEMETRY` | `0` |

## 8. 测试

- `email-policy.test.ts`：`normalizeEmail` / `checkEmail` 单元测试（第 4 节清单）。
- `guards.test.ts` 与 `src/server/api/middleware/auth.test.ts`：`requireUser` / `requireOnboarded` / `requireAdmin` 各分支（无会话、被封禁、未引导、非管理员、管理员未开两步验证、通过）。
- `two-factor-gate.test.ts`：基于内存适配器的完整 Better Auth hook 流水线测试（`/sign-in/email-otp` 2FA 拦截、绑定后吊销旧会话、未开放 `/admin/*` 与 `/two-factor/disable` 返回 403）。
- `hooks.test.ts` 与 `captcha.test.ts`：同 IP 多账号第 4 次触发 `ip-multi-account` 告警、超限 `RATE_LIMITED`、人机验证防穷举与防重放。


