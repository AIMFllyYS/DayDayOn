# lessons — 人机验证（自托管手账点选弹窗 `turnstile.tsx` / `captcha.ts`）

> 历史背景：初版曾接入 `@marsidev/react-turnstile@1.6.3`（Cloudflare Turnstile），因未配外部密钥时强制显示红字「仅用于测试目的」水印且国内跨境链路偶发转圈，已于 2026-11-02 卸载并替换为同源「治愈手账」点选弹窗验证（[ADR-0023](../adr/0023-captcha.md)）。

### 单题 `challengeId` 若允许重复提交会被脚本网格穷举
- 症状：若答错时不销毁 `challengeId`，脚本可对同一张 `280×84` 画布按 `28px` 步长网格在几十次请求内穷举出 3 个目标点。
- 根因：点选验证码的画布尺寸有限，若服务端仅在答对时消费 nonce，错误尝试不会使旧题目失效。
- 规则：`solveCaptchaChallenge()` 在解密 `challengeId` 后必须**无论答对答错立即调用 `consumeNonceOnce('c:' + id)` 销毁该题**，并在失败响应里直接附带新生成的 `challenge` 供前端无缝换题。
- 元：自托管点选验证 | 2026-11-02 | 候选毕业方向：已固化到 `src/server/auth/captcha.ts` 与单元测试

### 通行令牌 `passToken` 一次性有效，发码后必须立即 reset
- 症状：第一次点「发送验证码」因邮箱未注册或频控报错后，用户再次提交或 60 秒后点「重新发送」，若复用旧 `passToken` 会返回 `403 VERIFICATION_FAILED`（`timeout-or-duplicate`）。
- 根因：`verifyTurnstileToken()` 对每个 `passToken` 执行一次性 nonce 消费，消费后即作废。
- 规则：每次点击「发送验证码」或「重新发送」都通过 `captchaRef.current?.open()` 重新走一次点选弹窗获取新 `passToken`，并在发码请求结束后调用 `captchaRef.current?.reset()` 清空状态。
- 元：自托管点选验证 | 2026-11-02 | 候选毕业方向：已沉淀到 `src/features/auth/components/login-card.tsx`

### 父组件内联传入 `onError` 回调会导致点选第 3 下时重拉题目覆盖通过态
- 症状：用户在弹窗内点完第 3 个图标后，弹窗没有进入 `passed` 态自动关闭，而是闪回第一题。
- 根因：`LoginCard` 传入了内联箭头函数 `onCaptchaError={() => setError(...)}`；若 `fetchChallenge` 的 `useCallback` 依赖包含 `onError`，父组件任意重渲染都会生成新 `fetchChallenge` 引用并触发 `useEffect` 重新拉题。
- 规则：`src/components/ui/turnstile.tsx` 内部用 `onErrorRef`（在 `useEffect` 中同步）持有 `onError` 回调，拉题 `useEffect` 只依赖值类型的 `[open, action, round]`。
- 元：React 19 + TurnstileField | 2026-11-02 | 候选毕业方向：已沉淀到 `src/components/ui/turnstile.tsx`

