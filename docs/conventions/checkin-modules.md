# 打卡板块与 Agent 裁判规范

> 日期：2026-11-05（2026-11-26 同步最新实现）· 状态：已落地，随 ADR-0027 及后续迭代同步更新。
> 依据：[ADR-0027](../adr/0027-agent-referee.md)（Agent 裁判与分数库）、Epic #33 及子任务 #35–#38、`/dev/playbook/modules/*` 五个板块的整页稿与 `/dev/playbook/smart-checkin` 定稿规范。
> 写或改任何打卡页面、板块表单、裁判规则、目标设置、新人引导里的板块配置前，先读本文。

## 1. 一句话模型

**一个打卡 = 若干「填什么」+「怎么算达标」+ 一个周期。** 饮食、运动、睡眠、学习四个板块是固定好的组合，「我的小目标」是用户自己拼的组合。由此：

- 页面骨架只有一套（`CheckinFlow`），五个板块只提供数据，不改版式；全局智能识别页 `/checkin/smart` 识别完成后也原地复用同一个 `CheckinFlow`；五大单独打卡页右上角内置「补卡」按钮切换至昨日补卡态（`/checkin/smart` 保持今日专属，不接入补卡）。
- 达标判定只有一种形状（`Verdict`），五个板块各写一个纯函数产出它。
- 规则配置只有一个入口（「我的 → 目标设置」`/goals`），`GoalSettingsView` 以一屏紧凑轮播 + 统一设置 Dock（`GoalSettingsSheet`）编排总周期、板块开关、个人体质与各目标 `GoalModuleCard`。
- Agent 裁判只有一个运行器（`streamReferee`），五个板块各提供一份「技能」：提示词片段、工具子集、事实 schema；且全局只有一个 Agent（裁判会话可写入 `agent_conversations`）。

## 2. 目录与所有权

