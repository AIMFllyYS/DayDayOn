import 'server-only'
import {
  InvalidToolInputError,
  NoSuchToolError,
  type ToolCallRepairFunction,
  type ToolSet,
} from 'ai'

/*
 * DeepSeek Flash 工具调用入参的确定性修复器（AI SDK 7 ToolLoopAgent.repairToolCall）。
 * 零额外 LLM 调用成本，专治生产日志中高频出现的工具调用畸形输出：
 * 1. 非 strict 模式下在末尾键名处提前 EOS 截断：如 `{"facts": {...}, "advice"` / `"citations":`
 * 2. 末尾多打闭合括号：如 `..."advice": [...]}}`
 * 3. 外层误包 Markdown 代码块围栏
 * 4. 字段类型错位或越界：如把 citations 对象数组填进 advice、可选非空字段传 null、整数字段带小数、文案略超长度
 * 修复后返回新 toolCall，由 AI SDK 7 重新做完整的 JSON 解析与 Zod schema 校验；无法修复时返回 null。
 */

const INT_KEYS = new Set([
  'kcal',
  'sodiumMg',
  'gi',
  'sets',
  'recentNights',
  'todayMinutesBefore',
  'durationMinutes',
  'durationSeconds',
  'deepMin',
  'lightMin',
  'heartRate',
  'fieldVersion',
  'quality',
  'limit',
])

const OPTIONAL_NON_NULL_KEYS = new Set([
  'skipApproved',
  'isFasting',
  'carbQuality',
  'fatQuality',
  'cooking',
  'source',
  'sweet',
  'fromDevice',
  'isMakeup',
  'confidence',
  'method',
  'priority',
  'days',
  'count',
  'yesterday',
  // 待办工具可选非空键
  'groupId',
  'groupName',
  'newGroupName',
  'tag',
  'keyword',
  'archivedOutcome',
  'from',
  'to',
  'dueFrom',
  'dueTo',
  'cursor',
  'limit',
  'eventType',
  'todoId',
  'status',
  'reason',
  'action',
  'name',
  'newName',
  // 打卡与裁判工具可选非空键
  'snackTime',
  'points',
  'advanced',
  'durationMinutes',
  'facts',
  'citations',
  'advice',
  'entry',
  'goalId',
])

const ARRAY_DEFAULT_KEYS = new Set(['citations', 'advice', 'keyPoints', 'tags'])

const DEFAULT_STRING_MAX_LEN: Record<string, number> = {
  name: 30,
  portion: 30,
  subject: 30,
  summary: 120,
  skipComment: 120,
  aiComment: 120,
  note: 200,
  reason: 80,
  what: 60,
  title: 120,
}

const TODO_STRING_MAX_LEN: Record<string, number> = {
  title: 60,
  note: 2000,
  abandonReason: 120,
  groupName: 24,
  newGroupName: 24,
  name: 24,
  newName: 24,
  keyword: 60,
  tag: 16,
  reason: 80,
}

const TOOL_STRING_MAX_LEN: Record<string, Record<string, number>> = {
  draftTodo: TODO_STRING_MAX_LEN,
  draftUpdateTodo: TODO_STRING_MAX_LEN,
  draftDeleteTodo: TODO_STRING_MAX_LEN,
  draftTodoGroup: TODO_STRING_MAX_LEN,
  listTodos: TODO_STRING_MAX_LEN,
  getTodoTimeline: TODO_STRING_MAX_LEN,
}

/** 去掉外层 Markdown 代码块围栏 */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim()
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  return match?.[1] ? match[1].trim() : trimmed
}

/** 扫描并提取首个顶层完整 `{ ... }` JSON 对象（修复末尾多出的 `}` 或尾巴字符） */
function extractBalancedObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
    } else if (ch === '{') {
      depth += 1
    } else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }
  return null
}

/**
 * 尝试把截断的 JSON 对象字符串补全闭合。
 * 重点覆盖 DeepSeek 常见尾部截断：`..., "advice"`、`..., "advice":`、`..., "citations": [` 等。
 */
function closeTruncatedJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  let candidate = text.slice(start).trim()

  // 1) 若末尾停在顶层/对象内未写完的属性键名或冒号（如 `..., "advice"` / `..., "advice":`），直接裁掉该残缺属性
  candidate = candidate.replace(/,\s*"[^"]*"\s*:?\s*$/, '')
  // 2) 若末尾是孤立逗号
  candidate = candidate.replace(/,\s*$/, '')

  // 统计尚未闭合的引号和括号栈
  const stack: Array<'{' | '['> = []
  let inString = false
  let escaped = false
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
    } else if (ch === '{' || ch === '[') {
      stack.push(ch)
    } else if (ch === '}' || ch === ']') {
      const top = stack[stack.length - 1]
      if ((ch === '}' && top === '{') || (ch === ']' && top === '[')) {
        stack.pop()
      } else {
        return null
      }
    }
  }

  if (inString) {
    if (escaped) candidate = candidate.slice(0, -1)
    candidate += '"'
  }

  // 闭合可能残留的末尾冒号或逗号（例如截断在 `"portion":` 或 `{"a": "b",`）
  candidate = candidate.replace(/,\s*"[^"]*"\s*:\s*$/, '')
  candidate = candidate.replace(/,\s*$/, '')

  // 按栈逆序补齐闭合符号
  for (let i = stack.length - 1; i >= 0; i--) {
    candidate += stack[i] === '{' ? '}' : ']'
  }
  return candidate
}

