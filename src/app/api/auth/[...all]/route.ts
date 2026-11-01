import { toNextJsHandler } from 'better-auth/next-js'
import { auth } from '@/server/auth/auth'

// Better Auth 处理器（auth.md 第 1 节）：/api/auth/* 的登录、会话、管理员操作
export const { GET, POST } = toNextJsHandler(auth)