```
src/features/referee/                 前后端共用（无 server-only、无 React）
├── schemas.ts                        RefereeTier、RefereeRules（按板块联合）、Facts（按板块联合）、Verdict（facts 可空）、Check
├── rules/<module>.ts                 judge<Module>(subject, ctx) → Verdict，纯函数 + 同名 .test.ts（含 common.ts / index.ts）
├── subject.ts                        创建打卡请求体 → 裁判输入（前端预览、Agent、入库三处共用）
└── defaults.ts                       各板块默认规则（DEFAULT_RULES[module]）与 effectiveRules()

src/features/checkin/flow/            打卡页骨架（从 Playbook PhoneFlow 提升，Playbook 反过来 re-export）
├── checkin-flow.tsx                  标题栏（含昨日补卡切换与颗粒化视觉）→ 头部卡 → 模式 Tab → 主选择器 → 分区 / SmartScannerLens → 报告 → 底部 Agent 抽屉 + 操作条 → 结果弹窗
├── fill-section.tsx  folder-card.tsx  agent-drawer.tsx  doc-page.tsx  smart-session.ts  types.ts
└── fields/                           分区里的原子输入：tags.tsx（常用标签 + 设置浮层）、inputs.tsx（InlineRow、PointsEditor）
（时间选择器已提升为公共原子组件 src/components/ui/time-picker.tsx）

src/features/checkin/share/poster/    打卡分享海报引擎（model / blocks / palette / draw / scenes，纯 Canvas 渲染 16:9 / 9:16 实物手账海报）

src/features/checkin/modules/         板块定义；板块目录之间互相不 import
├── diet/                             index.ts（板块定义）、form.tsx、report.ts、docs.ts
├── exercise/                         index.ts、form.tsx
├── sleep/                            index.tsx
├── study/                            index.tsx
├── custom/                           index.tsx（含自定义规则面板）
├── rules-editors.tsx                 四个固定板块的规则面板（DietRulesEditor / ExerciseRulesEditor / SleepRulesEditor / StudyRulesEditor）
├── tier-picker.tsx                   人群档位选择（目标设置与新人引导共用）
├── registry.ts                       CHECKIN_MODULES / moduleDef()；唯一知道全部板块的前端入口
└── types.ts                          CheckinModuleDef、ModuleFormApi、RulesEditorProps

src/features/checkin/components/      业务容器与全局智能识别组件（无 modules/<module> 之间的 settings.tsx）
├── checkin-flow-page.tsx             /goals/{goalId}/checkin 路由容器（含今日/昨日补卡双态切换与覆盖提交）
├── checkin-launcher.tsx / checkin-sheet.tsx / checkin-sheet-list.tsx   底栏「＋」弹层与体重/心情/步数面板（体重/心情含近一年走势图）
├── goal-settings-view.tsx            /goals 全局唯一目标设置（SettingsOverviewCard → 单行目标胶囊 → 卡片轮播 → 互补页底/Dock 入口）
├── goal-module-card.tsx              单板块目标与达标规则折叠卡（含饮食人群档位）
├── goal-settings-sheet.tsx / goal-settings-logic.ts   统一设置 Dock（单 Sheet 内 menu → 时间周期 / 打卡设置三级钻取）
├── onboarding-rules-step.tsx         新人引导「定个标准」步骤（复用 RulesEditor 与 TierPicker）
├── smart-checkin-page.tsx / smart-scanner.tsx / smart-magic-stream.tsx / smart-history-view.tsx / smart-action-bar.tsx
└── goal-checkin-calendar.tsx / goal-checkin-history.tsx / weight-panel.tsx / mood-panel.tsx / steps-panel.tsx

src/features/agent/                   裁判流式 hook（use-referee-run.ts）、对话打卡转换（checkin-entry.ts / draft-view.ts）、待办草稿卡（todo-draft-card.tsx）、已确认持久化（confirmed-drafts.ts）、工具元信息（tool-meta.ts）

src/server/ai/referee/                裁判 Agent（ai 包只允许在 src/server/ai/）
├── prompt.ts                         通用提示词 + REFEREE_SKILLS（改动加 REFEREE_PROMPT_VERSION，当前 v5，含昨日补卡与覆盖重算规则）
├── tools.ts                          各板块工具（含按目标日期查询的 getDayStudy）+ submitVerdict（入参 = 该板块事实 schema）
├── food-table.ts                     lookupFoodNutrition 的内置营养表
└── index.ts                          streamReferee()：校验会话 → 预占 → ToolLoopAgent 流式 → 持久化会话 + 结算
src/server/services/referee/          startReferee()（读目标、规则、体质、体重、目标日已打记录，支持 replaceCheckinId 排除被覆盖记录）与工具只读查询（read.ts、context.ts）
src/server/api/routes/referee.ts      POST /goals/{goalId}/referee（OpenAPIHono 流式 SSE 路由；不走 idempotency 中间件，由额度层 rejectReusedKey 防重放）
```

- `features/checkin/modules/<module>/` 之间、`features/referee/rules/*` 之间**禁止互相 import**。共用的东西放到上一层（`flow/`、`flow/fields/`、`modules/rules-editors.tsx`、`referee/schemas.ts`）。
- 只有两个 `registry` / `index` 文件可以按 `Module` 分发。页面、路由、统计里禁止出现 `if (module === 'diet')` 这类分支去决定裁判结果或报告内容，一律走注册表。
- 裁判规则写在 `src/features/referee/rules/`，前端用它做即时预览，服务端用**同一份代码**重算并以重算结果入库。这是 AGENTS.md「业务逻辑放 services」的唯一例外，理由同 `schemas.ts`：前后端必须得出同一个结论。规则文件不 import React、`next/*`、数据库或 `ai`。

## 3. 数据契约

### 3.1 规则配置（两层）

| 层 | 存哪里 | 内容 |
|---|---|---|
| 个人体质 | `profiles.referee_tier`（text，默认 `balanced-glycemic`） | `strict-fat-loss` 减脂严管 / `balanced-glycemic` 控糖均衡 / `gentle-gain` 增肌温和。饮食扣分权重按它调整 |
| 目标规则 | `goals.referee_rules`（jsonb，可空 = 用 `DEFAULT_RULES[module]`）+ `goals.deadline_date`（date，可空 = 不设期限） | 按板块的阈值，见下表 |

