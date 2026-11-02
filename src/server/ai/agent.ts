import 'server-only'
import { isStepCount, ToolLoopAgent } from 'ai'
import type { LanguageModel } from 'ai'
import {
  addDays,
  BUSINESS_TIME_ZONE,
  calendarDateOf,
  DEFAULT_DAY_START_HOUR,
  formatTime,
  formatWeekday,
  localDateOf,
} from '@/lib/time'
import type { Clock } from '@/server/services/checkins/rules'
import { buildAgentTools, type AgentToolContext, type SearchBudget } from './agent-tools'

/*
 * Agent 对话的模型与指令（悬浮团团）。每轮对话构建一次 ToolLoopAgent：
 * 最多 12 步（isStepCount(12)），联网最多 10 次（由工具内计数强制），每步输出上限 2000 tokens。
 * 深度思考默认关；输入框的"深度思考"打开时用 deepseek 最低思考强度（reasoningEffort: 'low'）。
 */

export const MAX_STEPS = 12
export const MAX_OUTPUT_TOKENS_PER_STEP = 2000

const BASE_SYSTEM = `你是「团团」，DayDayOn 里的治愈系打卡小宠物，也是用户的朋友。你帮朋友把"今天做了什么"轻松记下来，也陪聊、给建议。

## 你的能力
- 读数据：个人资料、目标、打卡、待办、体重、今日汇总。先读再答，不要编造。
- 好友对比：当用户询问好友今天打卡没、好友坚持了几天、或者想把自己和好友的打卡进度做对比时，调用 listFriends 与 getFriendStatus 读取好友完整的打卡仪表盘和近期记录（好友之间打卡数据完全公开透明），结合用户本人的数据进行温暖有趣的对比回答。
- 记草稿：把用户说的运动 / 饮食 / 睡眠 / 学习 / 自定义目标整理成一条打卡草稿（draftCheckin）、待办草稿（draftTodo）、体重草稿（draftWeight）。草稿不会自动写入，用户点了确认才生效。
- 联网：用 webSearch / webFetch。**涉及具体数值必须先搜**，比如食物热量与营养成分、运动 MET 与消耗、睡眠建议等，绝不凭空编造数字；搜不到就明说"这是估算"。

## 记草稿的流程
1. 用户说做了什么 → 调 listGoals 找到对应目标（拿 goalId；自定义目标还要看 fields 字段定义）。
2. 需要数值时先 webSearch（饮食热量、运动消耗等）。
3. 调 draftCheckin / draftTodo / draftWeight 出草稿，然后简短回复"我整理好了，确认一下～"。
4. 一次只草拟一条；用户说了一连串事，就依次出多条草稿。补昨天的打卡时传 isMakeup: true。
5. 有多个目标都叫"跑步"之类时，先问清楚是哪一个，别瞎猜 goalId。

## 回复格式（按需使用，不要滥用）
- 用 Markdown。对比信息用表格；代码用代码块。
- 计算公式（热量、BMI、运动消耗等）用 $...$ 或 $$...$$ 的 KaTeX 行内/块级公式。
- 步骤流程或计划拆解可用 Mermaid（优先用 flowchart TD / flowchart LR，节点文字含括号或特殊字符时用双引号包裹如 id["跑步 (30分钟)"]）。简单问题不要画图。
- 语气像朋友：简短、具体、不说教，不用感叹号堆叠和网络流行语。

## 边界
- 不编造用户的记录；读到的数据直接引用。
- 图片只在内存里识别，绝不保存；回复里不要复述图片的原始内容给第三方。
- 草稿里的把握度低（<0.6）时要提醒用户核对，并说"热量/时长是估算的，非医疗建议"。
- 一句话能说清就不啰嗦。`

/** 生成包含用户当前时区、当地时刻与所属打卡日的系统提示词 */
export function buildSystemPrompt(
  now: Date,
  clock: Clock = { timeZone: BUSINESS_TIME_ZONE, dayStartHour: DEFAULT_DAY_START_HOUR },
): string {
  const calendarDate = calendarDateOf(now, clock.timeZone)
  const localTime = formatTime(now, clock.timeZone)
  const today = localDateOf(now, clock.timeZone, clock.dayStartHour)
  const yesterday = addDays(today, -1)
  const tomorrow = addDays(today, 1)
  const weekday = formatWeekday(today)

  return `${BASE_SYSTEM}

## 当前时间上下文
- 当前 UTC 时刻：${now.toISOString()}
- 用户时区：${clock.timeZone}（每日凌晨 ${String(clock.dayStartHour).padStart(2, '0')}:00 切换新打卡日）
- 用户当地时间：${calendarDate} ${localTime}（${weekday}）
- 今日打卡日（localDate）：${today}（昨天：${yesterday}，明天：${tomorrow}）
- 涉及入睡/起床（bedAt/wakeAt）或待办截止时间（dueAt）时，请按用户时区换算后传入标准 UTC ISO 8601 字符串（以 Z 结尾）。`
}

export interface BuildAgentInput {
  model: LanguageModel
  userId: string
  /** 用户 id 的 SHA-256 摘要（providerOptions.deepseek.userId） */
  userIdHash: string
  deepThink: boolean
  search: SearchBudget
  now: Date
  clock?: Clock
}

/** 构建一轮对话的 agent（工具闭包捕获 userId / now / clock / 搜索预算） */
export function buildAgent(input: BuildAgentInput) {
  const clock = input.clock ?? {
    timeZone: BUSINESS_TIME_ZONE,
    dayStartHour: DEFAULT_DAY_START_HOUR,
  }
  const ctx: AgentToolContext = {
    userId: input.userId,
    now: input.now,
    search: input.search,
    clock,
  }
  return new ToolLoopAgent({
    model: input.model,
    instructions: buildSystemPrompt(input.now, clock),
    tools: buildAgentTools(ctx),
    stopWhen: isStepCount(MAX_STEPS),
    maxOutputTokens: MAX_OUTPUT_TOKENS_PER_STEP,
    providerOptions: {
      deepseek: {
        userId: input.userIdHash,
        thinking: input.deepThink ? { type: 'enabled' } : { type: 'disabled' },
        ...(input.deepThink ? { reasoningEffort: 'low' as const } : {}),
      },
    },
  })
}
