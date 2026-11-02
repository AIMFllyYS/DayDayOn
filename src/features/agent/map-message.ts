import type { UIMessage } from 'ai'
import type { AgentPart, AgentTurnView, ToolCallState } from './types'

/*
 * UIMessage → AgentTurnView 的唯一映射层（types.ts 注释里预留的"只写一层映射"）。
 * 组件只消费 AgentTurnView；接入 ai 包后只有这里需要跟着 UIMessage 的 part 结构改。
 */

function toolSummary(toolName: string, input: unknown): string | undefined {
  if (typeof input !== 'object' || input === null) return undefined
  const o = input as Record<string, unknown>
  switch (toolName) {
    case 'webSearch':
      return typeof o.query === 'string' ? o.query : undefined
    case 'webFetch':
      return typeof o.url === 'string' ? o.url : undefined
    case 'draftCheckin': {
      const data = o.data as Record<string, unknown> | undefined
      if (data?.module === 'diet') return '饮食'
      if (data?.module === 'exercise')
        return typeof data.category === 'string' ? data.category : '运动'
      return data?.module === 'sleep' ? '睡眠' : data?.module === 'study' ? '学习' : undefined
    }
    case 'draftTodo':
      return typeof o.title === 'string' ? o.title : undefined
    case 'draftWeight':
      return typeof o.weightKg === 'number' ? `${o.weightKg} kg` : undefined
    case 'listCheckins': {
      const from = typeof o.from === 'string' ? o.from : ''
      const to = typeof o.to === 'string' ? o.to : ''
      return from || to ? `${from || '…'} ~ ${to || '…'}` : undefined
    }
    default:
      return undefined
  }
}

function toToolState(state: string | undefined): ToolCallState {
  if (state === 'input-streaming' || state === 'input-available' || state === 'output-available') {
    return state
  }
  return 'output-error'
}

export function toTurnParts(parts: UIMessage['parts']): AgentPart[] {
  const out: AgentPart[] = []
  for (const part of parts as Array<Record<string, unknown> & { type?: string }>) {
    const type = part?.type
    if (type === 'step-start') {
      out.push({ type: 'step-start' })
    } else if (type === 'reasoning') {
      out.push({
        type: 'reasoning',
        id: String(part.id ?? 'r'),
        text: String(part.text ?? ''),
        state: part.state === 'streaming' ? 'streaming' : 'done',
      })
    } else if (type === 'text') {
      out.push({
        type: 'text',
        id: String(part.id ?? 't'),
        text: String(part.text ?? ''),
        state: part.state === 'streaming' ? 'streaming' : 'done',
      })
    } else if (type === 'source-url') {
      out.push({
        type: 'source',
        id: String(part.sourceId ?? part.id ?? 's'),
        url: String(part.url ?? ''),
        title: typeof part.title === 'string' ? part.title : undefined,
      })
    } else if (typeof type === 'string' && type.startsWith('tool-')) {
      const toolName = type.slice(5)
      const state = toToolState(typeof part.state === 'string' ? part.state : undefined)
      out.push({
        type: 'tool',
        id: String(part.toolCallId ?? part.id ?? toolName),
        toolName,
        state,
        summary: state === 'output-error' ? undefined : toolSummary(toolName, part.input),
        input: part.input,
        output: part.output,
        errorText: typeof part.errorText === 'string' ? part.errorText : undefined,
      })
    }
    // file / data-* / source-document / 其它 part 不进回合视图
  }
  return out
}

/** 判断一次助手回复是否仍在流式（有正在写的文字、推理或工具） */
export function isStreamingTurn(parts: UIMessage['parts']): boolean {
  return (parts as Array<Record<string, unknown>>).some((p) => {
    if (typeof p !== 'object' || p === null) return false
    const state = p.state
    return state === 'streaming' || state === 'input-streaming' || state === 'input-available'
  })
}

export function toTurnView(message: UIMessage, status: AgentTurnView['status']): AgentTurnView {
  return {
    id: message.id,
    status,
    parts: toTurnParts(message.parts),
    errorText: undefined,
  }
}