| 板块 | `RefereeRules` 字段（默认值） |
|---|---|
| diet | `passScore`（3.0，固定 > 该分才有效） |
| exercise | `distanceMinMinutes` 20、`distanceMinKm` 2、`countMinMinutes` 15、`countMinSets` 4 |
| sleep | `bedtimeBy` "23:30"、`minHours` 6.5（不设时长上限） |
| study | `minFocusMinutes` 25、`minNoteChars` 10 |
| custom | `conditions`：`[{ key, op: 'gte'\|'lte'\|'eq'\|'filled', value? }]`，`aiCriteria`：可选的一句话判卷标准 |

- 规则写入前用 `RefereeRulesSchema`（按 `module` 判别）校验；`module` 必须与目标一致。
- 用户调过的阈值只影响之后的打卡；已入库的 `verdict` 不重算。

### 3.2 事实（Facts）

事实 = 裁判需要、但表单里没有的数：饮食每道菜的热量 / 蛋白 / 碳水 / 脂肪 / 纤维 / 钠 / GI / 是否一票否决；运动每项的 MET 与消耗；学习要点是否有实质内容。

- 事实由 Agent 通过 `submitVerdict` 工具提交（入参就是该板块的 Facts schema），或在 AI 不可用时由规则函数用默认值兜底（见 3.4）。
- 事实连同裁判结果一起作为草稿返回前端，用户确认时随创建打卡请求一起提交。

### 3.3 裁判结果（Verdict）

```ts
interface Verdict {
  version: 1
  isValid: boolean                     // 是否计入有效打卡（多餐周期未集齐时恒为 false）
  settlement?: 'pending' | 'settled'   // pending = 分餐已记录待集齐三餐汇总；缺省或 settled = 终判
  score: number | null                 // 评分制板块全天结算后的总分（0.0–5.0）；pending 阶段为 null
  scoreMax: number | null
  detail: string                       // 一句话阶段说明或全天结算结论
  checks: Check[]                      // 逐项核验：{ id, text, ok, source? }
  metrics: Record<string, number | string | null>   // 报告用的数（板块自定键）
  facts: Facts | null                  // 当时依据的事实（FactsSchema.nullable()；离线兜底时为 null）
  citations: { title: string; url: string }[]       // 联网核验来源
  advice: string[]                     // 改进建议（最多 3 条）
  refereeRunId: string | null                        // 裁判那次 ai_runs.id；离线判定为 null
  offline: boolean                     // true = 没经过 Agent，只按规则判定
}
```

### 3.4 入库（分数库）、`isValid = false` 与 `pending` 态职责

`checkins` 三列：

| 列 | 类型 | 说明 |
|---|---|---|
| `score` | `numeric(3,1)`，可空 | 评分制板块（饮食全天结算后）的分数；其余或 `pending` 阶段为空 |
| `is_valid` | `boolean not null default true` | 老数据迁移后都是 true |
| `verdict` | `jsonb`，可空 | 上面的 `Verdict`（`facts` 允许为 `null`）；老数据为空 |

- 服务端在创建打卡时**重算**：`judge(module, facts, rules, ctx)`，前端传来的 `isValid` / `score` 一律忽略。
- 没有事实（离线、AI 暂停、额度不足）时也必须出结论：饮食按关键词识别一票否决食物与空腹/备注规则，`score` 为空、`isValid = !一票否决`；其余板块的规则本来就不依赖事实。
- **`pending` 态说明（饮食分餐阶段）**：当饮食仅记录早/午/晚中的 1–2 餐时，`verdict.settlement = 'pending'`、`score = null`、`isValid = false`。它不是「未达标仅存档（`archivedOnly`）」，而是等待集齐三正餐后由 `reconcileDailyDiet` 统一结算并回写全天 `score`、`isValid` 与 `settled` verdict；在此之前不弹盖章弹窗、不计连续天数与 `done`。
- **`isValid = false` 在各服务中的过滤职责**：未达标记录照常保存、照常出现在历史和日历里（标「未达标·仅供复盘」，在 `dashboard/compute.ts` 中当 `!c.isValid && !c.pending` 时记为 `archivedOnly`），各统计模块严格按以下分工过滤：
  - `src/server/services/stats.ts`：`goalDayProgress()` 只对 `isValid = true` 累加目标进度与 `done`（饮食尚无 `isValid` 终判时读取 `pending` 主餐数展示阶段进度 `1/3`、`2/3`，且 `done = false`）；`validDates()` 与 `countRankDays()` 只取 `isValid = true` 记录计算连续天数与排行日数。
  - `src/server/services/rank/`（`index.ts`、`streaks.ts`、`board.ts`）：在数据库查询层直接附加 `eq(checkins.isValid, true)`，排行榜天数、连续天数与最近 24 小时榜单动态均排除未达标及 `pending` 记录，也不向好友动态推送未达标打卡。
  - `src/server/services/goals/index.ts`：目标详情的累计有效天数 `validDays` 在 SQL 查询层过滤 `eq(checkins.isValid, true)`。
  - `src/server/services/insights/compute.ts`：板块近况统计中，`valid` 与 `validDays`（以及 `custom` 序列）过滤 `r.isValid`；总记录数 `total`、平均分/热量/时长/入睡时刻与最常卡住的规则 `topFailure` 则基于区间内全部已入库记录计算，保证趋势与卡点复盘真实可见而不虚增达标率。

