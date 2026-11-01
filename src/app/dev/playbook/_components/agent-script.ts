import type {
  AgentPart,
  AgentTurnView,
  ReasoningPart,
  TextPart,
  ToolPart,
} from '@/features/agent/types'

/*
 * Playbook 演示数据：用脚本模拟一次 ToolLoopAgent 的输出过程，逐帧生成 AgentTurnView。
 * 只用于 /dev，不代表真实接口。
 */

const TICK_MS = 90

export const ANSWER =
  '记好啦！这顿午餐大约 **520–610 kcal**，蛋白质 **约 24g**。\n\n今天已经吃了 820 kcal、运动消耗 310 kcal，离目标还有 **约 520 kcal** 的空间，晚饭可以吃得清淡一点～'

/** 生成"拍照识别午餐"的逐帧快照。每帧间隔 TICK_MS */
export function buildLunchFrames(): AgentTurnView[] {
  const parts: AgentPart[] = []
  const frames: AgentTurnView[] = []
  let elapsed = 0
  const snap = (status: AgentTurnView['status'] = 'streaming') => {
    elapsed += TICK_MS
    frames.push({ id: 'lunch', status, parts: structuredClone(parts), durationMs: elapsed })
  }
  const wait = (n: number) => {
    for (let i = 0; i < n; i++) snap()
  }
  const stream = (type: 'reasoning' | 'text', id: string, full: string, chunk: number) => {
    const part: ReasoningPart | TextPart = { type, id, text: '', state: 'streaming' }
    parts.push(part)
    for (let i = chunk; i < full.length + chunk; i += chunk) {
      part.text = full.slice(0, i)
      snap()
    }
    part.state = 'done'
  }
  const tool = (t: Omit<ToolPart, 'type' | 'state'>): ToolPart => {
    const part: ToolPart = { type: 'tool', state: 'input-streaming', ...t }
    parts.push(part)
    return part
  }
  const finish = (t: ToolPart, durationMs: number, output: unknown) => {
    t.state = 'output-available'
    t.durationMs = durationMs
    t.output = output
  }

  snap('submitted')
  snap('submitted')

  parts.push({ type: 'step-start' })
  stream(
    'reasoning',
    'r1',
    '图片里是一盘番茄炒蛋、一碗米饭和半碗紫菜蛋花汤，看起来是一人份，三样分别估算。',
    4,
  )
  const a = tool({
    id: 't1',
    toolName: 'estimateFoodNutrition',
    summary: '番茄炒蛋 · 约 200g',
    input: { name: '番茄炒蛋', grams: 200 },
  })
  snap()
  const b = tool({
    id: 't2',
    toolName: 'estimateFoodNutrition',
    summary: '米饭 · 约 150g',
    input: { name: '米饭', grams: 150 },
  })
  snap()
  const c = tool({
    id: 't3',
    toolName: 'estimateFoodNutrition',
    summary: '紫菜蛋花汤 · 约 250ml',
    input: { name: '紫菜蛋花汤', ml: 250 },
  })
  ;[a, b, c].forEach((t) => (t.state = 'input-available'))
  wait(5)
  finish(b, 410, { kcal: { min: 165, max: 180 }, protein: 4 })
  wait(3)
  finish(a, 760, { kcal: { min: 240, max: 280 }, protein: 14 })
  wait(3)
  finish(c, 980, { kcal: { min: 60, max: 110 }, protein: 6, confidence: 0.45 })
  snap()

  parts.push({ type: 'step-start' })
  stream('reasoning', 'r2', '汤的把握不大，搜一下常见做法每 100ml 的热量。', 4)
  const d = tool({
    id: 't4',
    toolName: 'webSearch',
    summary: '紫菜蛋花汤 热量 每100ml',
    input: { query: '紫菜蛋花汤 热量 每100ml' },
  })
  const e = tool({
    id: 't5',
    toolName: 'webFetch',
    summary: 'food.example.com/soup/123',
    input: { url: 'https://food.example.com/soup/123' },
  })
  d.state = 'input-available'
  e.state = 'input-available'
  wait(6)
  finish(d, 820, { results: 5 })
  parts.push({
    type: 'source',
    id: 's1',
    url: 'https://www.boohee.com/shiwu/zicaidanhuatang',
    title: '紫菜蛋花汤的热量 - 薄荷健康',
  })
  parts.push({
    type: 'source',
    id: 's2',
    url: 'https://zh.wikipedia.org/wiki/紫菜汤',
    title: '紫菜汤 - 维基百科',
  })
  wait(4)
  e.state = 'output-error'
  e.errorText = '网页打不开（超时 10 秒），已改用搜索结果'
  snap()

  parts.push({ type: 'step-start' })
  const f = tool({ id: 't6', toolName: 'getUserProfile', summary: '体重、目标', input: {} })
  const g = tool({
    id: 't7',
    toolName: 'getDaySummary',
    summary: '10 月 31 日',
    input: { localDate: '2026-10-31' },
  })
  f.state = 'input-available'
  g.state = 'input-available'
  wait(3)
  finish(f, 40, { weightKg: 52.4, targetKcal: 1650 })
  finish(g, 120, { intakeKcal: 820, burnKcal: 310 })
  snap()

  parts.push({ type: 'step-start' })
  stream('text', 'x1', ANSWER, 3)
  const last = frames.at(-1)
  if (last)
    frames.push({ ...last, status: 'done', parts: structuredClone(parts), durationMs: 6400 })
  return frames
}

