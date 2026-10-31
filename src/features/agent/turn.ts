import { getToolMeta } from './tool-meta'
import type {
  AgentPart,
  AgentTurnView,
  ReasoningPart,
  SourcePart,
  TextPart,
  ToolPart,
} from './types'

export interface AgentStep {
  index: number
  reasoning: ReasoningPart[]
  tools: ToolPart[]
}

/**
 * 按 step-start 把过程类 part（推理、工具）分成"步"。
 * ToolLoopAgent 每一步：模型思考 → 发出一个或多个工具调用（同一步里的多个调用是并行的）→ 拿到结果进入下一步。
 * 文字和来源不进步骤，单独在正文区展示。
 */
export function splitSteps(parts: readonly AgentPart[]): AgentStep[] {
  const steps: AgentStep[] = []
  let current: AgentStep | null = null
  for (const p of parts) {
    if (p.type === 'step-start' || !current) {
      current = { index: steps.length + 1, reasoning: [], tools: [] }
      steps.push(current)
      if (p.type === 'step-start') continue
    }
    if (p.type === 'reasoning') current.reasoning.push(p)
    if (p.type === 'tool') current.tools.push(p)
  }
  return steps.filter((s) => s.reasoning.length > 0 || s.tools.length > 0)
}

export const isToolRunning = (t: ToolPart) =>
  t.state === 'input-streaming' || t.state === 'input-available'

export interface TurnSummary {
  tools: ToolPart[]
  failed: number
  running: number
  thoughts: number
  steps: number
  /** 正在发生的事，用一句话描述；完成后为 null */
  activity: string | null
}

export function summarizeTurn(turn: AgentTurnView): TurnSummary {
  const tools = turn.parts.filter((p): p is ToolPart => p.type === 'tool')
  const reasoning = turn.parts.filter((p): p is ReasoningPart => p.type === 'reasoning')
  const running = tools.filter(isToolRunning)
  let activity: string | null = null
  if (turn.status === 'submitted') activity = '正在准备'
  else if (turn.status === 'streaming') {
    const last = turn.parts.at(-1)
    if (running.length > 1) {
      activity = `${getToolMeta(running[0]?.toolName ?? '').verb}等 ${running.length} 件事`
    } else if (running[0]) {
      activity = getToolMeta(running[0].toolName).verb
    } else if (last?.type === 'reasoning' && last.state === 'streaming') activity = '正在思考'
    else if (last?.type === 'text') activity = '正在回复'
    else activity = '正在思考'
  }
  return {
    tools,
    failed: tools.filter((t) => t.state === 'output-error').length,
    running: running.length,
    thoughts: reasoning.length,
    steps: splitSteps(turn.parts).length,
    activity,
  }
}

export function turnText(turn: AgentTurnView): { text: string; streaming: boolean } {
  const texts = turn.parts.filter((p): p is TextPart => p.type === 'text')
  return {
    text: texts.map((t) => t.text).join('\n\n'),
    streaming: texts.some((t) => t.state === 'streaming'),
  }
}

export function turnSources(turn: AgentTurnView): SourcePart[] {
  const seen = new Set<string>()
  return turn.parts.filter((p): p is SourcePart => {
    if (p.type !== 'source' || seen.has(p.url)) return false
    seen.add(p.url)
    return true
  })
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