### 3.5 同日多次 / 单次读写协议、昨日补卡覆盖与饮食核心细则

| 板块 | 服务端入库（`createCheckin` / `mutate`） | 前端回显、补卡与覆盖（`useForm` + `CheckinFlow`） |
|---|---|---|
| diet | 按 `mealType`（早/午/晚/加餐）同日同餐次 Upsert；未集齐早/午/晚三顿正餐时写为 `settlement = 'pending'`（`score = null, isValid = false`）；集齐三餐或有加餐、修改、删除时一律通过 `reconcileDailyDiet` 统一重算全天总分并同步写回当日全部记录的 `score`、`isValid` 与 `verdict` | 默认按本地时刻就近匹配早/午/晚正餐；切「补卡」态按昨日拉取并回显各餐，提交时带 `isMakeup: true` 覆盖同餐次并重算昨日全天总分；第 1、2 餐保存时不弹终判盖章弹窗，提供「继续记下一餐」快捷切换；第 3 餐集齐时当场弹出庆祝盖章弹窗 |
| exercise | 同日单条聚合 Upsert，自动合并同日多次智能识别或手动录入的运动明细并重算总时长、总消耗与 `verdict` | 进页面回显目标日（今日/昨日）已打卡运动项；同日再次智能拍照时在已有列表上追加/去重合并运动项（保留 `km` 与 `sets`）；修改后以覆盖方式更新 |
| study | 每次提交新增一条碎片学习记录；通过 `reconcileDailyStudy` 统一按当日全部碎片累计时长 + 要点判定并回写 `isValid`；修改或覆盖单条记录时走 `PATCH /checkins/{id}`（`replace` 载荷）同样触发 `reconcileDailyStudy` | 目标日累计时长未达标时重进默认打开空白表单供继续累加（注入 `priorMinutesOnDay`）；昨日补卡已有记录时支持在回显态修改并覆盖重算，也可点击「继续加记一条学习」追加新碎片 |
| sleep | 同日单条 Upsert（按 `localDate` 严格归属该打卡日） | 进页面完整回显目标日睡眠记录，各分区彼此独立解锁编辑，修改后直接覆盖更新目标日记录 |
| custom | 同日单条 Upsert | 进页面完整回显目标日自定义字段值，修改后直接覆盖更新目标日记录 |

**饮食核心裁判细则（`features/referee/rules/diet.ts` 与 `prompt.ts`）**：