/** 尝试将可能是畸形的 JSON 文本解析为普通对象 */
export function tryRepairJsonObject(raw: string): Record<string, unknown> | null {
  const cleaned = stripCodeFence(raw)
  const candidates: string[] = [cleaned]

  const balanced = extractBalancedObject(cleaned)
  if (balanced && balanced !== cleaned) candidates.push(balanced)

  const closed = closeTruncatedJsonObject(cleaned)
  if (closed && closed !== cleaned) candidates.push(closed)

  for (const text of candidates) {
    try {
      const parsed: unknown = JSON.parse(text)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // 继续尝试下一个候选修复结果
    }
  }
  return null
}

function isCitationLike(v: unknown): v is { title: string; url: string } {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { title?: unknown }).title === 'string' &&
    typeof (v as { url?: unknown }).url === 'string'
  )
}

/** 递归清洗对象中的常见类型偏差（小数取整、null 清理、超长字符串截断） */
function sanitizeValue(value: unknown, maxLenMap: Record<string, number>, key?: string): unknown {
  if (value === null) {
    if (key && ARRAY_DEFAULT_KEYS.has(key)) return []
    if (key && OPTIONAL_NON_NULL_KEYS.has(key)) return undefined
    return null
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined
    if (key && INT_KEYS.has(key)) return Math.round(value)
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    const max = key ? maxLenMap[key] : undefined
    if (max !== undefined && trimmed.length > max) {
      return trimmed.slice(0, max)
    }
    return value
  }
  if (Array.isArray(value)) {
    if (key === 'keyPoints') {
      return value
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim().slice(0, 60))
        .slice(0, 5)
    }
    if (key === 'tags') {
      return value
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim().slice(0, 16))
        .slice(0, 5)
    }
    return value.map((item) => sanitizeValue(item, maxLenMap))
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = sanitizeValue(v, maxLenMap, k)
      if (cleaned !== undefined) out[k] = cleaned
    }
    return out
  }
  return value
}

/** 修复 submitVerdict / draftCheckin / draftUpdateCheckin 等工具的顶层字段错位与约束 */
export function sanitizeToolInputObject(
  toolName: string,
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const maxLenMap = TOOL_STRING_MAX_LEN[toolName] ?? DEFAULT_STRING_MAX_LEN
  const cleaned = sanitizeValue(obj, maxLenMap) as Record<string, unknown>

  if (
    toolName === 'submitVerdict' ||
    toolName === 'draftCheckin' ||
    toolName === 'draftUpdateCheckin'
  ) {
    const extraCitations: Array<{ title: string; url: string }> = []
    if (Array.isArray(cleaned.advice)) {
      const validAdvice: string[] = []
      for (const item of cleaned.advice) {
        if (typeof item === 'string') {
          const s = item.trim()
          if (s.length > 0) validAdvice.push(s.slice(0, 80))
        } else if (isCitationLike(item)) {
          extraCitations.push({
            title: item.title.trim().slice(0, 120),
            url: item.url.trim().slice(0, 2048),
          })
        }
      }
      cleaned.advice = validAdvice.slice(0, 2)
    }

    if (Array.isArray(cleaned.citations) || extraCitations.length > 0) {
      const existing = Array.isArray(cleaned.citations)
        ? cleaned.citations
            .filter(isCitationLike)
            .map((c) => ({ title: c.title.trim().slice(0, 120), url: c.url.trim().slice(0, 2048) }))
        : []
      const seen = new Set(existing.map((c) => c.url))
      for (const c of extraCitations) {
        if (!seen.has(c.url)) {
          seen.add(c.url)
          existing.push(c)
        }
      }
      cleaned.citations = existing.slice(0, 5)
    }
  }

  return cleaned
}

/** 供 ToolLoopAgent 使用的 repairToolCall 实现 */
export function createRepairToolCall<TOOLS extends ToolSet>(): ToolCallRepairFunction<TOOLS> {
  return async ({ toolCall, error }) => {
    if (NoSuchToolError.isInstance(error)) return null
    if (!InvalidToolInputError.isInstance(error)) return null

    const parsed = tryRepairJsonObject(toolCall.input)
    if (!parsed) return null

    const repairedObj = sanitizeToolInputObject(toolCall.toolName, parsed)
    const repairedInput = JSON.stringify(repairedObj)
    if (repairedInput === toolCall.input) return null

    console.warn(`[ai] 自动修复工具入参 ${toolCall.toolName}`)
    return {
      ...toolCall,
      input: repairedInput,
    }
  }
}
