# Code Review 检查清单

> AI 编码代理在 code review 或自我审查时逐项检查。

## 文件组织与职责

- 文件或函数是否职责混杂、存在明显的自然接缝却没有拆分（看职责，不看行数）
- 放置位置是否符合 colocation：单路由专用代码不应提升到 `src/features/`；跨路由领域模块不应散落在各路由里

## Next.js 16

- `'use client'` 是否只出现在叶子组件
- `params` / `searchParams` / `cookies()` / `headers()` 是否都 `await` 了
- 读会话的组件是否在 `<Suspense>` 里；layout 顶层是否 `await` 了会话
- 是否残留 `middleware.ts`

## 架构

- 业务写操作是否走 `/api/v1`，有没有用 Server Actions 写业务
- `src/server/services/` 是否 import 了 `next/*` 或 React
- 错误响应体是否为 `{ code, detail }`
- 请求体、AI 输出是否经过 zod 校验

## 安全与隐私

- 有没有把用户图片写入磁盘、数据库或日志（包括 base64 字符串）
- 日志里有没有邮箱验证码、token、密钥
- 新接口是否鉴权，是否只能访问当前用户自己的数据
- 新的写接口、AI 接口是否有限流
- 管理接口是否检查管理员身份

## AI 与额度

- 是否只使用 `deepseek-flash`
- 调用前是否预占额度、结束后是否结算、失败是否释放；是否带幂等键
- 金额是否用整数微元计算

## 部署

- 是否往 `public/` 放了大文件
- 新增环境变量是否同步写进 `.env.example`
- 数据库结构变更是否附带迁移文件

## _dev/ 隔离

- `src/app/_dev/` 页面是否有 production 守卫
- 正式代码是否引用了 `_dev/`
