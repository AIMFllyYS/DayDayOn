# 鉴权与会话规范

> 日期：2026-10-31 · 状态：初版。本文档由初始化时联网调研生成，条目未经实战验证，踩坑后按 [lessons 机制](../lessons/README.md)修订。
> 依据：[ADR-0014](../adr/0014-auth.md)（Better Auth 1.7）、[ADR-0002](../adr/0002-account-quota-risk.md) 第 3、6、7 节（邮箱白名单、限流、后台）。
> 官方资料（2026-10-31 抓取）：Better Auth 文档的 Email OTP、Admin、Rate Limit、Hooks、Next.js integration、Drizzle adapter、Telemetry 各页，以及 better-auth@1.7.14 的 registry 数据。库的坑见 [lessons/better-auth.md](../lessons/better-auth.md)。

## 1. 文件

```
src/server/auth/
├── auth.ts             betterAuth() 实例，全项目唯一
├── captcha-shapes.ts   自托管手账点选验证的 6 种矢量图标与仿射变形出题器
├── captcha.ts          /api/auth/captcha 出题/核验与 hooks.before 的 enforceTurnstile()
├── email-policy.ts     邮箱白名单与规范化（纯函数，必须有单元测试）
├── session.ts          getSession()、requireUser()、requireAdmin()
└── index.ts            对外只导出 session.ts 里的函数和类型
src/lib/auth-client.ts                 浏览器端 createAuthClient（从 better-auth/react 导入）+ emailOTPClient + adminClient
src/app/api/auth/[...all]/route.ts     先拦截 /api/auth/captcha，其余交由 toNextJsHandler(auth)
```

- 业务代码只用 `getSession()`、`requireUser()`、`requireAdmin()`，不直接 import `better-auth`。
- 登录页和后台的用户管理调用 `src/lib/auth-client.ts` 导出的方法。

## 2. auth.ts 必须包含的配置

| 配置 | 值 | 原因 |
|---|---|---|
| `database` | `drizzleAdapter(db, { provider: 'pg', schema })`，从 `better-auth/adapters/drizzle` 导入 | `better-auth` 已依赖 Drizzle 适配器并转出这个子路径，不另装 `@better-auth/drizzle-adapter` |
| `emailAndPassword` | 不开启 | 只用邮箱验证码登录 |
| `plugins` | `emailOTP(…)`、`admin()`、`twoFactor(…)` | ADR-0014。APK 阶段再加 `bearer` |
| emailOTP `allowedAttempts` | `5` | ADR-0002 第 6 节：错 5 次作废。默认是 3 |
| emailOTP `expiresIn` | `300`（默认） | 5 分钟 |
| emailOTP `storeOTP` | 哈希存储 | 默认明文。数据库泄露时验证码不可直接使用（取值写法在安装后按类型定义核对） |
| emailOTP `sendVerificationOTP` | 调 `src/server/mail/` 的 `sendOtp()`，**不 await**，但要 `.catch()` 记录失败 | 官方建议不等待发信，避免从响应时间推断邮箱状态 |
| `rateLimit` | `enabled: true`、`storage: 'database'`、`customRules` 见第 3 节 | 默认存内存（PM2 重启就清零），开发环境默认关闭 |
| `advanced.ipAddress.ipAddressHeaders` | `['x-real-ip']` | 默认读 `x-forwarded-for`，最左边的值可以被客户端伪造。Nginx 会覆盖写入 `X-Real-IP` |
| `telemetry` | `{ enabled: false }`；服务器 `.env` 另设 `BETTER_AUTH_TELEMETRY=0` | 双保险（官方说明默认关闭） |
| `trustedOrigins` | `[env.NEXT_PUBLIC_APP_URL]` | 只接受本站发起的鉴权请求 |
| `hooks.before` | 执行邮箱策略与按邮箱的限流（第 3、4 节） | |

- `auth.api.*` 在服务端直接调用时**不经过限流**（官方文档）。所以发验证码、登录只能由浏览器请求 `/api/auth/*` 触发，不要在 `/api/v1` 里包一层再调 `auth.api.sendVerificationOTP()`。
- 不自定义会话 cookie 的名字和前缀。自定义后 `getSessionCookie()` 要同步传参，容易漏。

## 3. 人机验证与限流

依据 [ADR-0023](../adr/0023-captcha.md) 与 [ADR-0002](../adr/0002-account-quota-risk.md) 第 6 节，点击「发送验证码」或「重新发送」后弹出自托管「治愈手账」点选验证框，并放宽同 IP 频控阈值以避免校园网/NAT 误伤：

