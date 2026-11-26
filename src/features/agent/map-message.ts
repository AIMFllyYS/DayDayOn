import type { UIMessage } from 'ai'
import { errorMessage, FALLBACK_MESSAGE, type ApiErrorLike } from '@/lib/api/error-messages'
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
      // 新格式在 entry 里；老会话里的草稿是 data
      const data = (o.entry ?? o.data) as Record<string, unknown> | undefined
      if (data?.module === 'diet') return '饮食'
      if (data?.module === 'exercise') {
        const first = Array.isArray(data.items) ? (data.items[0] as { name?: unknown }) : undefined
        if (typeof first?.name === 'string') return first.name
        return typeof data.category === 'string' ? data.category : '运动'
      }
      if (data?.module === 'custom') return '自定义'
      return data?.module === 'sleep' ? '睡眠' : data?.module === 'study' ? '学习' : undefined
    }
    case 'draftUpdateCheckin':
    case 'draftDeleteCheckin':
      return typeof o.reason === 'string' ? o.reason : undefined
    case 'draftTodo':
      return typeof o.title === 'string' ? o.title : undefined
    case 'draftUpdateTodo':
    case 'draftDeleteTodo':
      return typeof o.reason === 'string' ? o.reason : undefined
    case 'draftTodoGroup': {
      const target =
        typeof o.newName === 'string' ? o.newName : typeof o.name === 'string' ? o.name : ''
      const act =
        o.action === 'create'
          ? '新建'
          : o.action === 'rename'
            ? '重命名'
            : o.action === 'delete'
              ? '删除'
              : ''
      return target ? `${act ? `${act} ` : ''}${target}` : undefined
    }
    case 'listTodos': {
      const parts: string[] = []
      if (typeof o.groupName === 'string') parts.push(o.groupName)
      if (typeof o.keyword === 'string') parts.push(`「${o.keyword}」`)
      if (typeof o.tag === 'string') parts.push(`#${o.tag}`)
      if (typeof o.dueFrom === 'string' || typeof o.dueTo === 'string') {
        parts.push(
          `截止 ${typeof o.dueFrom === 'string' ? o.dueFrom : '…'}~${typeof o.dueTo === 'string' ? o.dueTo : '…'}`,
        )
      } else if (typeof o.from === 'string' || typeof o.to === 'string') {
        parts.push(
          `${typeof o.from === 'string' ? o.from : '…'}~${typeof o.to === 'string' ? o.to : '…'}`,
        )
      }
      if (parts.length === 0 && typeof o.status === 'string') {
        const statusMap: Record<string, string> = {
          active: '全部进行中',
          open: '进行中',
          overdue: '已过期',
          done: '已完成',
          abandoned: '已放弃',
          archived: '已归档',
          quadrant: '四象限',
        }
        return statusMap[o.status] ?? o.status
      }
      return parts.length > 0 ? parts.join(' · ') : undefined
    }
    case 'getTodoDetail':
      return typeof o.todoId === 'string' ? '查看备注与历程' : undefined
    case 'getTodoTimeline': {
      const from = typeof o.from === 'string' ? o.from : ''
      const to = typeof o.to === 'string' ? o.to : ''
      if (from || to) return `${from || '…'} ~ ${to || '…'}`
      return typeof o.eventType === 'string' ? o.eventType : '近 7 天历程'
    }
    case 'draftWeight':
      return typeof o.weightKg === 'number' ? `${o.weightKg} kg` : undefined
    case 'getFriendStatus':
      return typeof o.friendIdOrNickname === 'string' ? o.friendIdOrNickname : undefined
    case 'lookupFoodNutrition':
      return Array.isArray(o.names)
        ? o.names.filter((n) => typeof n === 'string').join('、')
        : undefined
    case 'lookupMet':
      return Array.isArray(o.activities)
        ? o.activities
            .map((a) =>
              typeof a === 'object' && a !== null ? (a as { name?: unknown }).name : null,
            )
            .filter((n): n is string => typeof n === 'string')
            .join('、')
        : undefined
    case 'calcExerciseKcal':
      return typeof o.minutes === 'number' ? `${o.minutes} 分钟` : undefined
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

export function toTurnParts(
  parts: UIMessage['parts'],
  options: { settled?: boolean } = {},
): AgentPart[] {
  const settled = options.settled ?? false
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
        state: !settled && part.state === 'streaming' ? 'streaming' : 'done',
      })
    } else if (type === 'text') {
      out.push({
        type: 'text',
        id: String(part.id ?? 't'),
        text: String(part.text ?? ''),
        state: !settled && part.state === 'streaming' ? 'streaming' : 'done',
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
      const rawState = toToolState(typeof part.state === 'string' ? part.state : undefined)
      // 已结束的历史回合里若残留 input-streaming / input-available（流式中途异常），降级为失败态，避免永远转圈
      const incompleteInSettled =
        settled && (rawState === 'input-streaming' || rawState === 'input-available')
      const state: ToolCallState = incompleteInSettled ? 'output-error' : rawState
      out.push({
        type: 'tool',
        id: String(part.toolCallId ?? part.id ?? toolName),
        toolName,
        state,
        summary: state === 'output-error' ? undefined : toolSummary(toolName, part.input),
        input: part.input,
        output: part.output,
        errorText:
          typeof part.errorText === 'string'
            ? part.errorText
            : incompleteInSettled
              ? '本次工具调用未完成'
              : undefined,
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

/** 把 useChat 抛出的 Error 映射成中文友好文案（识别服务端 JSON 错误码） */
export function formatChatError(error: Error | undefined): string {
  if (!error?.message) return FALLBACK_MESSAGE
  const raw = error.message.trim()
  if (raw.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'code' in parsed &&
        typeof (parsed as { code?: unknown }).code === 'string'
      ) {
        return errorMessage(parsed as ApiErrorLike)
      }
    } catch {
      // 非 JSON 错误文本按兜底处理
    }
  }
  return /[\u4e00-\u9fa5]/.test(raw) ? raw : FALLBACK_MESSAGE
}

export function toTurnView(
  message: UIMessage,
  status: AgentTurnView['status'],
  errorText?: string,
): AgentTurnView {
  return {
    id: message.id,
    status,
    parts: toTurnParts(message.parts, { settled: status === 'done' || status === 'error' }),
    errorText: status === 'error' ? errorText : undefined,
  }
}
