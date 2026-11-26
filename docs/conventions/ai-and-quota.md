# AI 调用、额度与图片规范

> 日期：2026-10-31（2026-11-26 同步最新实现）· 状态：已落地。本文档与仓库源码、ESLint 硬约束及 [ADR-0002](../adr/0002-account-quota-risk.md) 保持同步，踩坑后按 [lessons 机制](../lessons/README.md) 修订。
> 依据：[ADR-0002](../adr/0002-account-quota-risk.md)（额度、计价、风控）、[ADR-0011](../adr/0011-image-pipeline.md)（图片）、[ADR-0020](../adr/0020-jobs.md)（周期键）、[ADR-0024](../adr/0024-agent-chat.md)（Agent 对话与联网）、[ADR-0027](../adr/0027-agent-referee.md)（Agent 裁判）。
> 官方资料：AI SDK 的 DeepSeek provider 页与 Testing 页、DeepSeek「模型 & 价格」页。库的坑见 [lessons/ai-sdk.md](../lessons/ai-sdk.md)。

## 1. 文件

```
src/server/ai/
├── model.ts                 唯一的模型实例：getFlashModel()、isAiConfigured()、hashedUserId()
├── run.ts                   runAi() 与 preflight() / checkUserLimits() / finishRun() / reconcileStaleRuns() / rejectReusedKey() / afterSpend()
├── call-model.ts            底层模型调用封装（超时控制 + Zod 输出校验）
├── recovery.ts              结算事务重试与流水恢复纯函数
├── run-agent.ts             streamAgentChat() 与 reserveAgentRun() / settleAgentRun()（对话与裁判共用账本，AGENT_PROMPT_VERSION = 6）
├── agent.ts                 buildAgent()（ToolLoopAgent，32 步上限，普通 4096 / 深度思考 8192 tokens/步，最后一步禁工具保底文字输出）
├── repair-tool-call.ts      createRepairToolCall()（按工具名区分长度上限，确定性修复 DeepSeek Flash 尾部截断、null 可选参数与字段类型错位）
├── agent-tools.ts           对话 Agent 工具总装（读资料/目标/进度/好友、showStats、联网、挂载打卡与待办专项工具）
├── agent-checkin-tools.ts   对话 Agent 打卡专项工具（查询、留痕、增改删与昨日补卡覆盖草稿）
├── agent-todo-tools.ts      对话 Agent 待办专项工具（3 层渐进式读 + 单轮缓存 + draftTodo / draftUpdateTodo / draftDeleteTodo / draftTodoGroup）
├── checkin-lookups.ts       内置食物营养表、运动 MET 表等查询封装
├── web-search.ts            DeepSeek 官方 Search / Fetch 封装
├── pricing.ts               价格表（微元 / 百万 tokens）与费用计算，纯函数
├── image.ts                 multipart 图片转内联 file part + 对话内联 JPEG dataURL 校验（只在内存里）
├── prompts/<用途>.ts        diet-recognition.ts、smart-recognition.ts
└── referee/                 打卡裁判 Agent（index.ts、prompt.ts REFEREE_PROMPT_VERSION = 5、tools.ts、food-table.ts）

src/server/quota/            （已无 guard.ts；全站/单人检查在 ai/run.ts，告警去重在 quota/alerts.ts）
├── period.ts                周期键与花费日键（依赖 src/lib/time/）
├── ledger.ts                预占、结算、释放、兑换、补足（事务 + 原子更新）
├── money.ts                 余额分配、结算拆分、周期重置、补足差额纯函数
├── alerts.ts                maybeAlert() 阈值告警与按日按类型去重（alerts_sent）
├── redeem-code.ts           兑换码生成、规范化、SHA-256 哈希与前缀
└── tombstone.ts / tombstone-store.ts   account_tombstones 8 天注销防刷规则与存取

src/lib/image/               compress.ts（浏览器端压缩）、size.ts（含文件头魔数嗅探）
src/features/quota/          schemas.ts（AI_PURPOSES 等契约）、format.ts、components/（额度卡、侧栏额度条）
src/features/agent/          前端 Agent 组件与 hook（AgentTurn、AiDraftCard、ChangeDraftCard、TodoDraftCard、FloatingPet、AgentPanel、AgentFullscreen、confirmed-drafts、useRefereeRun 等）
```