| 规则 | 实现位置 |
|---|---|
| 发送验证码：点击按钮后弹出自托管手账点选验证框 | 前端调用 `captchaRef.current?.open()`（`src/components/ui/turnstile.tsx`）唤起弹窗，经 `GET / POST /api/auth/captcha` 顺次点选 3 个手账图标换取一次性 `passToken`，自动关窗并通过 `x-captcha-response` 请求头发送；服务端在 `hooks.before` 最前面调 `enforceTurnstile()`（`src/server/auth/captcha.ts`），未通过时直接拒绝且不消耗后续限流计数 |
| 发送验证码：同一 IP 每小时 100 次；验证码登录：同一 IP 每分钟 30 次 | Better Auth `customRules`（覆盖内置对 `/sign-in/*` 的 10 秒 3 次限制） |
| 发送验证码：同一 IP 每天 500 次（可调）；同一邮箱 60 秒 1 次、每天 100 次（可调） | `hooks.before` 里调用与 `/api/v1` 共用的计数函数 `consume()`（`src/server/rate-limit.ts`） |
| 同一 IP 每天最多 100 个新账号（可调） | `databaseHooks.user.create.before` 按 IP 计数 |
| 验证码连续错 8 次作废 | emailOTP `allowedAttempts: 8` |

- 端点路径（发送验证码、验证码登录）在安装后对照 `auth.api` 和插件源码核对，写进 `auth.ts` 的常量，不在多处手写字符串。
- 超限时抛 `APIError('TOO_MANY_REQUESTS', …)`，前端按 429 显示"太频繁了，稍等一会儿再试"。

## 4. 邮箱策略（email-policy.ts）

- 白名单是 ADR-0002 第 3 节的 11 个域名，写成 `email-policy.ts` 里的常量数组。新增域名只改这个数组。
- `normalizeEmail()`：去首尾空白、转小写；本地部分含 `+` 的拒绝；`gmail.com` 去掉本地部分的 `.`。
- 在 `hooks.before` 里对发送验证码和验证码登录两个端点执行：先规范化（用 hook 返回修改后的 `body`），再检查白名单，不在白名单抛 `APIError('BAD_REQUEST', …)`，前端显示"暂时只支持 QQ、网易、Gmail、Outlook、iCloud 和华科邮箱"。
- 单元测试必须覆盖：大小写、首尾空白、`+` 地址、Gmail 点号、白名单外域名、子域名（`mail.qq.com` 不在白名单内）。

## 5. 读会话

- `getSession()` 内部调用 `auth.api.getSession({ headers: await headers() })`。
- 调用 `getSession()` 的 Server Component 必须放在 `<Suspense>` 里，layout 顶层不 await 会话（[nextjs-16-patterns.md](./nextjs-16-patterns.md)）。
- 页面保护：在页面里（Suspense 内）取会话，未登录 `redirect('/login')`；新人引导未完成 `redirect('/onboarding')`。
- `src/proxy.ts` 只用 `getSessionCookie()` 判断 cookie 是否存在，用来提前跳转登录页。它不校验会话，不能当作安全检查；真正的校验在页面和接口里。
- Hono 中间件里用 `auth.api.getSession({ headers: c.req.raw.headers })`。
- `requireUser()` 在会话之外再查一次 `banned`：被封用户返回 403 `ACCOUNT_BANNED`（封号会吊销会话，这一步兜住会话缓存的空窗）。

## 6. 管理员

- 角色只用 admin 插件默认的 `admin` 和 `user`，v0.1 不定义自定义角色，不用代登录（impersonate）。
- `requireAdmin()` = `requireUser()` + `role === 'admin'` + 已开启两步验证。没开启两步验证的管理员访问 `/admin` 只看到"先开启两步验证"页面，接口返回 403 `TWO_FACTOR_REQUIRED`。两步验证字段名以 CLI 生成的 schema 为准。
- 两步验证只对管理员开放，普通用户界面里不出现入口。
- 第一个管理员：负责人先正常注册，再在服务器数据库里把自己的 `role` 改为 `admin`。这是服务器操作，执行前要得到负责人同意。
- 封号、解封、吊销会话都调用 admin 插件的方法，不直接改 `user` 表的字段。封号附原因，可设到期时间（ADR-0002 第 7 节）。

## 7. 环境变量

| 变量 | 说明 |
|---|---|
| `BETTER_AUTH_SECRET` | 至少 32 字节的随机串（同时用于会话签名与自托管点选人机验证的 AES-256-GCM 令牌加密）。服务器和本地各用各的 |
| `BETTER_AUTH_URL` | 站点地址，本地 `http://localhost:23329` |
| `BETTER_AUTH_TELEMETRY` | `0` |

## 8. 测试

- `email-policy.ts` 单元测试（第 4 节的清单）。
- `requireUser()` / `requireAdmin()` 用构造的会话对象测试各分支：无会话、被封禁、非管理员、管理员未开两步验证、通过。

