import 'server-only'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from '../app'

/*
 * 领域路由（空壳，F1）。实现：D5。路径写完整路径，app.ts 统一挂在根上（PRD 7.5）。
 * 每个接口用 createRoute 定义，写全 request / responses（errorResponses(...)），
 * 领域路由默认 middleware: [requireUser, requireOnboarded] as const（另有说明的除外）。
 *
 *   GET    /todos              TodoListQuerySchema → TodoListSchema（open 不分页，done 游标分页）
 *   POST   /todos              CreateTodoSchema → 201 TodoSchema；409 TODO_LIMIT_REACHED
 *   PATCH  /todos/{todoId}     UpdateTodoSchema → TodoSchema；404 TODO_NOT_FOUND
 *   DELETE /todos/{todoId}     204
 */
export const todoRoutes = new OpenAPIHono<AppEnv>()
