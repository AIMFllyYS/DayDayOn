# 打卡板块与 Agent 裁判规范

> 日期：2026-11-05 · 状态：初版，随 ADR-0027 一起提交。
> 依据：[ADR-0027](../adr/0027-agent-referee.md)（Agent 裁判与分数库）、Epic #33 及子任务 #35–#38、`/dev/playbook/modules/*` 五个板块的整页稿（视觉与交互的唯一参照）。
> 写或改任何打卡页面、板块表单、裁判规则、目标设置、新人引导里的板块配置前，先读本文。

## 1. 一句话模型

**一个打卡 = 若干「填什么」+「怎么算达标」+ 一个周期。** 饮食、运动、睡眠、学习四个板块是固定好的组合，「我的小目标」是用户自己拼的组合。由此：

- 页面骨架只有一套（`CheckinFlow`），五个板块只提供数据，不改版式。
- 达标判定只有一种形状（`Verdict`），五个板块各写一个纯函数产出它。
- 规则配置只有一个入口（「我的 → 目标设置」），五个板块各写一个配置面板挂进去。
- Agent 裁判只有一个运行器（`runReferee`），五个板块各提供一份「技能」：提示词片段、工具子集、事实 schema。

## 2. 目录与所有权

```
src/features/referee/                 前后端共用（无 server-only、无 React）
├── schemas.ts                        RefereeTier、RefereeRules（按板块联合）、Facts（按板块联合）、Verdict、Check
├── rules/<module>.ts                 judge<Module>(subject, ctx) → Verdict，纯函数 + 同名 .test.ts
├── rules/index.ts                    judge() 分发；唯一知道全部板块的规则入口
├── subject.ts                        创建打卡请求体 → 裁判输入（前端预览、Agent、入库三处共用）
└── defaults.ts                       各板块默认规则（DEFAULT_RULES[module]）与 effectiveRules()

src/features/checkin/flow/            打卡页骨架（从 Playbook PhoneFlow 提升，Playbook 反过来 re-export）
├── checkin-flow.tsx                  标题栏 → 头部卡 → 模式 Tab → 主选择器 → 分区 / 扫描镜 → 报告 → 底部 Agent 抽屉 + 操作条 → 结果弹窗
├── fill-section.tsx  folder-card.tsx  agent-drawer.tsx  doc-page.tsx  time-picker.tsx  types.ts
└── fields/                           分区里的原子输入：tags.tsx（常用标签 + 设置浮层）、inputs.tsx（InlineRow、PointsEditor）

src/features/checkin/modules/         板块定义；板块目录之间互相不 import
├── <module>/                         useForm（填写页）、buildReport（分析页）、docs（二级页）、RulesEditor
├── rules-editors.tsx                 四个固定板块的规则面板（「我的小目标」的在 custom/ 里）
├── tier-picker.tsx                   人群档位选择（目标设置与新人引导共用）
├── registry.ts                       Module → 板块定义；唯一知道全部板块的前端入口
└── types.ts                          CheckinModuleDef、ModuleFormApi、RulesEditorProps

src/features/agent/use-referee-run.ts 裁判流式 hook（@ai-sdk/react 只允许在 features/agent/）

src/server/ai/referee/                裁判 Agent（ai 包只允许在 src/server/ai/）
├── prompt.ts                         通用提示词 + 每个板块一段技能；改动加 REFEREE_PROMPT_VERSION
├── tools.ts                          各板块工具 + submitVerdict（入参 = 该板块事实 schema）
├── food-table.ts                     lookupFoodNutrition 的内置营养表
└── index.ts                          streamReferee()：预占 → ToolLoopAgent 流式 → 结算
src/server/services/referee/          startReferee()（读目标、规则、体质、体重）与工具要读的数据（read.ts）
src/server/api/routes/referee.ts      POST /goals/{goalId}/referee（流式，不走 OpenAPI 子应用）
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
| sleep | `bedtimeBy` "23:30"、`minHours` 6.5、`maxHours` 9.5 |
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
  isValid: boolean          // 是否计入有效打卡
  score: number | null      // 只有评分制板块有（饮食 0.0–5.0）
  scoreMax: number | null
  detail: string            // 一句话：「本餐 4.4 分，超过 3.0 分有效线」
  checks: Check[]           // 逐项核验：{ id, text, ok, source? }
  metrics: Record<string, number | string | null>   // 报告用的数（板块自定键）
  facts: Facts              // 当时依据的事实
  citations: { title: string; url: string }[]       // 联网核验来源
  advice: string[]          // 改进建议（最多 3 条）
  refereeRunId: string | null                        // 裁判那次 ai_runs.id；离线判定为 null
  offline: boolean          // true = 没经过 Agent，只按规则判定
}
```

### 3.4 入库（分数库）

`checkins` 新增三列：

