import * as z from 'zod'
import { cursorPage, IdSchema, InstantSchema, LocalDateSchema } from '@/features/shared/schemas'

/*
 * 待办契约（Todo v2）：分组面板、四象限优先级、自定义标签、2000 字备注、已过期/已完成/已放弃、
 * 30 天自动归档、长按拖拽排序、过程时间轴。前后端共用，统一 `import * as z from 'zod'`。
 */

export const TODO_DEFAULT_GROUP_NAME = '默认待办'
export const TODO_TITLE_MAX = 60
export const TODO_NOTE_MAX = 2000
export const TODO_TAG_MAX_LENGTH = 16
export const TODO_TAGS_MAX_COUNT = 5
export const TODO_GROUP_NAME_MAX = 24
export const TODO_GROUP_LIMIT = 50
export const TODO_ABANDON_REASON_MAX = 120
export const TODO_OPEN_LIMIT = 500
export const TODO_AUTO_ARCHIVE_DAYS = 30
export const TODO_INITIAL_GROUP_PAGE_SIZE = 20

export const TODO_PRIORITIES = [
  'urgent-important',
  'important-not-urgent',
  'urgent-not-important',
  'not-important-not-urgent',
] as const

export const TodoPrioritySchema = z
  .enum(TODO_PRIORITIES, { error: '优先级不合法' })
  .meta({ id: 'TodoPriority' })
export type TodoPriority = z.infer<typeof TodoPrioritySchema>

export const TODO_LIFECYCLE_STATUSES = ['open', 'done', 'abandoned'] as const
export const TodoLifecycleStatusSchema = z
  .enum(TODO_LIFECYCLE_STATUSES)
  .meta({ id: 'TodoLifecycleStatus' })
export type TodoLifecycleStatus = z.infer<typeof TodoLifecycleStatusSchema>

export const TODO_QUERY_STATUSES = [
  'open',
  'overdue',
  'active',
  'done',
  'abandoned',
  'archived',
  'quadrant',
] as const
/** GET /todos?status= 查询桶（active = 全部进行中含已过期，兼容 open|overdue|done|abandoned|archived|quadrant） */
export const TodoStatusSchema = z.enum(TODO_QUERY_STATUSES).meta({ id: 'TodoStatus' })
export type TodoStatus = z.infer<typeof TodoStatusSchema>

export const TODO_EVENT_TYPES = [
  'created',
  'completed',
  'reopened',
  'abandoned',
  'moved',
  'updated',
  'deleted',
] as const
export const TodoEventTypeSchema = z.enum(TODO_EVENT_TYPES).meta({ id: 'TodoEventType' })
export type TodoEventType = z.infer<typeof TodoEventTypeSchema>

const TitleSchema = z
  .string()
  .trim()
  .min(1, { error: '写点什么吧' })
  .max(TODO_TITLE_MAX, { error: `最多 ${TODO_TITLE_MAX} 个字` })

const NoteSchema = z
  .string()
  .trim()
  .max(TODO_NOTE_MAX, { error: `备注最多 ${TODO_NOTE_MAX} 个字` })
  .transform((v) => (v.length === 0 ? null : v))

const GroupNameSchema = z
  .string()
  .trim()
  .min(1, { error: '给分组起个名字吧' })
  .max(TODO_GROUP_NAME_MAX, { error: `分组名最多 ${TODO_GROUP_NAME_MAX} 个字` })

const TagItemSchema = z
  .string()
  .trim()
  .min(1, { error: '标签不能为空' })
  .max(TODO_TAG_MAX_LENGTH, { error: `单个标签最多 ${TODO_TAG_MAX_LENGTH} 个字` })

export const TodoTagsInputSchema = z
  .array(TagItemSchema)
  .max(TODO_TAGS_MAX_COUNT, { error: `最多添加 ${TODO_TAGS_MAX_COUNT} 个标签` })
  .transform((items) => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const raw of items) {
      if (!seen.has(raw)) {
        seen.add(raw)
        out.push(raw)
      }
    }
    return out
  })

const AbandonReasonSchema = z
  .string()
  .trim()
  .max(TODO_ABANDON_REASON_MAX, { error: `放弃原因最多 ${TODO_ABANDON_REASON_MAX} 个字` })
  .transform((v) => (v.length === 0 ? null : v))

// ---------------------------------------------------------------------------
// 核心实体 DTO
// ---------------------------------------------------------------------------