- **备注第一优先级**：备注（`note`）覆盖识别/填写的菜品误差；含 `FASTING_RE`（「空腹」「轻断食」「断食」「未进食」）按空腹特判（`isFasting = true`，热量/碳水/脂肪/GI 均计 `0`）；含 `NO_STAPLE_NOTE_RE`（「没吃米饭」「只吃菜」「不吃主食」等）自动剔除精制主食碳水与 GI。
- **3.8 分干净底分**：全天无一票否决超加工食物时，起始基础分固定为 **`3.8` 分**（天然高于默认 `3.0` 有效线），禁止低底分导致「缺可选加分项变相不及格」。
- **减脂无热量下限与热量走廊分档**：`strict-fat-loss`（减脂严管）**不设热量下限死线**（`mealKcalMin = 0`、`dailyKcalMin = 0`），低热量控卡（单餐 `≤ 220 kcal`）或空腹给予正加分（全天 `≤ 1350 kcal` 或含轻断食餐 `+0.5`，未超 `1800 kcal` `+0.2`），仅超 `1800 kcal` 上限或晚间精制碳水/高甜点扣分；`balanced-glycemic`（控糖均衡）参考上限 `2100 kcal`；`gentle-gain`（增肌温和）才对全天热量不足（`< 1600 kcal`）或蛋白不足（`< 45g`）扣分。
- **膳食纤维纯奖励制**：全天累计膳食纤维 `≥ 10g` `+0.2`、`≥ 18g` `+0.4`；缺纤维 `0` 扣分且校验清单不标红叉。
- **碳水/油脂质量与食堂包容**：`COMPLEX_CARB_RE` 复合碳水（玉米、土豆、红薯、糙米、燕麦等）晚间不按精制碳水扣分；`HEALTHY_FAT_RE` 优质脂肪（坚果、牛油果、深海鱼等）未超脂肪上限时 `+0.2`；全天钠超过 `4500mg`（增肌档 `5000mg`）或高盐精碳晚餐才微扣 `0.2`。

## 4. Agent 裁判运行、跳过豁免与智能识别闭环

1. **流式裁判与对话统一持久化**：前端提交草稿到 `POST /api/v1/goals/{goalId}/referee`（请求体包含 `checkin`、`idempotencyKey`、可选 `replaceCheckinId` 与可选 `conversation: { id, messageId, text }`）。`streamReferee()` 先校验会话归属，再通过 `reserveAgentRun` 预占额度，运行 `ToolLoopAgent`（`deepseek-flash`，思考关闭，最多 `10` 步，每步 `4096` tokens，配置 `repairToolCall` 且仅在 `submitVerdict` 成功产出结论时停止，`prepareStep` 最后一步强制 `submitVerdict`，联网最多 `6` 次），流结束时按实际用量结算，若带 `conversation` 则把本次分析同步存入 `agent_conversations` / `agent_messages`（标题为「目标名 · 打卡分析」），实现全局只有一个 Agent，用户可在对话框中接着追问。当处于补卡/覆盖态时，`startReferee` 透传 `isMakeup`、`targetDate` 与 `replaceCheckinId`（排除被覆盖的旧记录避免重复累加），裁判提示词明确标注「昨日补卡/覆盖重算」。
2. **「跳过本次打卡（`skipReason`）」豁免流**：手动填写模式下，`CheckinFlow` 底部提供「跳过本次打卡」折叠分区，其他项可留空（由 `buildSkipFallbackInput` 补最小兜底载荷）。`startReferee` 将 `skipReason` 传给裁判 Agent；Agent 只需核验理由是否正常合理（生病、生理期、出差、考试加班等 → `skipApproved: true`，仅纯乱码或无意义敷衍字符 → `false`）。`judge()` 在 `skipReason` 非空时优先进入豁免分支（`settlement: 'settled'`，饮食通过记 `4.0` 分，`metrics.skipped = 1`）；前端检测到 `subject.skipReason` 且裁判返回 `verdict.isValid === true` 时自动调用 `confirm()` 入库并直接弹出盖章弹窗。
3. **全局智能识别 `/checkin/smart` + `SmartScannerLens`**：`SmartScannerLens` 统一接入 `useMediaPicker`（支持拍照、`image` + `image2` 双图内存压缩、以及 `.txt/.md/.csv/.html` 文本附件 `extractCleanText` 提纯），支持在扫描前/扫描页填写「备注」作为识别第一优先级上下文。全局页 `/checkin/smart` 识别完成后顶部展示 `SmartModuleDetector` 5 板块切换胶囊条与同板块多目标切换，下方原地直接挂载同源 `<CheckinFlow>` 并通过 `smart-session.ts` 隔离单次 `aiRunId`（切手动、切子维度或确认入库后立即清理，杜绝复用旧键触发 `409 CHECKIN_EXISTS`）。
4. **确认入库与降级**：Agent 没调到 `submitVerdict` 或 AI 不可用时，前端用 `judge()` 离线兜底；用户点「确认有效打卡」「保存本餐记录」「覆盖昨日记录」或「仅保存记录」后，前端调用普通创建打卡接口（学习覆盖旧记录时调用 `PATCH /checkins/{id}`），带上 `facts`、`refereeRunId`、`citations`、`advice`（以及豁免时的 `skipReason`）。用户放弃时什么也不写。

