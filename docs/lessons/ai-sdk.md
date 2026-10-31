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