- 只有 `src/server/ai/` 可以 import `@ai-sdk/deepseek`；`ai` 只允许在 `src/server/ai/` 与 `src/features/agent/`（前端类型与 `DefaultChatTransport`）import；前端只有 `src/features/agent/` 可以 import `@ai-sdk/react`。
- 业务 service 不直接调用 `generateText` / `streamText`，单次结构化识别一律通过 `runAi()`，流式多步循环一律通过 `run-agent.ts` / `referee/`。
- `AI_PURPOSES`（`src/features/quota/schemas.ts`）固定为四类：`diet-recognition`、`smart-recognition`、`agent-chat`、`referee`。

## 2. 模型

- 只用 `deepseek-flash`（DeepSeek 当前的 Flash 模型名，支持图像理解）。模型 id 写死在 `model.ts`（`MODEL_ID = 'deepseek-flash'`），不从环境变量读取。
- 必须通过 `model.ts` 暴露的 `isAiConfigured()` 与 `getFlashModel()` 获取模型实例（懒创建，测试里由 `model` 参数注入 `MockLanguageModelV4`）：

```ts
// src/server/ai/model.ts
import 'server-only'
import { createDeepSeek } from '@ai-sdk/deepseek'
import type { LanguageModel } from 'ai'
import { sha256Hex } from '@/server/crypto'
import { env } from '@/server/env'

export const MODEL_ID = 'deepseek-flash' as const

export function isAiConfigured(): boolean {
  return Boolean(env.DEEPSEEK_API_KEY)
}

let flash: LanguageModel | undefined

export function getFlashModel(): LanguageModel {
  if (flash) return flash
  const apiKey = env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY 未配置')
  flash = createDeepSeek({ apiKey })(MODEL_ID)
  return flash
}

export async function hashedUserId(userId: string): Promise<string> {
  return sha256Hex(userId)
}
```

- 禁止 `model: 'deepseek/deepseek-flash'` 这类字符串写法：AI SDK 对字符串模型默认走 Vercel AI Gateway。
- **思考模式必须显式声明**。DeepSeek V4 系列默认开启思考，输出 tokens 变多（ADR-0002 估算：识别一次约 0.007 元，开思考约 0.02 元），而且开启时 `temperature`、`topP` 不生效。每个 prompt 文件都写明 `thinking`：结构化识别（饮食、睡眠截图、运动记录）用 `{ type: 'disabled' }`；需要推理的用途（v0.2 的 AI 规划）才开启。
- `providerOptions.deepseek.userId` 传用户 id 的 SHA-256 十六进制摘要，不传邮箱、昵称或原始 id。DeepSeek 用它做内容安全追溯和缓存隔离，只允许 `[a-zA-Z0-9_-]`。

## 3. 一次调用的流程（runAi）

1. **检查**：用户未被封禁；全站 AI 未暂停；今日全站花费未达上限；该用户进行中的调用少于 2 个、近一小时少于 60 次（ADR-0002 第 6 节）。不满足就直接返回对应错误码（[api-conventions.md](./api-conventions.md) 第 6 节），不调用模型。
2. **预占**：预估输入 tokens × 未命中输入价 + `maxOutputTokens` × 输出价。在事务里按"本周额度 → 加购余额"的顺序扣到"已预占"。余额不足返回 402 `QUOTA_INSUFFICIENT`。每个用途都必须设置 `maxOutputTokens`，它是预占上限的依据。
3. **调用**：`generateText` / `streamText`，结构化结果用 `Output.object({ schema })`。
4. **结算**：按实际用量算费用，多退少补。预占按上限计算，所以不会超扣。
5. **失败**：释放预占。如果已经产生了 tokens（例如流式中途断开），按已产生的用量结算。
6. **记录**：写一条 `ai_runs`：用户、IP、用途、prompt 版本、输入未命中 / 命中 tokens、输出 tokens、费用、耗时、状态。**不记录 prompt 正文、用户输入、模型输出和图片。**

