import 'server-only'
import { createRoute, OpenAPIHono, type z } from '@hono/zod-openapi'
import {
  CreateTodoSchema,
  TodoIdParamSchema,
  TodoListQuerySchema,
  TodoListSchema,
  TodoSchema,
  UpdateTodoSchema,
} from '@/features/todo/schemas'
import { db } from '@/server/db/client'
import * as todos from '@/server/services/todos'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import { AUTH_ERRORS, errorResponses, IdempotencyHeadersSchema } from '../schemas'

/*
 * 待办接口（PRD 2.10、7.5，D5）。路径写完整路径，app.ts 统一挂在根上。
 *   GET    /todos              ?status=open|done（open 不分页，done 游标分页、最近 30 天）
 *   POST   /todos              201；409 TODO_LIMIT_REACHED；带 idempotency-key
 *   PATCH  /todos/{todoId}     修改 / 勾选；404 TODO_NOT_FOUND
 *   DELETE /todos/{todoId}     204；404 TODO_NOT_FOUND
 */

const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } })

const listRoute = createRoute({
  method: 'get',
  path: '/todos',
  tags: ['todo'],
  summary: '待办列表',
  middleware: [requireUser, requireOnboarded] as const,
  request: { query: TodoListQuerySchema },
  responses: {
    200: { content: json(TodoListSchema), description: '待办列表' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

const createTodoRoute = createRoute({
  method: 'post',
  path: '/todos',
  tags: ['todo'],
  summary: '新建待办',
  middleware: [requireUser, requireOnboarded, idempotency()] as const,
  request: {
    headers: IdempotencyHeadersSchema,
    body: { content: json(CreateTodoSchema), required: true },
  },
  responses: {
    201: { content: json(TodoSchema), description: '已创建' },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'TODO_LIMIT_REACHED',
      'IDEMPOTENCY_KEY_REUSED',
      'REQUEST_IN_PROGRESS',
    ),
  },
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/todos/{todoId}',
  tags: ['todo'],
  summary: '修改待办（含勾选）',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    params: TodoIdParamSchema,
    body: { content: json(UpdateTodoSchema), required: true },
  },
  responses: {
    200: { content: json(TodoSchema), description: '修改后的待办' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'TODO_NOT_FOUND', 'TODO_LIMIT_REACHED'),
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/todos/{todoId}',
  tags: ['todo'],
  summary: '删除待办',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: TodoIdParamSchema },
  responses: {
    204: { description: '已删除' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'TODO_NOT_FOUND'),
  },
})

export const todoRoutes = new OpenAPIHono<AppEnv>()
  .openapi(listRoute, async (c) => {
    const list = await todos.listTodos(db, c.get('user').id, c.req.valid('query'), new Date())
    return c.json(list, 200)
  })
  .openapi(createTodoRoute, async (c) => {
    const userId = c.get('user').id
    const input = c.req.valid('json')
    const todo = await db.transaction((tx) => todos.createTodo(tx, userId, input))
    return c.json(todo, 201)
  })
  .openapi(updateRoute, async (c) => {
    const userId = c.get('user').id
    const { todoId } = c.req.valid('param')
    const patch = c.req.valid('json')
    const todo = await db.transaction((tx) =>
      todos.updateTodo(tx, userId, todoId, patch, new Date()),
    )
    return c.json(todo, 200)
  })
  .openapi(deleteRoute, async (c) => {
    await todos.deleteTodo(db, c.get('user').id, c.req.valid('param').todoId)
    return c.body(null, 204)
  })
