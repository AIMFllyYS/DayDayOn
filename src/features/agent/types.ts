/*
 * Agent 界面的视图模型。结构对齐 AI SDK UIMessage 的 parts：
 *   step-start → reasoning / tool-* → … → text，source-url 表示引用的网页。
 * 一次助手回复 = 一个 AgentTurnView，parts 按到达顺序排列，界面再按"步"分组。
 * 接入 `ai` 包后只需要写一层映射，组件不用改；接入时以 node_modules/ai/docs/ 为准核对 state 取值。
 */

export type ToolCallState =
  'input-streaming' | 'input-available' | 'output-available' | 'output-error'

export interface ToolPart {
  type: 'tool'
  id: string
  /** 工具注册名，例如 webSearch；中文名和图标从 tool-meta.ts 取 */
  toolName: string
  state: ToolCallState
  /** 一行摘要，例如"番茄炒蛋 热量" */
  summary?: string
  input?: unknown
  output?: unknown
  errorText?: string
  durationMs?: number
}

export interface ReasoningPart {
  type: 'reasoning'
  id: string
  text: string
  state: 'streaming' | 'done'
}

export interface TextPart {
  type: 'text'
  id: string
  text: string
  state: 'streaming' | 'done'
}

export interface SourcePart {
  type: 'source'
  id: string
  url: string
  title?: string
}

export interface StepStartPart {
  type: 'step-start'
}

export type AgentPart = StepStartPart | ReasoningPart | ToolPart | TextPart | SourcePart

/** submitted：已发出、还没收到任何内容；streaming：输出中；done：完成；error：中途失败 */
export type AgentTurnStatus = 'submitted' | 'streaming' | 'done' | 'error'

export interface AgentTurnView {
  id: string
  status: AgentTurnStatus
  parts: AgentPart[]
  durationMs?: number
  /** status 为 error 时给用户看的原因 */
  errorText?: string
}