- 整个流程使用请求的 `idempotency-key`，重复请求不会重复预占（api-conventions.md 第 9 节）。
- 用量来源：结果的 `usage`（AI SDK 7 把输入 tokens 分为未命中缓存和命中缓存两部分）。DeepSeek 在 `providerMetadata.deepseek` 里另给 `promptCacheHitTokens` / `promptCacheMissTokens`，可用来交叉核对。字段名以安装版本的类型定义为准，并在 `pricing.ts` 的测试里固定下来。

## 4. 计价

- 一律按高峰价计算（ADR-0002 第 5.1 节），不区分时段。
- 价格表写在 `pricing.ts`，单位是"微元 / 百万 tokens"。DeepSeek 调价时只改这张表：

| 项 | 高峰价 | 微元 / 百万 tokens |
|---|---|---|
| 输入（缓存命中） | 0.04 元 | 40,000 |
| 输入（缓存未命中） | 2 元 | 2,000,000 |
| 输出 | 8 元 | 8,000,000 |
| 联网搜索 Search / Fetch（v0.2） | 0.005 元 / 次 | 5,000 微元 / 次 |

- 费用 = Σ（tokens × 单价）÷ 1,000,000，结果**向上取整**到整数微元。全程整数运算，不用浮点。

## 5. 图片与多模态附件

规则来自 ADR-0011，取代 ADR-0002 第 4 节的旧参数。

- **浏览器**（`src/lib/image/compress.ts`）：`createImageBitmap` 解码 → canvas 缩放到像素总量不超过约 1300×1300 → `canvas.toBlob(…, 'image/jpeg', 0.8)`。重新编码会去掉 EXIF（包括 GPS 位置）。解码失败（例如桌面 Chrome 打不开 HEIC）时提示"这张图打不开，换一张或截个图试试"。`sniffIsImageFile` 通过文件头魔数识别真实图片格式。
- **识别类上传（双图 + 文本提纯）**：
  - `POST /api/v1/ai/diet-recognitions` 与 `POST /api/v1/ai/smart-recognitions` 走 `multipart/form-data`，支持 `image` + 可选 `image2`（最多同时上传 **2 张** JPEG，单张 ≤ 4 MB，接口 `bodyLimit` 4 MB + 64 KB）。
  - `smart-recognitions` 同时支持 `textContent`：前端在选中 `.txt/.md/.csv/.html` 等文本附件时通过 `extractCleanText()` 自动剥离 `<script>`/`<style>` 与 HTML 标签提纯正文后上送（二进制文档如 PDF/Office/音视频直接拒绝）。
- **Agent 对话内联 JPEG（11 MB limit）**：
  - `POST /api/v1/agent/chat` 请求体上限为 **`11 MB`**（`AGENT_CHAT_MAX_BODY_BYTES = 11 * 1024 * 1024`），单条消息最多同时携带 **2 张** 内联 `data:image/jpeg;base64,...`，由 `validateInlineJpegDataUrl()` 校验 JPEG 文件头 `FF D8 FF` 与解码后体积 ≤ 4 MB（异常详情严禁包含 base64 片段）。
  - 对话持久化到 `agent_messages` 前经 `stripFileParts()` 剥离全部 `file` part 并替换为「N 张照片（识别后不保存）」文字说明；图片预览仅存在当前标签页内存（`sessionMessageImages`），关闭即释放。