export const TodoGroupSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    isDefault: z.boolean(),
    sortOrder: z.number().int(),
    /** 该分组下未过期的进行中待办数 */
    openCount: z.number().int().min(0),
    /** 该分组下 24 小时内快到期数 */
    soonCount: z.number().int().min(0),
    createdAt: InstantSchema,
    updatedAt: InstantSchema,
  })
  .meta({ id: 'TodoGroup' })
export type TodoGroup = z.infer<typeof TodoGroupSchema>

export const TodoTagSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    createdAt: InstantSchema,
  })
  .meta({ id: 'TodoTag' })
export type TodoTag = z.infer<typeof TodoTagSchema>

export const TodoSchema = z
  .object({
    id: IdSchema,
    groupId: IdSchema,
    groupName: z.string(),
    title: z.string(),
    note: z.string().nullable(),
    /** DDL 时刻；前端 datetime-local 用 combineLocalDateTime() 转换 */
    dueAt: InstantSchema.nullable(),
    priority: TodoPrioritySchema,
    tags: z.array(z.string()),
    status: TodoLifecycleStatusSchema,
    doneAt: InstantSchema.nullable(),
    abandonedAt: InstantSchema.nullable(),
    abandonReason: z.string().nullable(),
    settledAt: InstantSchema.nullable(),
    isArchived: z.boolean(),
    sortOrder: z.number().int(),
    createdAt: InstantSchema,
    updatedAt: InstantSchema,
  })
  .meta({ id: 'Todo' })
export type Todo = z.infer<typeof TodoSchema>

export const TodoListSchema = cursorPage(TodoSchema).meta({ id: 'TodoList' })
export type TodoList = z.infer<typeof TodoListSchema>

export const TodoQuadrantCountsSchema = z
  .object({
    'urgent-important': z.number().int().min(0),
    'important-not-urgent': z.number().int().min(0),
    'urgent-not-important': z.number().int().min(0),
    'not-important-not-urgent': z.number().int().min(0),
  })
  .meta({ id: 'TodoQuadrantCounts' })
export type TodoQuadrantCounts = z.infer<typeof TodoQuadrantCountsSchema>

export const TodoOverviewSchema = z
  .object({
    defaultGroupId: IdSchema,
    groups: z.array(TodoGroupSchema),
    tags: z.array(TodoTagSchema),
    counts: z.object({
      openTotal: z.number().int().min(0),
      overdueCount: z.number().int().min(0),
      doneRecentCount: z.number().int().min(0),
      abandonedRecentCount: z.number().int().min(0),
      archivedCount: z.number().int().min(0),
      quadrants: TodoQuadrantCountsSchema,
    }),
    /** 首屏仅预热默认展开的「默认待办」分组首批待办，其余面板折叠按需加载 */
    defaultGroupTodos: TodoListSchema,
  })
  .meta({ id: 'TodoOverview' })
export type TodoOverview = z.infer<typeof TodoOverviewSchema>

// ---------------------------------------------------------------------------
// 待办 CRUD 与排序入参
// ---------------------------------------------------------------------------

export const CreateTodoSchema = z
  .object({
    title: TitleSchema,
    note: NoteSchema.nullable().default(null),
    dueAt: InstantSchema.nullable().default(null),
    priority: TodoPrioritySchema.default('not-important-not-urgent'),
    tags: TodoTagsInputSchema.default([]),
    /** 指定已有分组；与 newGroupName 都不传时归入「默认待办」 */
    groupId: IdSchema.optional(),
    /** 表单中通过 Combobox 原地新建分组（与待办在同一事务内原子创建） */
    newGroupName: GroupNameSchema.optional(),
  })
  .meta({ id: 'CreateTodo' })
export type CreateTodo = z.infer<typeof CreateTodoSchema>
export type CreateTodoInput = z.input<typeof CreateTodoSchema>