| 列 | 类型 | 说明 |
|---|---|---|
| `score` | `numeric(3,1)`，可空 | 评分制板块的分数；其余为空 |
| `is_valid` | `boolean not null default true` | 老数据迁移后都是 true |
| `verdict` | `jsonb`，可空 | 上面的 `Verdict`；老数据为空 |

- 服务端在创建打卡时**重算**：`judge(module, facts, rules, ctx)`，前端传来的 `isValid` / `score` 一律忽略。
- 没有事实（离线、AI 暂停、额度不足）时也必须出结论：饮食按关键词识别一票否决食物，`score` 为空、`isValid = !一票否决`；其余板块的规则本来就不依赖事实。
- `isValid = false` 的记录照常保存、照常出现在历史和日历里（标「未达标·仅供复盘」），但**不计入**今日进度、`done`、连续天数、排行榜天数，也不给好友发完成动态。所有统计只在 `src/server/services/stats.ts` 一处过滤。

### 3.5 同日多次 / 单次读写协议

| 板块 | 服务端入库（`createCheckin`） | 前端回显与连续打卡（`useForm` + `CheckinFlow`） |
|---|---|---|
| diet | 按 `mealType`（早/午/晚/加餐）同日同餐次 Upsert；三餐齐备或有加餐时触发 `reconcileDailyDiet` 硬覆盖当日所有饮食记录的 `isValid`；未传 `facts` 时按内置营养表补齐兜底事实 | 默认按本地时刻就近匹配早/午/晚正餐（加餐仅限手动点选）；手动点选餐次后锁定该餐次，未手动锁定时连续智能拍照自动顺延至下一未打卡正餐；切换餐次时同步 `seenSyncKey` 并隔离上一餐数据库备注 |
| exercise | 同日单条聚合 Upsert，自动合并同日多次智能识别或手动录入的运动明细并重算总时长、总消耗与 `verdict` | 进页面回显今日已打卡运动项；同日再次智能拍照时在已有列表上追加/去重合并运动项（保留 `km` 与 `sets`） |
| study | 每次提交新增一条碎片学习记录；当累计时长 + 要点达成 `isValid` 时，将当日此前暂存的碎片记录同步更新为 `isValid = true` | 今日累计时长未达标时重进默认打开空白表单供继续累加（注入 `priorMinutesToday`）；已达标时回显最新记录 |
| sleep | 同日单条 Upsert | 进页面完整回显今日睡眠记录，修改后直接更新当日记录 |
| custom | 同日单条 Upsert | 进页面完整回显今日自定义字段值，修改后直接更新当日记录 |

## 4. Agent 裁判的运行

1. 前端提交草稿：`POST /api/v1/goals/{goalId}/referee`（`idempotency-key` 必填），请求体是该板块的创建打卡请求体（不含 `isValid` / `score`）。
2. 服务端 `streamReferee()`：读目标规则与体质 → 按板块取技能 → 建 `ToolLoopAgent`（`deepseek-flash`，思考关闭，最多 6 步，最后一步强制 `submitVerdict`，联网最多 3 次）→ 流式返回 UI message stream。
3. Agent 按需调用工具，最后必须调用 `submitVerdict(facts)`；工具内部跑 `judge()`，输出就是 `Verdict`。没调到 `submitVerdict` 视为识别失败，前端降级为离线判定。
4. 额度和 Agent 对话同一套账本：预占 token 上限 + 联网次数上限，结束后按实际用量结算，失败释放，`ai_runs.purpose = 'referee'`。
5. 前端只认 `submitVerdict` 的输出；思考与工具调用用 `<AgentTurn>` 显示在 Agent 抽屉里，工具名在 `features/agent/tool-meta.ts` 登记中文名和图标。
- 用户点「确认有效打卡」或「仅保存记录」后，前端调普通的创建打卡接口，带上 `facts`、`refereeRunId`、`citations`、`advice`。用户放弃时什么也不写。
- 智能拍照 / 上传：扫描镜识别出草稿后，`applySmart(draft)` 填表并直接返回请求体，骨架立刻交给 Agent 裁判，不等下一次渲染。

| 板块 | 工具 |
|---|---|
| diet | `lookupFoodNutrition`（内置常见食物营养表）、`webSearch` / `webFetch`（表里没有的菜） |
| exercise | `lookupMet`（内置 MET 表）、`calcExerciseKcal`（读用户最近体重） |
| sleep | `getRecentSleep`（最近 7 天睡眠记录，用于规律度） |
| study | `getTodayStudy`（今天已有的学习时长，碎片累加）、`webSearch` |
| custom | `listCheckins`（本目标最近记录） |

## 5. 页面与入口

