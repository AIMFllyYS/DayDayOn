import 'server-only'
import { createRoute, OpenAPIHono, type z } from '@hono/zod-openapi'
import {
  CreateTodoGroupSchema,
  CreateTodoSchema,
  ReorderTodoGroupsSchema,
  ReorderTodosSchema,
  TodoEventListQuerySchema,
  TodoEventListSchema,
  TodoGroupIdParamSchema,
  TodoGroupListSchema,
  TodoGroupSchema,
  TodoIdParamSchema,
  TodoListQuerySchema,
  TodoListSchema,
  TodoOverviewQuerySchema,
  TodoOverviewSchema,
  TodoSchema,
  TodoTagIdParamSchema,
  TodoTagListSchema,
  UpdateTodoGroupSchema,
  UpdateTodoSchema,
} from '@/features/todo/schemas'
import { db } from '@/server/db/client'
import * as todos from '@/server/services/todos'
import type { AppEnv } from '../app'
import { requireOnboarded, requireUser } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'
import { AUTH_ERRORS, errorResponses, IdempotencyHeadersSchema, OkSchema } from '../schemas'

/*
 * 待办接口（Todo v2）。静态子路径注册在参数路径之前，避免被 {todoId}/{groupId} 截获：
 *   GET    /todos/overview             首屏轻量概览（分组目录+计数+默认待办首批 20 条）
 *   GET    /todos/events               过程时间轴游标分页（含已归档历史）
 *   POST   /todos/reorder              组内待办长按拖拽排序
 *   GET    /todos                      按需分页列表（open|overdue|done|abandoned|archived|quadrant）
 *   POST   /todos                      新建待办（支持原地新建分组，带幂等键）
 *   GET    /todos/{todoId}             单条待办完整详情（含 2000 字备注）
 *   PATCH  /todos/{todoId}             编辑 / 勾选完成 / 放弃 / 恢复 / 移组
 *   DELETE /todos/{todoId}             删除待办（留存 deleted 事件快照）
 *   GET    /todo-groups                分组列表与计数
 *   POST   /todo-groups                新建分组（带幂等键）
 *   POST   /todo-groups/reorder        分组长按拖拽排序
 *   PATCH  /todo-groups/{groupId}      重命名分组
 *   DELETE /todo-groups/{groupId}      删除分组（组内待办安全迁回「默认待办」）
 *   GET    /todo-tags                  标签词库列表
 *   DELETE /todo-tags/{tagId}          删除标签
 */

const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } })

