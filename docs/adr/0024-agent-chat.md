# ADR-0024 — Agent 对话：悬浮宠物、全量工具集与联网搜索

- 状态：Accepted（2026-11-02 评审通过并优化落地；2026-11-16 同步最新实现）
- 日期：2026-11-02
- 决策人：项目负责人（AI 整理落地）

## 背景

项目已有完整的 AI 管线（`runAi` 预占/结算、`ai_runs`、额度账本、饮食拍照识别）和一套 Agent 前端组件（`AgentTurn`、`AiDraftCard` 等，只在 Playbook 用假数据回放）。但前端从未真实接入对话：没有流式接口、没有会话/消息存储、没有工具。

负责人要做一个「悬浮团团」：应用内常驻的 IP 小宠物，点击弹出 Agent 对话窗，全屏进独立页。Agent 能读用户数据、把自然语言整理成打卡/待办/体重草稿（确认后入库），并支持联网搜索、图片/文本附件。

ADR-0003 把「联网搜索」列为 v0.2 暂不做。本 ADR 推翻这一条：负责人明确要求饮食热量、运动 MET 等数值必须联网搜索后给出，而不是凭模型记忆编造。

## 面临的选项

- **接入方式**：在现有 `runAi` 之外另写一条流式 agent 路径（ToolLoopAgent），复用同一套账本预占/结算。
- **草稿 vs 直接写库**：AGENTS.md 硬规则「AI 结果先草稿、用户确认后入库」。可选：草稿 + 一键确认；直接写库 + 撤销；按把握度分流。
- **联网搜索**：DeepSeek 官方 Search / Fetch API（按次计费）vs 作为普通工具让模型自己决定。
- **思考模式**：默认关、输入框可切换 vs 一直开。
- **悬浮按钮形态**：传统带圆底盘的 FAB 按钮 vs 纯 IP 形象独立桌宠形态。

## 决定

1. **接入 ToolLoopAgent（20 步上限）**：`src/server/ai/agent.ts` 构建 `ToolLoopAgent`（`stopWhen: isStepCount(MAX_STEPS)`，`MAX_STEPS = 20`，每步 `MAX_OUTPUT_TOKENS_PER_STEP = 2000`），通过 `prepareStep` 在最后一步强制 `toolChoice: 'none'` 保证一定输出文字回答；`src/server/ai/run-agent.ts` 复用 `runAi` 的预占/结算账本。流式接口 `POST /api/v1/agent/chat` 走 UI message stream，请求体上限 `11 MB`（`AGENT_CHAT_MAX_BODY_BYTES`，支持最多 2 张内联 JPEG dataURL + 文本附件，由 `validateInlineJpegDataUrl` 校验），不走幂等中间件（流式响应体无法缓存），幂等由额度层的 `rejectReusedKey` 保证。
2. **草稿 + 一键确认与全量工具集**：写工具只返回结构化草稿（`AgentDraft`），前端渲染成 `AiDraftCard` / `ChangeDraftCard`，用户确认后调普通接口。完整工具集（`agent-tools.ts` + `agent-checkin-tools.ts`）包括：
   - **个人与状态读**：`getUserProfile`、`listGoals`、`getDaySummary`、`listTodos`、`listCheckins`、`getWeight`、`getCheckin`、`getCheckinHistory`；
   - **近况图表**：`showStats`（直接返回 `Insights` 数据，前端通过 `STATS_TOOLS` 渲染为同款 `InsightCard`）；
   - **打卡事实查询**：`lookupFoodNutrition`、`lookupMet`、`calcExerciseKcal`、`getRecentSleep`、`getTodayStudy`；
   - **好友只读穿透**：`listFriends`、`getFriendStatus`（只读好友概览、仪表盘与近期打卡，禁止改/删或替打）；
   - **联网搜索**：`webSearch`、`webFetch`（每轮上限 `10` 次）；
   - **草稿写工具**：`draftCheckin`、`draftUpdateCheckin`（限今天/昨天且须填 `reason`）、`draftDeleteCheckin`（限今天/昨天且须填 `reason`）、`draftTodo`、`draftWeight`。