- **打卡页**：`/goals/{goalId}/checkin` 渲染 `CheckinFlow` + 该板块的定义。进来就是填写页；「达标规则」「评判依据」是头部卡里的标签，点开是二级页；提交后底部弹 Agent 抽屉；分析完成后内容区追加报告；确认后弹结果卡（团团 + 盖章 / 存档）。
- **目标设置**（全局唯一）：`/goals`，入口是「我的 → 目标设置」。顶栏「＋ → 设置目标」、底栏「＋」弹层里的空状态、主页空状态都跳到这里，不再弹抽屉。页面里：选择要坚持的板块 → 每个板块的规则面板（`settings.tsx`）→ 饮食面板里选体质档位。
- **底栏「＋」**：打卡弹层列出今天的目标；一个目标都没有时只显示一张虚线框卡片「建立你的第一个打卡」，样式与目标卡片同尺寸，点击跳 `/goals`。
- **新人引导**：选板块后多一步「定个标准」：每个选中的板块一张折叠卡（饮食卡里先选人群），整步可跳过，跳过就用默认规则。引导和目标设置用同一组 `RulesEditor` 与 `TierPicker`，不各写一份。

## 6. 修改、删除与留痕

- **改法**：`PATCH /checkins/{checkinId}` 有两种请求体。一种只改饮食条目或备注（目标详情页的老入口）；另一种 `replace` 交一份完整的创建请求体，替换整条内容。两种都在内容变了时重算裁判结论，分数、是否有效、进度跟着变。打卡日、板块、补卡标记、来源（手动 / AI 识别）不能改：记错了日子就删掉重记。睡眠改了时刻以后必须还落在原来那天。
- **来源**：创建、修改、删除都带 `origin`（`manual` 页面手动 / `agent` 对话草稿确认）。它只用于留痕和下面的改动窗口，不是权限。
- **Agent 的改动窗口**：`origin = agent` 时只能改、删**今天和昨天**（按用户时区和日切换时间算的打卡日）的打卡，必须带 `reason`；越界返回 403 `CHECKIN_LOCKED`。判断只用 `features/checkin/edit-window.ts` 的 `isAgentEditable()`：草稿工具出草稿前拦一层，接口再拦一层。页面上的手动删除不受这个限制。
- **留痕**：`checkin_revisions` 表，新增、修改、删除各写一行（`action`、`origin`、`reason`、改前 `before`、改后 `after` 两份 `Checkin` 快照），和打卡写入在同一个事务里。`checkin_id` / `goal_id` 不设外键，打卡或目标删掉后留痕还在；注销账号随用户删除；个人数据导出里有 `checkinRevisions`。查询：`GET /checkins/{checkinId}/revisions`（删除后仍可查）。留痕只增不改，不提供删除接口。
- 暂不做单独的留痕页面；通过接口和 Agent 的 `getCheckinHistory` 查看。

## 7. Agent 对话里的打卡

对话 Agent（悬浮团团 / `/agent`）和打卡页的 Agent 裁判是同一套体系，不另立规则：

- **内容形状**：对话里的一条打卡用 `features/agent/checkin-entry.ts` 的 `CheckinEntry`，字段与整页稿一致（运动多项、饮食加餐时间、睡眠高级指标、学习要点、自定义字段），由 `entryToCreateInput()` 换成普通创建请求体。改打卡时 `checkinToEntry()` 把已存的打卡还原成同一形状，模型改其中几项后整份交回。
- **事实与结论**：模型用与裁判相同的内置查询（`server/ai/checkin-lookups.ts`：营养表、MET 表，加上按体重估消耗、近 7 晚睡眠、今日学习时长）查事实，填进草稿的 `facts`；各板块怎么查事实的提示词也复用 `REFEREE_SKILLS`。草稿预览（`services/checkins/preview.ts`）与写入走同一套校验和 `judge()`，草稿卡确认前就显示「达标 · 计入进度」或「未达标 · 只存档」；入库时服务端再算一次。用户在卡上改了饮食条目，前端去掉 `facts`，入库按新条目离线判定。
- **工具**（`server/ai/agent-checkin-tools.ts`）：读 `listCheckins`（带 checkinId、分数、是否有效、`editable`）、`getCheckin`、`getCheckinHistory`；查询 `lookupFoodNutrition`、`lookupMet`、`calcExerciseKcal`、`getRecentSleep`、`getTodayStudy`；写 `draftCheckin`、`draftUpdateCheckin`、`draftDeleteCheckin`。写工具只出草稿，用户在草稿卡（`AiDraftCard` / `ChangeDraftCard`）上点确认才调普通接口。
- **好友**：`listFriends`、`getFriendStatus` 只读，好友的打卡带是否有效但不带 checkinId 和 `editable`；不能改、删好友的打卡，也不能替好友打卡。
- 新增返回草稿的工具时，同时登记到 `agent-messages.tsx` 的 `DRAFT_TOOLS`，否则卡片不显示。

## 8. 禁止

- 不要在页面、路由或 Hono handler 里写达标判据（分数线、分钟数、红线时刻）；只能出现在 `features/referee/rules/` 和 `defaults.ts`。
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