const overviewRoute = createRoute({
  method: 'get',
  path: '/todos/overview',
  tags: ['todo'],
  summary: '待办首屏概览',
  middleware: [requireUser, requireOnboarded] as const,
  request: { query: TodoOverviewQuerySchema },
  responses: {
    200: { content: json(TodoOverviewSchema), description: '待办概览与默认分组首批条目' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

const eventsRoute = createRoute({
  method: 'get',
  path: '/todos/events',
  tags: ['todo'],
  summary: '待办过程时间轴',
  middleware: [requireUser, requireOnboarded] as const,
  request: { query: TodoEventListQuerySchema },
  responses: {
    200: { content: json(TodoEventListSchema), description: '按时间倒序的过程事件分页列表' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

const reorderTodosRoute = createRoute({
  method: 'post',
  path: '/todos/reorder',
  tags: ['todo'],
  summary: '组内待办排序',
  middleware: [requireUser, requireOnboarded] as const,
  request: { body: { content: json(ReorderTodosSchema), required: true } },
  responses: {
    200: { content: json(OkSchema), description: '已更新排序' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'TODO_GROUP_NOT_FOUND'),
  },
})

const listRoute = createRoute({
  method: 'get',
  path: '/todos',
  tags: ['todo'],
  summary: '待办分页列表',
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
      'TODO_GROUP_NOT_FOUND',
      'TODO_GROUP_LIMIT_REACHED',
      'IDEMPOTENCY_KEY_REUSED',
      'REQUEST_IN_PROGRESS',
    ),
  },
})

const detailRoute = createRoute({
  method: 'get',
  path: '/todos/{todoId}',
  tags: ['todo'],
  summary: '获取单条待办详情',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: TodoIdParamSchema },
  responses: {
    200: { content: json(TodoSchema), description: '单条待办详情' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'TODO_NOT_FOUND'),
  },
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/todos/{todoId}',
  tags: ['todo'],
  summary: '修改待办（含勾选完成、放弃、恢复、移动分组）',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    params: TodoIdParamSchema,
    body: { content: json(UpdateTodoSchema), required: true },
  },
  responses: {
    200: { content: json(TodoSchema), description: '修改后的待办' },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'TODO_NOT_FOUND',
      'TODO_LIMIT_REACHED',
      'TODO_GROUP_NOT_FOUND',
      'TODO_GROUP_LIMIT_REACHED',
    ),
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

const listGroupsRoute = createRoute({
  method: 'get',
  path: '/todo-groups',
  tags: ['todo'],
  summary: '待办分组列表',
  middleware: [requireUser, requireOnboarded] as const,
  responses: {
    200: { content: json(TodoGroupListSchema), description: '分组列表' },
    ...errorResponses(...AUTH_ERRORS),
  },
})

const createGroupRoute = createRoute({
  method: 'post',
  path: '/todo-groups',
  tags: ['todo'],
  summary: '新建待办分组',
  middleware: [requireUser, requireOnboarded, idempotency()] as const,
  request: {
    headers: IdempotencyHeadersSchema,
    body: { content: json(CreateTodoGroupSchema), required: true },
  },
  responses: {
    201: { content: json(TodoGroupSchema), description: '已创建分组' },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'TODO_GROUP_LIMIT_REACHED',
      'TODO_GROUP_NAME_EXISTS',
      'IDEMPOTENCY_KEY_REUSED',
      'REQUEST_IN_PROGRESS',
    ),
  },
})

const reorderGroupsRoute = createRoute({
  method: 'post',
  path: '/todo-groups/reorder',
  tags: ['todo'],
  summary: '待办分组排序',
  middleware: [requireUser, requireOnboarded] as const,
  request: { body: { content: json(ReorderTodoGroupsSchema), required: true } },
  responses: {
    200: { content: json(TodoGroupListSchema), description: '排序后的分组列表' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED'),
  },
})

const updateGroupRoute = createRoute({
  method: 'patch',
  path: '/todo-groups/{groupId}',
  tags: ['todo'],
  summary: '重命名待办分组',
  middleware: [requireUser, requireOnboarded] as const,
  request: {
    params: TodoGroupIdParamSchema,
    body: { content: json(UpdateTodoGroupSchema), required: true },
  },
  responses: {
    200: { content: json(TodoGroupSchema), description: '修改后的分组' },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'TODO_GROUP_NOT_FOUND',
      'TODO_GROUP_NAME_EXISTS',
      'TODO_DEFAULT_GROUP_PROTECTED',
    ),
  },
})

const deleteGroupRoute = createRoute({
  method: 'delete',
  path: '/todo-groups/{groupId}',
  tags: ['todo'],
  summary: '删除待办分组（组内待办迁回默认待办）',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: TodoGroupIdParamSchema },
  responses: {
    204: { description: '已删除分组' },
    ...errorResponses(
      ...AUTH_ERRORS,
      'VALIDATION_FAILED',
      'TODO_GROUP_NOT_FOUND',
      'TODO_DEFAULT_GROUP_PROTECTED',
    ),
  },
})

const listTagsRoute = createRoute({
  method: 'get',
  path: '/todo-tags',
  tags: ['todo'],
  summary: '待办标签列表',
  middleware: [requireUser, requireOnboarded] as const,
  responses: {
    200: { content: json(TodoTagListSchema), description: '标签列表' },
    ...errorResponses(...AUTH_ERRORS),
  },
})

const deleteTagRoute = createRoute({
  method: 'delete',
  path: '/todo-tags/{tagId}',
  tags: ['todo'],
  summary: '删除待办标签',
  middleware: [requireUser, requireOnboarded] as const,
  request: { params: TodoTagIdParamSchema },
  responses: {
    204: { description: '已删除标签' },
    ...errorResponses(...AUTH_ERRORS, 'VALIDATION_FAILED', 'TODO_TAG_NOT_FOUND'),
  },
})

export const todoRoutes = new OpenAPIHono<AppEnv>()
  .openapi(overviewRoute, async (c) => {
    const overview = await todos.getTodoOverview(
      db,
      c.get('user').id,
      new Date(),
      c.req.valid('query'),
    )
    return c.json(overview, 200)
  })
  .openapi(eventsRoute, async (c) => {
    const list = await todos.listTodoEvents(db, c.get('user').id, c.req.valid('query'), new Date())
    return c.json(list, 200)
  })
  .openapi(reorderTodosRoute, async (c) => {
    const userId = c.get('user').id
    const input = c.req.valid('json')
    const res = await db.transaction((tx) => todos.reorderTodos(tx, userId, input, new Date()))
    return c.json(res, 200)
  })
  .openapi(listRoute, async (c) => {
    const list = await todos.listTodos(db, c.get('user').id, c.req.valid('query'), new Date())
    return c.json(list, 200)
  })
  .openapi(createTodoRoute, async (c) => {
    const userId = c.get('user').id
    const input = c.req.valid('json')
    const todo = await db.transaction((tx) => todos.createTodo(tx, userId, input, new Date()))
    return c.json(todo, 201)
  })
  .openapi(detailRoute, async (c) => {
    const todo = await todos.getTodoById(
      db,
      c.get('user').id,
      c.req.valid('param').todoId,
      new Date(),
    )
    return c.json(todo, 200)
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
    const userId = c.get('user').id
    const { todoId } = c.req.valid('param')
    await db.transaction((tx) => todos.deleteTodo(tx, userId, todoId, new Date()))
    return c.body(null, 204)
  })
  .openapi(listGroupsRoute, async (c) => {
    const list = await todos.listTodoGroups(db, c.get('user').id, new Date())
    return c.json(list, 200)
  })
  .openapi(createGroupRoute, async (c) => {
    const userId = c.get('user').id
    const input = c.req.valid('json')
    const group = await db.transaction((tx) => todos.createTodoGroup(tx, userId, input))
    return c.json(group, 201)
  })
  .openapi(reorderGroupsRoute, async (c) => {
    const userId = c.get('user').id
    const input = c.req.valid('json')
    const list = await db.transaction((tx) =>
      todos.reorderTodoGroups(tx, userId, input, new Date()),
    )
    return c.json(list, 200)
  })
  .openapi(updateGroupRoute, async (c) => {
    const userId = c.get('user').id
    const { groupId } = c.req.valid('param')
    const input = c.req.valid('json')
    const group = await db.transaction((tx) =>
      todos.updateTodoGroup(tx, userId, groupId, input, new Date()),
    )
    return c.json(group, 200)
  })
  .openapi(deleteGroupRoute, async (c) => {
    const userId = c.get('user').id
    const { groupId } = c.req.valid('param')
    await db.transaction((tx) => todos.deleteTodoGroup(tx, userId, groupId, new Date()))
    return c.body(null, 204)
  })
  .openapi(listTagsRoute, async (c) => {
    const list = await todos.listTodoTags(db, c.get('user').id)
    return c.json(list, 200)
  })
  .openapi(deleteTagRoute, async (c) => {
    const userId = c.get('user').id
    const { tagId } = c.req.valid('param')
    await db.transaction((tx) => todos.deleteTodoTag(tx, userId, tagId))
    return c.body(null, 204)
  })