export const PLAYBACK_TICK_MS = TICK_MS

function toolOk(id: string, toolName: string, summary: string, durationMs: number): ToolPart {
  return {
    type: 'tool',
    id,
    toolName,
    summary,
    state: 'output-available',
    durationMs,
    input: { summary },
    output: { ok: true },
  }
}

/** 工具很多的一次回复：4 步、12 个工具，用来检验活动条在工具很多时仍然只占一行 */
export const manyToolsTurn: AgentTurnView = {
  id: 'weekly',
  status: 'done',
  durationMs: 11200,
  parts: [
    { type: 'step-start' },
    { type: 'reasoning', id: 'm-r1', state: 'done', text: '要做本周总结，先把七天的记录都拿到。' },
    ...['10.25', '10.26', '10.27', '10.28', '10.29', '10.30', '10.31'].map((d, i) =>
      toolOk(`m-d${i}`, 'getDaySummary', d, 80 + i * 12),
    ),
    { type: 'step-start' },
    {
      type: 'reasoning',
      id: 'm-r2',
      state: 'done',
      text: '周三和周六的运动记录只有步数，补算一下消耗。',
    },
    toolOk('m-k1', 'lookupMet', '快走 · 6km/h', 20),
    toolOk('m-k2', 'calcExerciseKcal', '周三 · 快走 48 分钟', 15),
    toolOk('m-k3', 'calcExerciseKcal', '周六 · 快走 35 分钟', 14),
    { type: 'step-start' },
    toolOk('m-p', 'getUserProfile', '体重、目标', 38),
    {
      type: 'tool',
      id: 'm-w',
      toolName: 'webSearch',
      summary: '一周减重 0.5kg 需要的热量缺口',
      state: 'output-error',
      errorText: '本次搜索超出今日联网额度，已用内置知识回答',
      input: { query: '一周减重 0.5kg 热量缺口' },
    },
    { type: 'step-start' },
    {
      type: 'text',
      id: 'm-x',
      state: 'done',
      text: '这周一共打卡 **19 次**，比上周多 4 次。平均每天热量缺口约 **310 kcal**，按这个节奏一周大约能减 0.3kg。\n\n运动集中在周末，工作日可以试试午饭后快走 15 分钟。',
    },
  ],
}

/** 进行中的一帧：第 2 步两个工具并行 */
export const runningTurn: AgentTurnView = {
  id: 'running',
  status: 'streaming',
  parts: [
    { type: 'step-start' },
    { type: 'reasoning', id: 'q-r1', state: 'done', text: '用户问这款饮料能不能喝，先查成分。' },
    toolOk('q-t1', 'webSearch', '元气森林 白桃味 成分表', 760),
    { type: 'step-start' },
    {
      type: 'tool',
      id: 'q-t2',
      toolName: 'webFetch',
      summary: 'genkiforest.com/products/peach',
      state: 'input-available',
      input: { url: 'https://genkiforest.com/products/peach' },
    },
    {
      type: 'tool',
      id: 'q-t3',
      toolName: 'getDaySummary',
      summary: '10 月 31 日',
      state: 'input-available',
      input: { localDate: '2026-10-31' },
    },
  ],
}

export const errorTurn: AgentTurnView = {
  id: 'error',
  status: 'error',
  errorText: '本周 AI 额度用完了，下周一 00:00 恢复，也可以用兑换码加购',
  parts: [
    { type: 'step-start' },
    {
      type: 'reasoning',
      id: 'e-r1',
      state: 'done',
      text: '这是一张睡眠 App 的截图，需要识别入睡和起床时间。',
    },
  ],
}

export const quickTurn: AgentTurnView = {
  id: 'quick',
  status: 'done',
  durationMs: 1300,
  parts: [
    { type: 'reasoning', id: 'k-r1', state: 'done', text: '简单的鼓励类问题，不需要查数据。' },
    {
      type: 'text',
      id: 'k-x',
      state: 'done',
      text: '当然可以！今天先睡个好觉，明天的打卡我会提醒你～',
    },
  ],
}
