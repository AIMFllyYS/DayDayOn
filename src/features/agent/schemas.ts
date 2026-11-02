import * as z from 'zod'
import { IdSchema, InstantSchema, ModuleSchema } from '@/features/shared/schemas'

/*
 * Agent 对话接口契约（悬浮团团弹窗 + 全屏页）。
 * 草稿（AgentDraft）由 agent-chat 的草稿工具返回，前端渲染成 AiDraftCard，用户确认后
 * 用 confirmBody 调普通创建接口（打卡 / 待办 / 体重）。草稿不直接写库（AGENTS.md 硬规则）。
 */

// ---------------------------------------------------------------------------
// 草稿：draftCheckin / draftTodo / draftWeight 三个工具的返回
// ---------------------------------------------------------------------------

export const DraftFieldSchema = z
  .object({
    label: z.string(),
    value: z.string(),
    hint: z.string().optional(),
  })
  .meta({ id: 'DraftField' })
export type DraftField = z.infer<typeof DraftFieldSchema>

export const DraftItemSchema = z
  .object({
    /** 前端临时 id，确认时映射回 DietItem */
    id: z.string(),
    name: z.string(),
    portion: z.string().default(''),
    kcal: z.number().int().min(0).nullable(),
    hint: z.string().optional(),
  })
  .meta({ id: 'DraftItem' })
export type DraftItem = z.infer<typeof DraftItemSchema>

export const CheckinDraftSchema = z
  .object({
    kind: z.literal('checkin'),
    goalId: z.string(),
    module: ModuleSchema,
    title: z.string(),
    summary: z.string(),
    confidence: z.number().min(0).max(1),
    /** 热量 / 睡眠类结果标注"估算结果，非医疗建议" */
    estimate: z.boolean().default(false),
    fields: z.array(DraftFieldSchema),
    /** 饮食草稿的可编辑条目 */
    items: z.array(DraftItemSchema).optional(),
    /** 普通创建打卡接口的请求体，前端确认时原样提交 */
    confirmBody: z.record(z.string(), z.unknown()),
  })
  .meta({ id: 'CheckinDraft' })
export type CheckinDraft = z.infer<typeof CheckinDraftSchema>

export const TodoDraftSchema = z
  .object({
    kind: z.literal('todo'),
    title: z.string(),
    dueAt: z.string().nullable(),
    priority: z.enum(['normal', 'important']),
    confirmBody: z.record(z.string(), z.unknown()),
  })
  .meta({ id: 'TodoDraft' })
export type TodoDraft = z.infer<typeof TodoDraftSchema>

export const WeightDraftSchema = z
  .object({
    kind: z.literal('weight'),
    weightKg: z.number(),
    confirmBody: z.record(z.string(), z.unknown()),
  })
  .meta({ id: 'WeightDraft' })
export type WeightDraft = z.infer<typeof WeightDraftSchema>

export const AgentDraftSchema = z
  .discriminatedUnion('kind', [CheckinDraftSchema, TodoDraftSchema, WeightDraftSchema])
  .meta({ id: 'AgentDraft' })
export type AgentDraft = z.infer<typeof AgentDraftSchema>

// ---------------------------------------------------------------------------
// 会话（历史列表 / 加载 / 重命名 / 删除）
// ---------------------------------------------------------------------------

export const AgentConversationSchema = z
  .object({
    id: IdSchema,
    title: z.string(),
    lastMessageAt: InstantSchema,
    createdAt: InstantSchema,
  })
  .meta({ id: 'AgentConversation' })
export type AgentConversation = z.infer<typeof AgentConversationSchema>

export const AgentConversationListSchema = z
  .object({ items: z.array(AgentConversationSchema).max(50) })
  .meta({ id: 'AgentConversationList' })
export type AgentConversationList = z.infer<typeof AgentConversationListSchema>

export const RenameConversationSchema = z
  .object({ title: z.string().trim().min(1).max(40) })
  .meta({ id: 'RenameConversation' })
export type RenameConversation = z.infer<typeof RenameConversationSchema>

export const ConversationIdParamSchema = z.object({ conversationId: IdSchema })