| 板块 | 工具 |
|---|---|
| diet | `lookupFoodNutrition`（内置常见食物营养表）、`webSearch` / `webFetch`（表里没有的菜） |
| exercise | `lookupMet`（内置 MET 表）、`calcExerciseKcal`（读用户最近体重） |
| sleep | `getRecentSleep`（最近 7 天睡眠记录，用于规律度） |
| study | `getTodayStudy` / `getDayStudy`（按目标打卡日累加学习时长，支持排除 `replaceCheckinId`）、`webSearch` / `webFetch` |
| custom | `listCheckins`（本目标最近记录） |

## 5. 页面与入口

- **打卡页**：`/goals/{goalId}/checkin`（支持 `?makeup=1` 进入昨日补卡态）渲染 `CheckinFlow` + 该板块的定义。进来就是填写页；右上角提供「补卡 / 退出补卡」切换按钮，进入补卡态后全页切换为暖纸底纹（`bg-makeup-paper`）+ 静态微颗粒叠加层（`.makeup-grain-overlay`）与「正在补记昨日」提示条，先只读拉取昨日已存记录回显，用户修改后可覆盖重算；「达标规则」「评判依据」是头部卡里的标签，点开是二级页；提交后底部弹 Agent 抽屉（宽屏放右栏）；分析完成后内容区追加报告；确认后弹结果卡（当前宠物形象 + 盖章 / 存档；饮食 1/3、2/3 `pending` 态不弹终判弹窗，提供「继续记下一餐」快捷按钮）。
- **全局智能识别页**：`/checkin/smart`（支持 `?action=capture|upload`、`?view=history`），复用 `SmartScannerLens` + `SmartModuleDetector` + `<CheckinFlow>`，右上角提供历史识别快照入口（只读）。该页专用于今日快捷识图，不承载补卡。
- **目标设置**（全局唯一）：`/goals` 渲染 `GoalSettingsView`，入口是「我的 → 目标设置」（顶栏「＋ → 设置目标」、底栏「＋」弹层空状态、主页空状态与首卡「调整周期」均跳到这里）。页面以一屏紧凑方式排版：**顶部双行总览卡（`SettingsOverviewCard`，右侧 ≥44px「设置」按钮唤起统一设置 Dock `GoalSettingsSheet`）→ 单行 36px 目标切换胶囊条 → 可左右滑动的 `GoalModuleCard` 轮播（每卡折叠收放「目标与计划」与「达标规则」，饮食卡内置「人群档位」）→ 严格互补的响应式双入口（「新建自定义小目标」与「已归档的目标」在宽裕视口放页底，在紧凑视口自动归入设置 Dock 的「更多目标管理」）**。`GoalSettingsSheet` 在同一个 `<Sheet>` 内实现 `menu → 时间周期设置（PeriodPlanPicker） / 打卡设置（5 板块勾选/归档/恢复）` 三级钻取，不叠开第二层弹层。
- **底栏「＋」**：打卡弹层列出今天的目标及 **4 行快捷入口（体重 / 新建待办 `/todo?new=1` / 今日心情 / 今日步数）**；体重与今日心情视图上方按需懒加载近一年真实日历比例折线图（`TrendLineChart`），保存后留在当前面板实时落点更新；一个目标都没有时，顶部显示一张虚线框卡片 `FirstCheckinCard`（「建立你的第一个打卡」，点击跳 `/goals`），其下方仍保留上述 4 行快捷入口。
- **新人引导**：七步引导（`STEPS.length = 7`）；第 4 步「想打卡什么 · 定总周期」选板块后直接共用 `PeriodPlanPicker` 设置总坚持天数与每日提醒时间；第 5 步「定个标准」（`OnboardingRulesStep`）按板块折叠设置规则（饮食卡里先选人群），整步可跳过，跳过就用默认规则。引导、目标设置与主页首卡总进度环（`SummaryCard`）统一按 `goals.deadlineDate` / `period.ts` 口径联动。

