# ADR-0023：人机验证与风控频控升级——Cloudflare Turnstile

- 状态：Accepted（负责人 2026-11-02 拍板）
- 日期：2026-11-02
- 决策人：项目负责人（AI 提供分析与落地）

## 背景

- 单纯依赖 IP 限流在校园网（如华科 `hust.edu.cn`）、公司 NAT、合租宽带与本地开发（`127.0.0.1`）下极易误伤正常用户；而把 IP 阈值调大却不加人机验证，又会让 SMTP 发信额度暴露在脚本盗刷风险下。
- 需要在点击「发送验证码」（含验证码页「重新发送」）时前置成熟的人机验证，验证通过才下发邮件验证码，并同步放宽同 IP 限流阈值。
- 红线：不使用腾讯云的任何服务（ADR-0002）。

## 面临的选项

- **Cloudflare Turnstile + `@marsidev/react-turnstile`**：推荐。智能无感（绝大多数真实用户无需拼图点选）、完全免费无调用量上限；`@marsidev/react-turnstile@1.6.3` 为 Cloudflare 官方文档推荐的 React 封装（0 传递依赖、MIT、原生支持 React 19）。
- **阿里云行为验证码 2.0**：备选。与武汉 ECS 同源、国内延迟极低，但需开通云产品并按量计费，客户端 SDK 为命令式全局脚本。
- **极验 Geetest 4.0**：不采用。商业授权费用高，SDK 体积大。
- **纯前端自研滑块 / 拼图**：不采用。无法防御无头浏览器（Puppeteer / Playwright）自动化脚本。

## 决定

采用 **Cloudflare Turnstile**，前端组件库选用 `@marsidev/react-turnstile`（版本 `1.6.3`）。

- **前端封装层入口**：`src/components/ui/turnstile.tsx`（导出 `TurnstileField` 与 `TurnstileFieldRef`），业务代码禁止直接 import `@marsidev/react-turnstile`。
- **服务端校验入口**：`src/server/auth/captcha.ts`（导出 `enforceTurnstile` 与纯函数 `verifyTurnstileToken`），在 `src/server/auth/hooks.ts` 的 `beforeHook` 中对 `/email-otp/send-verification-otp` 最先执行。
- **请求头协议**：客户端通过 `x-captcha-response` 请求头传递一次性 token（与 Better Auth 内置 captcha 插件协议一致）。
- **先验签、后计数**：人机验证未通过时直接返回 `400 MISSING_RESPONSE` 或 `403 VERIFICATION_FAILED`，不消耗用户的邮箱 60 秒冷却与每日发送次数。
- **环境变量与开发兜底**：`NEXT_PUBLIC_TURNSTILE_SITE_KEY` 与 `TURNSTILE_SECRET_KEY`；未配置时自动回退到 Cloudflare 官方测试密钥对（`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`），保证本地开发与 Playbook 开箱即用。
- **同步放宽 IP 限流基线**：
  - 发送验证码同 IP 每小时上限：`20` → `100`（`auth.ts` `customRules`）
  - 验证码登录同 IP 每分钟上限：显式设为 `30`（覆盖 Better Auth 默认对 `/sign-in/*` 的 10 秒 3 次限制）
  - 同一 IP 每天新注册账号数（`signupPerIpDaily`）：默认 `100`（上限 `1000`）
  - 同一邮箱每天验证码数（`otpPerEmailDaily`）：默认 `100`（上限 `500`）
  - 同一 IP 每天验证码数（`otpPerIpDaily`）：默认 `500`（上限 `5000`）

## 理由

- 90% 以上真实用户静默通过，不破坏「治愈手账」的轻量登录体验。
- 0 传递依赖、约 3.2 KB（minified），React 19 peerDependency 原生兼容。
- 服务端校验仅需一次 `fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify')`（含 10 秒超时），不增加服务端依赖。
- 有了人机验证前置拦截自动化脚本，IP 限流得以安全放宽，彻底消除校园网 / 局域网共用出口 IP 的误锁问题。

## 放弃了什么

- 阿里云行为验证码 2.0：省去云产品按量计费与 AccessKey 运维成本；若未来国内特定网络出现 Turnstile 可达性问题，可在 `TurnstileField` 与 `captcha.ts` 封装层内平替。

## 何时重审

- 国内特定运营商网络下 Turnstile 脚本加载失败率明显上升时（评估切换阿里云行为验证码 2.0）。
