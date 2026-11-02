# ADR-0023：人机验证与风控频控升级——自托管「治愈手账」点选弹窗验证

- 状态：Accepted（负责人 2026-11-02 拍板；同日由 Cloudflare Turnstile 修订为自托管点选验证）
- 日期：2026-11-02
- 决策人：项目负责人（AI 提供分析与落地）

## 背景

- 单纯依赖 IP 限流在校园网（如华科 `hust.edu.cn`）、公司 NAT、合租宽带与本地开发（`127.0.0.1`）下极易误伤正常用户；而把 IP 阈值调大却不加人机验证，又会让 SMTP 发信额度暴露在脚本盗刷风险下。
- 需要在点击「发送验证码」（含验证码页「重新发送」）时弹出独立的人机验证框，验证通过后自动关窗并下发邮件验证码，同时放宽同 IP 限流阈值。
- 初版尝试接入 Cloudflare Turnstile（`@marsidev/react-turnstile`），但实测暴露出两个痛点：
  1. 未配置外部控制台密钥时，Cloudflare 测试公钥会在验证框内强制渲染红色「仅用于测试目的」水印且无条件放行；
  2. 国内校园网与移动网络直连 `challenges.cloudflare.com` 存在跨境抖动，且服务端 `siteverify` 跨国回源会拖慢发码响应。
- 红线：不使用腾讯云的任何服务（ADR-0002），不引入带 GPL 传染或重型 native 依赖的第三方验证码库。

## 面临的选项

- **同源「治愈手账」图标顺次点选弹窗（自研 Canvas 矢量仿射变形 + AES-256-GCM 一次性令牌）**：推荐。100% 走武汉阿里云 ECS 同源接口（国内 10–30ms 瞬开），零第三方云账号与外部密钥（直接复用 `BETTER_AUTH_SECRET`），零新增 npm 依赖，视觉与手账风完全统一。
- **Cloudflare Turnstile（`@marsidev/react-turnstile`）**：已尝试后弃用。跨境网络在国内偶发加载慢或持续转圈，不配外部密钥会有红字测试水印。
- **阿里云行为验证码 2.0**：不采用。需开通云产品按量计费并管理额外 AccessKey，客户端 SDK 为命令式全局脚本。
- **开源滑块/点选组件库（如 `rc-slider-captcha`、`altcha`）**：不采用。纯前端滑块缺同源服务端坐标核验，或样式与手账设计系统割裂。

## 决定

不引入外部验证码库，采用 **自托管「治愈手账」点选弹窗验证**（已卸载 `@marsidev/react-turnstile`）。

- **交互形态（按需弹窗）**：登录页默认不展示验证画布；用户填好邮箱点击「发送验证码」（或验证码页点击「重新发送」）后，弹出独立的 Base UI `Dialog` 安全验证弹窗。用户按顶部提示顺次点选 3 个手账图标后，0.2 秒自动关闭弹窗并立即触发发码请求。
- **前端封装层入口**：`src/components/ui/turnstile.tsx`（导出 `TurnstileField` 与 `TurnstileFieldRef`，通过 `ref.current?.open()` 唤起弹窗、`onTokenChange(token)` 回调一次性通行令牌）。
- **服务端题库与校验入口**：
  - `src/server/auth/captcha-shapes.ts`：定义 6 种高辨识度手账风矢量图标（月亮、爱心、星星、太阳、铃铛、小房），每次出题随机抽取 3 个目标 + 1 个干扰项 + 手绘噪点线条，在服务端完成随机位置、旋转（`±26°`）、缩放（`0.88–1.12`）仿射变换并烘焙为纯画布坐标。
  - `src/server/auth/captcha.ts`（挂载于 `/api/auth/captcha`）：
    1. `GET /api/auth/captcha`：下发题干 `prompt`、混淆后的画布 `strokes` 与 AES-256-GCM 加密的 `challengeId`（目标中心坐标只存在于服务端密文中，前端 JSON 与 DOM 不含任何明文坐标或图标名称）。
    2. `POST /api/auth/captcha`：校验 3 次顺次点击坐标的欧氏距离（`≤ 28px`）与人类操作耗时（`180ms–120s`）；**单次 `challengeId` 无论答对答错立即销毁**（防单题坐标穷举），通过后签发一次性 `passToken`。
    3. `enforceTurnstile` / `verifyTurnstileToken`：在 `src/server/auth/hooks.ts` 的 `beforeHook` 最前面校验 `x-captcha-response` 请求头中的 `passToken` 并一次性消费。
- **先验签、后计数**：人机验证未通过时直接返回 `400 MISSING_RESPONSE` 或 `403 VERIFICATION_FAILED`，不消耗用户的邮箱 60 秒冷却与每日发送次数。
- **零额外环境变量**：直接基于现有的 `BETTER_AUTH_SECRET`（SHA-256 派生密钥）执行 AES-256-GCM 认证加密，本地开发、CI 与生产环境开箱即用。
- **同步放宽 IP 限流基线**：
  - 发送验证码同 IP 每小时上限：`20` → `100`（`auth.ts` `customRules`）
  - 验证码登录同 IP 每分钟上限：显式设为 `30`（覆盖 Better Auth 默认对 `/sign-in/*` 的 10 秒 3 次限制）
  - 同一 IP 每天新注册账号数（`signupPerIpDaily`）：默认 `100`（上限 `1000`）
  - 同一邮箱每天验证码数（`otpPerEmailDaily`）：默认 `100`（上限 `500`）
  - 同一 IP 每天验证码数（`otpPerIpDaily`）：默认 `500`（上限 `5000`）

## 理由

- **国内网络 100% 稳定**：静态资源与 `/api/auth/captcha` 均由武汉 ECS 同源提供，彻底消除跨境加载失败与转圈问题。
- **有效拦截自动化脚本**：无密钥接口脚本无法解密 `challengeId` 中的答案坐标；无头浏览器（Playwright / Puppeteer）面对无 DOM 节点的单张 `<canvas>` 及服务端仿射变形路径，无法用选择器自动点击；单题即焚机制杜绝了网格暴力试错。
- **零外部成本与零依赖负担**：无需申请第三方平台密钥，移除外部包后构建体积更轻。

## 放弃了什么

- Cloudflare Turnstile 的静默无感通过模式：换取国内全网稳定性、零外部密钥依赖与更契合手账气质的轻量点选交互（仅在发码瞬间点 3 下，耗时约 1.5 秒）。

## 何时重审

- 观测到针对 Canvas 图像采取多模态视觉模型（VLM）自动打码的高级灰产攻击时（届时可叠加前端 SHA-256 PoW 工作量证明或升级题库复杂度）。