/** 修改待办（含勾选完成、放弃、恢复、移动分组、改备注与标签）；向后兼容 done?: boolean */
export const UpdateTodoSchema = z
  .object({
    title: TitleSchema,
    note: NoteSchema.nullable(),
    dueAt: InstantSchema.nullable(),
    priority: TodoPrioritySchema,
    tags: TodoTagsInputSchema,
    groupId: IdSchema,
    newGroupName: GroupNameSchema,
    status: TodoLifecycleStatusSchema,
    abandonReason: AbandonReasonSchema.nullable(),
    /** 向后兼容旧勾选字段：done = true 等价于 status = 'done'，false 等价于 status = 'open' */
    done: z.boolean(),
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, { error: '没有要修改的内容' })
  .meta({ id: 'UpdateTodo' })
export type UpdateTodo = z.infer<typeof UpdateTodoSchema>

export const TodoOverviewQuerySchema = z.object({
  tag: z.string().trim().min(1).max(TODO_TAG_MAX_LENGTH).optional(),
})
export type TodoOverviewQuery = z.infer<typeof TodoOverviewQuerySchema>

export const TodoListQuerySchema = z.object({
  status: TodoStatusSchema.default('open'),
  groupId: IdSchema.optional(),
  priority: TodoPrioritySchema.optional(),
  tag: z.string().trim().min(1).max(TODO_TAG_MAX_LENGTH).optional(),
  keyword: z.string().trim().min(1).max(60).optional(),
  /** 仅 archived 时按原终态筛选：done | abandoned */
  archivedOutcome: z.enum(['done', 'abandoned']).optional(),
  from: LocalDateSchema.optional(),
  to: LocalDateSchema.optional(),
  /** 按截止日期（dueAt）范围筛选 YYYY-MM-DD */
  dueFrom: LocalDateSchema.optional(),
  dueTo: LocalDateSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type TodoListQuery = z.infer<typeof TodoListQuerySchema>

export const ReorderTodosSchema = z
  .object({
    groupId: IdSchema,
    todoIds: z.array(IdSchema).min(1).max(TODO_OPEN_LIMIT),
  })
  .meta({ id: 'ReorderTodos' })
export type ReorderTodos = z.infer<typeof ReorderTodosSchema>

// ---------------------------------------------------------------------------
// 分组 & 标签 CRUD
// ---------------------------------------------------------------------------

export const CreateTodoGroupSchema = z
  .object({
    name: GroupNameSchema,
  })
  .meta({ id: 'CreateTodoGroup' })
export type CreateTodoGroup = z.infer<typeof CreateTodoGroupSchema>

export const UpdateTodoGroupSchema = z
  .object({
    name: GroupNameSchema,
  })
  .meta({ id: 'UpdateTodoGroup' })
export type UpdateTodoGroup = z.infer<typeof UpdateTodoGroupSchema>

export const ReorderTodoGroupsSchema = z
  .object({
    groupIds: z.array(IdSchema).min(1).max(TODO_GROUP_LIMIT),
  })
  .meta({ id: 'ReorderTodoGroups' })
export type ReorderTodoGroups = z.infer<typeof ReorderTodoGroupsSchema>

export const TodoGroupListSchema = z
  .object({
    items: z.array(TodoGroupSchema),
  })
  .meta({ id: 'TodoGroupList' })
export type TodoGroupList = z.infer<typeof TodoGroupListSchema>

export const TodoTagListSchema = z
  .object({
    items: z.array(TodoTagSchema),
  })
  .meta({ id: 'TodoTagList' })
export type TodoTagList = z.infer<typeof TodoTagListSchema>

// ---------------------------------------------------------------------------
// 过程时间轴事件
// ---------------------------------------------------------------------------

export const TodoEventMetaSchema = z
  .object({
    fromGroup: z.string().optional(),
    toGroup: z.string().optional(),
    priority: TodoPrioritySchema.optional(),
    dueAt: InstantSchema.nullable().optional(),
    reason: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
  })
  .meta({ id: 'TodoEventMeta' })
export type TodoEventMeta = z.infer<typeof TodoEventMetaSchema>

export const TodoEventSchema = z
  .object({
    id: IdSchema,
    todoId: IdSchema.nullable(),
    eventType: TodoEventTypeSchema,
    todoTitle: z.string(),
    groupName: z.string(),
    meta: TodoEventMetaSchema,
    occurredAt: InstantSchema,
    /** 该事件关联的待办当前是否已满 30 天自动归档（用于过程页角标提示） */
    isArchived: z.boolean(),
  })
  .meta({ id: 'TodoEvent' })
export type TodoEvent = z.infer<typeof TodoEventSchema>

export const TodoEventListSchema = cursorPage(TodoEventSchema).meta({ id: 'TodoEventList' })
export type TodoEventList = z.infer<typeof TodoEventListSchema>

export const TodoEventListQuerySchema = z.object({
  todoId: IdSchema.optional(),
  eventType: TodoEventTypeSchema.optional(),
  from: LocalDateSchema.optional(),
  to: LocalDateSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})
export type TodoEventListQuery = z.infer<typeof TodoEventListQuerySchema>

// ---------------------------------------------------------------------------
// 路径参数
// ---------------------------------------------------------------------------

export const TodoIdParamSchema = z.object({ todoId: IdSchema })
export const TodoGroupIdParamSchema = z.object({ groupId: IdSchema })
export const TodoTagIdParamSchema = z.object({ tagId: IdSchema })