## 6. 修改、删除与留痕

- **改法**：`PATCH /checkins/{checkinId}` 有两种请求体。一种只改饮食条目或备注（目标详情页的老入口）；另一种 `replace` 交一份完整的创建请求体，替换整条内容。两种都在内容变了时重算裁判结论（饮食触发 `reconcileDailyDiet`，学习触发 `reconcileDailyStudy`），分数、是否有效、进度跟着变。打卡日、板块、补卡标记、来源（手动 / AI 识别）不能改：记错了日子就删掉重记。睡眠改了时刻以后必须还落在原来那天。
- **来源**：创建、修改、删除都带 `origin`（`manual` 页面手动 / `agent` 对话草稿确认）。它只用于留痕和下面的改动窗口，不是权限。
- **Agent 的改动窗口**：`origin = agent` 时只能改、删**今天和昨天**（按用户时区和日切换时间算的打卡日）的打卡，必须带 `reason`；越界返回 403 `CHECKIN_LOCKED`。判断只用 `features/checkin/edit-window.ts` 的 `isAgentEditable()`：草稿工具出草稿前拦一层，接口再拦一层。页面上的手动删除不受这个限制。
- **留痕**：`checkin_revisions` 表，新增、修改、删除各写一行（`action`、`origin`、`reason`、改前 `before`、改后 `after` 两份 `Checkin` 快照），和打卡写入在同一个事务里。`checkin_id` / `goal_id` 不设外键，打卡或目标删掉后留痕还在；注销账号随用户删除；个人数据导出里有 `checkinRevisions`。查询：`GET /checkins/{checkinId}/revisions`（删除后仍可查）。留痕只增不改，不提供删除接口。
- 暂不做单独的留痕页面；通过接口和 Agent 的 `getCheckinHistory` 查看。

## 7. Agent 对话里的打卡、待办与全量工具清单

对话 Agent（悬浮宠物 / `/agent`）和打卡页的 Agent 裁判是同一套体系，不另立规则：

- **内容形状与补卡先行读取**：对话里的一条打卡用 `features/agent/checkin-entry.ts` 的 `CheckinEntry`，字段与整页稿一致（运动多项、饮食加餐时间、睡眠高级指标、学习要点、自定义字段），由 `entryToCreateInput()` 换成普通创建请求体。改打卡时 `checkinToEntry()` 把已存的打卡还原成同一形状，模型改其中几项后整份交回。用户要求「补卡 / 改昨日打卡」时，系统提示词强制先调 `listCheckins(yesterday, yesterday)` 只读核查已有记录，若昨日已存在记录须明确提醒覆盖或走 `draftUpdateCheckin`。
- **事实与结论**：模型用与裁判相同的内置查询（`server/ai/checkin-lookups.ts`：营养表、MET 表，加上按体重估消耗、近 7 晚睡眠、目标日学习时长）查事实，填进草稿的 `facts`；各板块怎么查事实的提示词也复用 `REFEREE_SKILLS`。草稿预览（`services/checkins/preview.ts`）与写入走同一套校验和 `judge()`，草稿卡确认前就显示「达标 · 计入进度」或「未达标 · 只存档」；入库时服务端再算一次。用户在卡上改了饮食条目，前端去掉 `facts`，入库按新条目离线判定。
- **全量工具清单**（`server/ai/agent-tools.ts` + `agent-checkin-tools.ts` + `agent-todo-tools.ts`，均需在 `features/agent/tool-meta.ts` 登记中文名与图标）：
  - **个人与状态读**：`getUserProfile`、`listGoals`、`getDaySummary`、`listCheckins`（带 checkinId、分数、`isValid`、`editable`）、`getWeight`、`getCheckin`、`getCheckinHistory`。
  - **待办 3 层渐进式读**：`getTodoOverview`、`listTodos`（支持 `status: 'active'` 合并 `open+overdue` 及 `dueFrom`/`dueTo` 按截止时间筛选）、`getTodoDetail`、`getTodoTimeline`。
  - **图表与近况**：`showStats`（调 `getInsights` 返回近 7 / 30 天各板块近况卡，前端通过 `agent-messages.tsx` 的 `STATS_TOOLS` 渲染为同款 `InsightCard`）。
  - **事实查询**：`lookupFoodNutrition`、`lookupMet`、`calcExerciseKcal`、`getRecentSleep`、`getTodayStudy`。
  - **好友只读**：`listFriends`、`getFriendStatus`（好友打卡带 `isValid` 但不带 `checkinId` 和 `editable`；不能改、删好友打卡，也不能替好友打卡）。
  - **联网**：`webSearch`、`webFetch`（每轮上限 `15` 次）。
  - **草稿写**：`draftCheckin`（支持 `isMakeup` 与覆盖提示）、`draftUpdateCheckin`、`draftDeleteCheckin`、`draftTodo`、`draftUpdateTodo`、`draftDeleteTodo`、`draftTodoGroup`、`draftWeight`（写工具只出草稿，用户在草稿卡上点确认才调普通接口；按 `toolCallId` 持久化已确认态与确定性幂等键防重复提交）。
