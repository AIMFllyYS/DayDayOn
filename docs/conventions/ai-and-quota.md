# AI 调用、额度与图片规范

> 日期：2026-10-31 · 状态：初版。本文档由初始化时联网调研生成，条目未经实战验证，踩坑后按 [lessons 机制](../lessons/README.md)修订。
> 依据：[ADR-0002](../adr/0002-account-quota-risk.md)（额度、计价、风控）、[ADR-0011](../adr/0011-image-pipeline.md)（图片）、[ADR-0020](../adr/0020-jobs.md)（周期键）、[ADR-0003](../adr/0003-project-scope.md)（MVP：饮食拍照识别）。
> 官方资料（2026-10-31 抓取）：AI SDK 的 DeepSeek provider 页与 Testing 页、DeepSeek「模型 & 价格」页。库的坑见 [lessons/ai-sdk.md](../lessons/ai-sdk.md)。

## 1. 文件

```
src/server/ai/
├── model.ts             唯一的模型实例
├── run.ts               runAi()：检查 → 预占 → 调用 → 结算或释放 → 写 ai_runs。所有 AI 调用的唯一入口
├── pricing.ts           价格表（微元 / 百万 tokens）与费用计算，纯函数
├── image.ts             上传的图片 → 内联 file part（只在内存里）
└── prompts/<用途>.ts    每个用途一个文件：id、version、system、输出 schema、maxOutputTokens、thinking
src/server/quota/
├── period.ts            周期键（依赖 src/lib/time/）
├── ledger.ts            预占、结算、释放、兑换（事务 + 原子更新）
└── guard.ts             全站日上限、AI 暂停开关、单用户并发与频率
src/lib/image/compress.ts   浏览器端压缩
src/features/agent/         前端 Agent 组件（AgentTurn、AiDraftCard、额度条）
```

- 只有 `src/server/ai/` 可以 import `ai` 和 `@ai-sdk/deepseek`。前端只有 `src/features/agent/` 可以 import `@ai-sdk/react`。
- 业务 service 不直接调用 `generateText` / `streamText`，一律通过 `runAi()`。

## 2. 模型

- 只用 `deepseek-flash`（DeepSeek 当前的 Flash 模型名，支持图像理解）。模型 id 写死在 `model.ts`，不从环境变量读取。
- 必须用 provider 实例创建模型：

```ts
// src/server/ai/model.ts
import 'server-only'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { env } from '@/server/env'

const deepSeek = createDeepSeek({ apiKey: env.DEEPSEEK_API_KEY })

export const flash = deepSeek('deepseek-flash')
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

## 5. 图片

规则来自 ADR-0011，取代 ADR-0002 第 4 节的旧参数。

- **浏览器**（`src/lib/image/compress.ts`）：`createImageBitmap` 解码 → canvas 缩放到像素总量不超过约 1300×1300 → `canvas.toBlob(…, 'image/jpeg', 0.8)`。重新编码会去掉 EXIF（包括 GPS 位置）。解码失败（例如桌面 Chrome 打不开 HEIC）时提示"这张图打不开，换一张或截个图试试"。
- **上传**：`multipart/form-data`，字段 `image`，只接受 `image/jpeg`，接口上限 4 MB（api-conventions.md 第 11 节）。
- **服务端**（`src/server/ai/image.ts`）：`await file.arrayBuffer()` → 校验 JPEG 文件头和大小 → 作为 `{ type: 'file', mediaType: 'image/jpeg', data }` 内联发给模型。需要调识别精度时用 file part 的 `providerOptions.deepseek.imageDetail`（`low` / `high` / `original` / `auto`）。
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

## 8. 全站保护

- 全站每日花费上限：默认 10 元，后台可改。按北京时间的日期键累计。达到后当天所有 AI 调用返回 503 `AI_PAUSED`，并给管理员发一封告警邮件；次日 00:00 自动恢复，或由管理员手动恢复（ADR-0002 第 5.4 节）。
- 管理员手动暂停开关同样返回 `AI_PAUSED`。
- 异常阈值（单人单日超过 5 元、每小时超过 60 次、同 IP 超过 3 个账号）只标记并告警，不自动封号。告警按"每天每种一次"去重。

## 9. 联网搜索（v0.2，暂不做）

DeepSeek Search / Fetch 按成功请求次数计费，计入同一个额度账本。接入时补充本节，并确认 AI SDK 对应的工具写法。

## 10. 测试

- `pricing.ts`：各类 tokens 的计费、向上取整、零用量。
- `ledger.ts` 里的金额逻辑：预占、结算多退少补、失败释放、本周额度与加购余额的扣减顺序、周期切换。
- `runAi()`：用 `ai/test` 的 `MockLanguageModelV4` 测成功、模型报错、输出校验失败三条路径。测试不调用真实 DeepSeek。

## 11. 工具强制（待落地，M3）

| 规则 | 形式 |
|---|---|
| `ai`、`@ai-sdk/deepseek` 只在 `src/server/ai/` import；`@ai-sdk/react` 只在 `src/features/agent/` | ESLint `no-restricted-imports` |
| 禁止 import 其他 AI provider（`@ai-sdk/openai`、`@ai-sdk/anthropic`…） | ESLint `no-restricted-imports` |
| 禁止从 `ai` 导入 `uploadFile` | ESLint `no-restricted-imports`（`importNames`） |
| `src/server/ai/**` 禁止 import `fs`、`node:fs`、`fs/promises`、`node:fs/promises` | ESLint `no-restricted-imports` |

