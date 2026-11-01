# lessons — AI SDK 与 DeepSeek（ai、@ai-sdk/deepseek、@ai-sdk/react）

> 适用版本：ai@7.0.159、@ai-sdk/deepseek@3.0.77、@ai-sdk/react@4.0.163（M3 安装）。以下条目来自 2026-10-31 对 AI SDK 文档和 DeepSeek「模型 & 价格」页的核对，尚未在本项目代码里踩到。

### 字符串模型 id 走了 Vercel AI Gateway
- 症状：`model: 'deepseek/deepseek-flash'` 要求 `AI_GATEWAY_API_KEY`，或请求绕道 Vercel。
- 根因：AI SDK 对字符串模型默认使用 AI Gateway。
- 规则：只用 `src/server/ai/model.ts` 导出的 provider 实例（`createDeepSeek({ apiKey })('deepseek-flash')`）。
- 元：ai@7.0.159 | 2026-10-31 | 候选毕业方向：封装层（`model.ts`）+ lint

### 思考模式默认开启
- 症状：识别类调用的输出 tokens 和费用比预估高；设置的 `temperature` 不生效并报 unsupported 警告。
- 根因：DeepSeek V4 系列默认开启思考；开启时 `temperature`、`topP` 被忽略。
- 规则：每个 prompt 显式声明 `thinking`；结构化识别用 `{ type: 'disabled' }`。
- 元：@ai-sdk/deepseek@3.0.77 | 2026-10-31 | 候选毕业方向：封装层（`prompts/` 的类型要求必填）

### 用 Files API 上传图片
- 症状：照 provider 文档用 `uploadFile` + `deepSeek.files()` 传图。
- 根因：DeepSeek Files API 会在 DeepSeek 一侧保存文件，不设 `expiresAfter` 就永久保存，违反"图片不上云"。
- 规则：图片只作为内联 file part 发送，禁止 `uploadFile`。
- 元：@ai-sdk/deepseek@3.0.77 | 2026-10-31 | 候选毕业方向：lint（禁止从 `ai` 导入 `uploadFile`）

### 旧模型名和 v4 模型名
- 症状：照旧文章写 `deepseek-chat`、`deepseek-reasoner` 报错；或写 `deepseek-v4-flash`。
- 根因：前两个别名已于 2026-07-24 下线；`deepseek-v4-flash` 仍可调用但对应模型已下线，DeepSeek 要求使用 `deepseek-flash`。
- 规则：只写 `deepseek-flash`。
- 元：@ai-sdk/deepseek@3.0.77 | 2026-10-31 | 候选毕业方向：封装层（`model.ts`）

### 测试 mock 用旧版类名或旧 usage 结构
- 症状：照旧教程写 `MockLanguageModelV2`、`usage: { inputTokens: 10 }`，类型报错。
- 根因：AI SDK 7 的测试工具是 `ai/test` 的 `MockLanguageModelV4`，usage 是分层结构（`inputTokens: { total, noCache, cacheRead, … }`）。
- 规则：以官方 Testing 文档为准写 mock。
- 元：ai@7.0.159 | 2026-10-31 | 候选毕业方向：无

### 结构化输出用 generateText + Output.object，不用已废弃的 generateObject
- 症状：照旧版文档写 `generateObject({ model, schema })` 触发废弃警告，且与 DeepSeek 的响应格式配合不如 `Output.object` 稳健。
- 根因：AI SDK 7 已将结构化输出统一收敛到 `generateText({ ..., output: Output.object({ schema }) })`，结果从 `result.output` 读取。
- 规则：`src/server/ai/call-model.ts` 统一使用 `generateText` + `Output.object({ schema })`，并对 `NoObjectGeneratedError` 捕获后归类为 `'invalid-output'`（已消耗的 token 照常按实际用量结算）。
- 元：ai@7.0.159 | 2026-11-01 | 候选毕业方向：已沉淀到 `src/server/ai/call-model.ts`

### DeepSeek 缓存命中与未命中 token 从 inputTokenDetails 读取
- 症状：直接用 `usage.inputTokens` 按未命中单价计费，缓存命中时多扣了用户的钱。
- 根因：AI SDK 7 把细分缓存统计放在 `usage.inputTokenDetails`（`noCacheTokens`、`cacheReadTokens`），当 provider 未拆分时才回退到 `usage.inputTokens`。
- 规则：通过 `src/server/ai/pricing.ts` 的 `normalizeUsage(usage)` 统一提取 `inputMissTokens` 与 `inputHitTokens`，再按 DeepSeek 命中/未命中单价精确算微元。
- 元：ai@7.0.159、@ai-sdk/deepseek@3.0.77 | 2026-11-01 | 候选毕业方向：已沉淀到 `src/server/ai/pricing.ts`

