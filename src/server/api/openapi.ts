import 'server-only'
import { app } from './app'

/*
 * OpenAPI 文档（api-conventions.md 第 4 节）：OpenAPI 3.1，scripts/dev/export-openapi.ts 写入
 * docs/specs/api/openapi.json；开发环境另由 src/app/api/v1/[[...route]]/route.ts 暴露 GET /api/v1/doc。
 * 生产环境不暴露文档接口。
 */

export const OPENAPI_DOC_PATH = '/api/v1/doc'

export function buildOpenApiDocument() {
  return app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: {
      title: 'DayDayOn API',
      version: '0.1.0',
      description:
        '业务接口 /api/v1。鉴权用 Better Auth 的会话 cookie（/api/auth/*，不在本文档内）。错误体统一为 { code, detail }。',
    },
  })
}