- 新增返回草稿的工具时，同时登记到 `agent-messages.tsx` 的 `DRAFT_TOOLS`，否则卡片不显示；返回近况图表的工具登记到 `STATS_TOOLS`。

## 8. 禁止

- 不要在页面、路由、Hono handler 或 `/dev/playbook` 沙盒里另写一套达标判据或 `score()` 函数；Playbook 必须直接调用 `features/referee/rules/` 的真实纯函数，修改规则时必须同步更新 `modules/<module>/docs.ts`。
- 评分制规则的干净无违规基础分必须**高于**默认 `passScore`（如饮食干净底分 3.8 > 3.0），禁止设置低于及格线的起评分导致「缺可选加分项（如膳食纤维）变相不及格」；热量走廊下限必须区分人群体质方向（减脂档低热量为加分项，仅增肌档对热量不足扣分）。
- 多阶段周期板块（如饮食三餐）在未集齐结算条件时，`isValid` 必须为 `false`、`settlement` 为 `'pending'`，前端禁止提前弹出盖章庆祝弹窗或累加 `DAY` 周期环；`createCheckin`、`updateCheckin`、`deleteCheckin` 三条写路径都必须调用同日聚合重算函数。
- 不要信任前端传来的 `isValid` / `score`；schema 里不收这两个字段。
- 不要因为未达标拒绝保存（不返回 4xx），也不要删掉未达标记录。
- 不要给某个板块单独复制一套打卡页骨架、报告卡片或 Agent 抽屉；要差异就给 `CheckinFlow` 加一个可选插槽。
- 不要在板块之间 import 表单或规则；两个板块都要的东西提升到 `flow/fields/` 或 `referee/`。
- 不要再新增「设置目标」抽屉或第二个目标设置页面。
- 不要把用户上传的图片、笔记原文写进 `verdict`；只存解析出的事实与摘要。

- 不要让 Agent 直接写库，也不要给 Agent 绕开 `isAgentEditable()` 的改删入口。
- 不要删除或修改 `checkin_revisions` 的行。

## 9. 测试

- `features/referee/rules/*.test.ts`：每个板块至少覆盖 Playbook 判例里的 A–D 四个场景，加离线兜底一条。
- `stats.test.ts`：`isValid = false` 不计进度、不计连续天数、不计排行。
- 裁判接口：用 `MockLanguageModelV4` 测「调用 submitVerdict」「没调用 submitVerdict」两条路径，测试不调真实 DeepSeek。
- 界面：ego-browser 在 390px 与 1280px 下各走一遍五个板块的「填写 → Agent 分析 → 确认 → 历史可见」，至少一条走真实 AI。
- 对话打卡：`checkin-entry.test.ts`、`draft-view.test.ts`、`agent-checkin-tools.test.ts`（编排，mock 预览服务）、`edit-window.test.ts`；端测用真实 AI 走「记 → 改 → 查留痕 → 越界被拒 → 删 → 删后查留痕 → 查好友」和一次拍照记饮食。