- **服务端**（`src/server/ai/image.ts`）：`await file.arrayBuffer()` → 校验 JPEG 文件头（`FF D8 FF`）和大小 → 作为 `{ type: 'file', mediaType: 'image/jpeg', data }` 内联发给模型。需要调识别精度时用 file part 的 `providerOptions.deepseek.imageDetail`（`low` / `high` / `original` / `auto`）。
- **禁止**：
  - 写临时文件，或在 `src/server/ai/` 里 import `node:fs` / `fs`；
  - 把图片放进任何缓存（内存缓存、Service Worker、CDN）；
  - 在日志、错误信息、`ai_runs` 里出现 base64、文件名或图片尺寸以外的图片信息；
  - 调用 `uploadFile` 或 `deepSeek.files()`：DeepSeek Files API 不设过期时间就永久保存文件；
  - 把图片发给 DeepSeek 以外的任何服务。
- 请求结束后图片随内存释放。历史记录里看不到原图，也不支持事后重新解析（ADR-0002）。

## 6. 结构化输出与草稿

- 识别类用途的输出 schema 写在 `prompts/<用途>.ts`，用 zod 定义，字段单位遵守 api-conventions.md 第 5 节（千卡、克、秒）。
- 模型输出先过 zod 校验。校验失败算作识别失败：界面降级为手动填写，已产生的费用照常结算。
- AI 结果一律作为草稿，**用户确认前不写入任何业务表**（AGENTS.md 硬规则）。识别接口只返回草稿（结构化字段 + 解析出的文本）和本次的 `aiRunId`；草稿只存在于前端状态里。
- 用户在 `AiDraftCard` 里确认或修改后，前端调用普通的创建打卡接口（`POST /api/v1/goals/{goalId}/checkins`），请求体带 `source: 'ai'` 和 `aiRunId`，把这条记录和费用记录关联起来。用户放弃草稿时什么也不写。
- 一次 AI 回复用 `<AgentTurn>` 呈现，思考与工具调用收在一行活动条里（[ui-design-system.md](./ui-design-system.md) 第 8 节）。

## 7. Prompt 管理

- 每个用途一个文件，导出 `{ id, version, system, schema, maxOutputTokens, thinking }`。改 prompt 必须把 `version` 加一，`ai_runs` 记录版本号，方便对比效果和成本。
- system prompt 里不放用户数据。用户输入放在 user message 里，不拼接进 system。
- prompt 用中文写，要求模型输出中文。

## 8. 全站保护与注销防刷

- 全站每日花费上限：默认 10 元，后台可改。按北京时间的日期键累计。达到后当天所有 AI 调用返回 503 `AI_PAUSED`，并给管理员发一封告警邮件；次日 00:00 自动恢复，或由管理员手动恢复（ADR-0002 第 5.4 节）。
- 未配置 `DEEPSEEK_API_KEY`（`!isAiConfigured()`）或管理员手动暂停开关打开时，同样返回 `AI_PAUSED`。
- 异常阈值（单人单日超过 5 元、每小时超过 60 次、同 IP 每日新注册超过 3 个账号、兑换码失败过多）只标记并告警，不自动封号。告警通过 `alerts.ts` 的 `maybeAlert()` 按"每天每种一次"（`alerts_sent(kind, dayKey)`）去重。
- **`account_tombstones` 8 天注销防刷机制**（`src/server/quota/tombstone.ts` / `tombstone-store.ts`）：账号注销删除 `user` 行前，在同一事务写入 `account_tombstones`（保留 `TOMBSTONE_TTL_MS = 8 天`，记录邮箱 HMAC 摘要、本周额度快照以及近 24 小时内最多 `200` 条 `ai_runs` / `redeem_attempts` id）。同一邮箱 8 天内重新注册时，通过 `claimTombstone()` 在同一额度周期内沿用注销前的本周额度上限与已用额（不重新发放首周额度），并将风控流水重新关联回新账号，防止通过"注销重注"刷额度或重置频控计数。

## 9. Agent 对话、裁判与联网搜索（ADR-0024、ADR-0027）