3. **联网搜索**：DeepSeek 官方 `POST /v1/tools/search`、`POST /v1/tools/fetch`，由模型自己决定何时搜；饮食热量、运动 MET 等数值在提示词里写明「内置表查不到时必须先搜」。每次成功约 5000 微元计入额度。每轮最多 10 次。
4. **思考模式**：默认 `thinking: disabled`；输入框浮动「深度思考」开关打开时用 `reasoningEffort: 'low'`（DeepSeek 最低档）；AI 正在生成时自动隐藏该开关以节省空间。
5. **会话、消息与动态标题**：`agent_conversations` + `agent_messages`（`parts` jsonb）统一持久化对话与打卡裁判分析回合。用户图片永不落盘：入库前由 `stripFileParts` 换成「N 张照片（识别后不保存）」，仅在当次浏览器标签页内存保留预览。`AiPurpose` 包含 `agent-chat` 与 `referee`。对话标题动态显示：`AgentPanel` 顶栏优先展示当前会话标题（首条用户文本由 `titleFromFirstUserText` 取前 20 字，纯发图记为「图片打卡识别」，打卡裁判分析会话为「目标名 · 打卡分析」），无历史标题时动态回退为当前所选宠物名。
6. **4 吉祥物全链路适配与纯 IP 悬浮桌宠（FloatingPet）**：
   - **4 吉祥物全链路适配**：支持 `tuan`（团团）/ `dun`（墩墩）/ `mian`（绵绵）/ `you`（柚柚）四种陪伴形象（`resolveMascotCharacter` / `mascotCharacterName`），悬浮宠、弹窗与全屏欢迎页、系统提示词 `loadPetName()` 自称以及流式兜底错误提示全程同步跟随用户偏好。
   - **去除圆形底盘与立体投影**：去除传统 FAB 白圈底托，直接以 IP（`PetAvatar`）本身作为可拖拽可点击的桌宠实体，配合 SVG alpha 轮廓柔和投影营造轻盈浮空感。
   - **交互、吸附与隐藏规则**：支持拖拽、双击转圈、长按晃悠；贴靠边缘时自然露半头或倒立探头。由 `isFloatingPetHidden(pathname, viewingFriendId)` 严格控制隐藏规则——在 **`/agent` 全屏页及子路由**、**`/me` 我的页**（已有独立互动宠物）以及 **串门好友空间（`viewingFriendId !== null`，已有好友小窝舞台）** 时隐藏悬浮宠物（切回「我」恢复显示）；隐藏前通过 `useLayoutEffect` 同步 `blur()` 并改用原生 `inert`，杜绝焦点无障碍警告。
7. **Agent 弹窗（AgentPanel）与全屏页**：
   - 弹窗定位优化为手机顶部留 1/4（25vh）、左侧留 1/5（20vw），空间充裕；桌面右下角卡片。
   - 顶栏左上角为明确的放大全屏按钮，紧接动态会话标题（回退当前宠物名），右侧历史对话使用 Base UI Popover 挂载到 body Portal（`z-[60]`），配合视口碰撞检测彻底消除左侧截断。
   - 输入框单行精致呈现（支持最大自适应扩展至 5 行），左侧支持原生文件多选（最多 2 张图片 + `.txt/.md/.csv` 文本附件）、中间文本、右侧紧凑圆圈发送按钮，输入框与消息流之间无多余分割线。
   - 全屏页（`/agent`）顶栏左侧带箭头+「返回」文字，标题「{petName} AI打卡搭子」，输入框真正吸底。

## 理由

- 复用现有账本（预占上限 = 20 步 × 单步输出上限 + 10 次联网）保证多步复杂查询与多条草稿循环不会超扣。
- 草稿 + 确认维持「用户是最终决定者」的产品原则，也避免 AI 直接写库带来的误记风险。
- 去除白圈让桌宠自然融入 UI，边缘吸附露半头宛如探出手机边框，治愈感与生命感更强。
- Popover 经 Portal 渲染彻底解决 `overflow-hidden` 容器裁剪问题。

## 放弃了什么

- 在 IP 后面保留圆形按钮底托（违背治愈系桌宠自然陪伴的设计初衷）。
- 直接写库 + 撤销（违背现有硬规则，且撤销窗口语义复杂）。
- 自建搜索 / 网页抓取（重复造轮子，且不如官方 API 稳定）。

## 何时重审

- 联网搜索按次计费上线后，核对真实花费与 5000 微元/次的估算是否一致。
- 悬浮团团的手势若被证明误触率高，重审「点击 vs 拖动 vs 长按」的判定阈值。
