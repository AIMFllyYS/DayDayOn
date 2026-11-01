# lessons — Cloudflare Turnstile（@marsidev/react-turnstile）

> 适用版本：`@marsidev/react-turnstile@1.6.3`（2026-11-02 安装）。

### 未传 id 时多实例共享默认 `cf-turnstile` 容器 id
- 症状：同一页面渲染多个 `<Turnstile>`（如 Playbook 同时展示手机与桌面预览）时，脚本挂载或 `reset()` 互相覆盖。
- 根因：`@marsidev/react-turnstile` 在未传 `id` prop 时默认使用固定字符串 `'cf-turnstile'` 作为 DOM 容器 id。
- 规则：封装层 `src/components/ui/turnstile.tsx` 内部统一用 `useId()` 生成唯一 `id` 传给 `<Turnstile>`。
- 元：@marsidev/react-turnstile@1.6.3 | 2026-11-02 | 候选毕业方向：已沉淀到 `src/components/ui/turnstile.tsx`

### Turnstile token 一次性有效，发码失败或重发前未 reset 会报验证失败
- 症状：第一次点「发送验证码」因邮箱后缀不支持报错后，用户改好邮箱再点提交，或 60 秒后在验证码页点「重新发送」，服务端返回 `VERIFICATION_FAILED`（`timeout-or-duplicate`）。
- 根因：Cloudflare Turnstile 的每个 token 只能被 `siteverify` 消费一次，消费后即作废。
- 规则：每次调用发码接口后（无论成功或失败）必须立即调用 `captchaRef.current?.reset()`；验证码输入步骤（`CodeStep`）挂载 `appearance="interaction-only"` 的 `TurnstileField` 提前静默准备重发所需的 token。
- 元：@marsidev/react-turnstile@1.6.3 | 2026-11-02 | 候选毕业方向：已沉淀到 `src/features/auth/components/login-card.tsx`

### 测试 Site Key 与真实 Secret Key 不可混用
- 症状：前端用了 Cloudflare 测试 Site Key（`1x00000000000000000000AA`），后端配了正式 Secret Key（或相反），`siteverify` 永远返回 `invalid-input-response`。
- 根因：Cloudflare 的测试 Site Key 产出的 `XXXX.DUMMY.TOKEN.XXXX` 只能由测试 Secret Key（`1x0000000000000000000000000000000AA`）通过校验。
- 规则：`NEXT_PUBLIC_TURNSTILE_SITE_KEY` 与 `TURNSTILE_SECRET_KEY` 必须成对配置或同时留空（同时留空时前后端一并回退到官方测试密钥对）。
- 元：@marsidev/react-turnstile@1.6.3 | 2026-11-02 | 候选毕业方向：无