Agent 对话（悬浮宠物 / `/agent`）与打卡裁判均走 `ToolLoopAgent` 流式，记账复用 `runAi` 同一套账本（`src/server/ai/run-agent.ts` 的 `reserveAgentRun` / `settleAgentRun`）：

- **Agent 对话**（`POST /api/v1/agent/chat`）：步数上限 **`32` 步**（`MAX_STEPS = 32`，普通模式每步 `MAX_OUTPUT_TOKENS_PER_STEP = 4096`，深度思考模式每步 `DEEP_THINK_MAX_OUTPUT_TOKENS_PER_STEP = 8192`，最后一步通过 `prepareStep` 设为 `toolChoice: 'none'` 保证一定给出文字回答）；配置 `repairToolCall` 自动修复畸形工具入参，历史转模型消息必传 `ignoreIncompleteToolCalls: true` 防止半成品 tool-call 毒化会话，且落库与读取均过滤空助手消息；预占采用整轮高分位输出预算（普通 `40,000` / 深度思考 `60,000` tokens + `15` 次联网），按实际 token + 联网次数结算。会话与消息存 `agent_conversations` / `agent_messages`（图片入库前由 `stripFileParts` 换成文字说明，不落盘）。
- **打卡裁判**（`POST /api/v1/goals/{goalId}/referee`）：步数上限 **`10` 步**（`REFEREE_MAX_STEPS = 10`，每步 `4096` tokens，预占 `12,000` tokens，最后一步强制调用 `submitVerdict`），联网最多 `6` 次；配置 `repairToolCall` 且 `stopWhen` 仅在 `submitVerdict` 真正成功回调 `verdict` 时停止（不用 `hasToolCall`，避免非法入参提前中止循环）；当传入 `conversation` 时分析回合同样写入 `agent_conversations` / `agent_messages`。

联网用 DeepSeek 官方 Search / Fetch（`src/server/ai/web-search.ts`，带 `15s` 超时与网络异常兜底）：

- `POST /v1/tools/search` `{ query, count?, need_content? }` → `{ results: [{ title, url, snippet, summary, site_name, date, authority }] }`；`summary` 是给模型读的字段。
- `POST /v1/tools/fetch` `{ url }` → `{ title, content(markdown) }`。
- 每次成功约 0.005 元 = 5000 微元，计入额度账本；Agent 对话每轮最多 `15` 次（`MAX_SEARCHES_PER_TURN`），裁判每次最多 `6` 次（`MAX_REFEREE_SEARCHES`）。
- 思考模式默认关（`thinking: { type: 'disabled' }`），对话输入框「深度思考」开关打开时开启思考并保持 `reasoningEffort: 'low'`（DeepSeek 最低档）。

## 10. 测试

- `pricing.ts`：各类 tokens 的计费、向上取整、零用量。
- `money.ts` / `ledger.ts` 里的金额逻辑：预占、结算多退少补、失败释放、本周额度与加购余额的扣减顺序、周期切换。
- `tombstone.ts` / `tombstone-store.ts`：8 天保留期、同周恢复与跨周重置、风控引用重新关联。
- `runAi()`：用 `ai/test` 的 `MockLanguageModelV4` 测成功、模型报错、输出校验失败、超时路径。测试不调用真实 DeepSeek。

## 11. 工具强制（ESLint）

| 规则 | 形式 |
|---|---|
| `ai` 只在 `src/server/ai/` 与 `src/features/agent/` import；`@ai-sdk/deepseek` 只在 `src/server/ai/`；`@ai-sdk/react` 只在 `src/features/agent/` | ESLint `no-restricted-imports` |
| 禁止 import 其他 AI provider（`@ai-sdk/openai`、`@ai-sdk/anthropic`…） | ESLint `no-restricted-imports` |
| 禁止从 `ai` 导入 `uploadFile` | ESLint `no-restricted-imports`（`importNames`） |
| `src/server/ai/**` 禁止 import `fs`、`node:fs`、`fs/promises`、`node:fs/promises` | ESLint `no-restricted-imports` |

