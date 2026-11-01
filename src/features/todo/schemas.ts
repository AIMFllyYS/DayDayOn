import * as z from 'zod'
import { cursorPage, IdSchema, InstantSchema } from '@/features/shared/schemas'

/*
 * 待办契约（PRD 2.10、7.5）。D5 实现。
 */

export const TODO_TITLE_MAX = 60
export const TODO_OPEN_LIMIT = 500

export const TodoPrioritySchema = z.enum(['normal', 'important']).meta({ id: 'TodoPriority' })
export type TodoPriority = z.infer<typeof TodoPrioritySchema>

const TitleSchema = z
  .string()
  .trim()
  .min(1, { error: '写点什么吧' })
  .max(TODO_TITLE_MAX, { error: `最多 ${TODO_TITLE_MAX} 个字` })

export const TodoSchema = z
  .object({
    id: IdSchema,
    title: z.string(),
    /** DDL 时刻；前端 datetime-local 用 combineLocal() 转换 */
    dueAt: InstantSchema.nullable(),
    priority: TodoPrioritySchema,
    doneAt: InstantSchema.nullable(),
    createdAt: InstantSchema,
    updatedAt: InstantSchema,
  })
  .meta({ id: 'Todo' })
export type Todo = z.infer<typeof TodoSchema>

export const CreateTodoSchema = z
  .object({
    title: TitleSchema,
    dueAt: InstantSchema.nullable().default(null),
    priority: TodoPrioritySchema.default('normal'),
  })
  .meta({ id: 'CreateTodo' })
export type CreateTodo = z.infer<typeof CreateTodoSchema>
export type CreateTodoInput = z.input<typeof CreateTodoSchema>

/** 勾选：done = true 写 doneAt = now；false 清空 */
export const UpdateTodoSchema = z
  .object({
    title: TitleSchema,
    dueAt: InstantSchema.nullable(),
    priority: TodoPrioritySchema,
    done: z.boolean(),
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, { error: '没有要修改的内容' })
  .meta({ id: 'UpdateTodo' })
export type UpdateTodo = z.infer<typeof UpdateTodoSchema>

export const TodoStatusSchema = z.enum(['open', 'done']).meta({ id: 'TodoStatus' })
export type TodoStatus = z.infer<typeof TodoStatusSchema>

/** GET /todos?status=open|done；done 游标分页、只返回最近 30 天 */
export const TodoListQuerySchema = z.object({
  status: TodoStatusSchema.default('open'),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type TodoListQuery = z.infer<typeof TodoListQuerySchema>

/** open 不分页（上限 500，按 DDL 升序、无 DDL 排后），nextCursor 恒为 null */
export const TodoListSchema = cursorPage(TodoSchema).meta({ id: 'TodoList' })
export type TodoList = z.infer<typeof TodoListSchema>

export const TodoIdParamSchema = z.object({ todoId: IdSchema })
