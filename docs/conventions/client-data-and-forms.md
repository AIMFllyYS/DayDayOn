# 客户端数据与表单规范

> 日期：2026-10-31 · 状态：初版。本文档由初始化时联网调研生成，条目未经实战验证，踩坑后按 [lessons 机制](../lessons/README.md)修订。
> 依据：[ADR-0012](../adr/0012-client-data.md)（TanStack Query 5）、[ADR-0009](../adr/0009-forms.md)（Base UI Form / Field + zod，不引入表单库）、[ADR-0013](../adr/0013-validation.md)（zod 4）、[ADR-0006](../adr/0006-toast.md)（Toast）。
> 官方资料（2026-10-31 抓取）：TanStack Query 的 Advanced Server Rendering 与 Query Options 指南、Base UI Form 文档、`@hono/zod-openapi` README（RPC 模式）。库的坑见 [lessons/tanstack-query.md](../lessons/tanstack-query.md)、[lessons/zod.md](../lessons/zod.md)、[lessons/base-ui.md](../lessons/base-ui.md)。

## 1. 谁来取数据

| 场景 | 做法 |
|---|---|
| 页面外壳、不依赖用户的内容 | Server Component，静态预渲染 |
| 依赖当前用户的数据（仪表盘、待办、打卡记录、额度） | 客户端组件用 TanStack Query 从 `/api/v1` 取，加载中显示 `Skeleton` |
| 首屏必须直出的用户数据（v0.1 只有主页仪表盘，实测慢了再加） | Server Component（在 `<Suspense>` 里）用同一个 `queryOptions` 预取，queryFn 直接调 service；用 `HydrationBoundary` 传给客户端 |

- Server Component 只负责预取，不渲染 TanStack Query 的结果，也不把结果传给其他组件（官方建议，否则客户端刷新后两边数据不同步）。
- 服务端预取直接调 service，浏览器请求 `/api/v1`。两边拿到的形状一致，是因为 service 返回的就是接口 DTO，并且 DTO 里的时间一律是 ISO 字符串，不是 `Date` 对象（[api-conventions.md](./api-conventions.md) 第 3、5 节）。
- 禁止用 Server Action 当 queryFn：从客户端调用时 Server Actions 串行执行，会让查询卡在加载状态（官方警告）。

## 2. src/lib/api/

```
src/lib/api/
├── index.ts           对业务代码的唯一出口：re-export useQuery、useMutation、useQueryClient 等，以及下面各文件
├── client.ts          类型化客户端：hono/client 的 hc，类型来自 `import type { AppType } from '@/server/api/app'`
├── fetcher.ts         统一处理：带 cookie、把错误体解析成 ApiError({ status, code, detail, fields })、401 跳登录页
├── keys.ts            query key 工厂，全项目唯一来源
├── query-client.ts    QueryClient 默认配置：服务端每个请求新建一个，浏览器端单例
├── provider.tsx       'use client'；QueryClientProvider，挂在 (app) 布局
├── error-messages.ts  错误码 → 中文文案
└── queries/<领域>.ts  每个领域的 queryOptions 与 mutation hooks
```

- 业务组件不直接 `fetch('/api/v1/…')`，也不直接 import `@tanstack/react-query`，一律从 `@/lib/api` 导入。
- `client.ts` 只用 `import type` 引用服务端的 `AppType`，不能引入任何服务端运行时代码。

## 3. Query key

- 全部由 `keys.ts` 生成，形如 `['goals', 'list', { range }]`、`['goals', 'detail', goalId]`、`['me', 'quota']`。
- 第一段是领域名。失效时按前缀：`queryClient.invalidateQueries({ queryKey: keys.goals.all })`。
- key 里不放 userId：一个浏览器同时只有一个登录用户，退出登录时调用 `queryClient.clear()`。
- 每个查询用 `queryOptions({ queryKey, queryFn })` 定义在 `queries/<领域>.ts`，组件、预取、失效都引用同一个定义。

## 4. 默认配置

- `staleTime`：30 秒（有服务端预取时必须大于 0，否则客户端会立刻重新请求）。
- 查询失败重试 1 次，4xx 不重试；mutation 不自动重试。
- `refetchOnWindowFocus` 保持默认开启：从别的 App 切回来时刷新打卡状态。

## 5. 写操作

- 用 `useMutation`。成功后按前缀失效相关查询。
- 打卡、勾选待办这类高频操作用乐观更新：`onMutate` 先取消相关查询、记下旧值、写入新值；`onError` 回滚并弹出错误提示；`onSettled` 失效刷新。
- 需要幂等键的写操作（api-conventions.md 第 9 节）：用户每次点击生成一个 `crypto.randomUUID()` 放进 mutation 变量，重试时复用同一个键。
- 错误处理：有 `fields` 的交给表单（第 6 节），其余按 `code` 弹出 Toast，文案只来自 `error-messages.ts`。未知 `code` 显示"出了点小状况，稍后再试试"。

## 6. 表单

- 结构：Base UI `Form` + 本项目的 `Field`（`src/components/ui/field.tsx`，M1 改为基于 Base UI Field）。不引入表单库。
- 取值：简单表单用 `onFormSubmit` 直接拿到值对象（它会自动 `preventDefault`）；需要联动的字段用普通 `useState` 受控。
- 校验：提交时用与接口相同的 zod schema `safeParse`，失败时把 `z.flattenError(result.error).fieldErrors` 交给 `Form` 的 `errors`。服务端返回 400 `VALIDATION_FAILED` 时，把响应里的 `fields` 同样交给 `errors`。字段改动后错误会自动清除。
- 校验时机：默认 `validationMode="onSubmit"`（提交后再改动会即时重新校验）；验证码、体重这类单字段可以用 `onBlur`。
- 数字：体重、时长用 `NumberField`（M1），界面单位是千克（一位小数）和分钟，提交前换算成接口单位（克、秒）。
- 提交中：按钮显示 loading 并禁止重复提交。抽屉里有未保存的修改时，关闭前用 `ConfirmDialog` 确认。
- 动态表单（自定义目标）：字段类型是固定清单（数字、文本、单选、多选、布尔、时长、评分）。由字段定义生成 zod schema（`buildSchema(fields)`），渲染和校验共用同一份定义，代码放在 `src/features/goal/`。

## 7. zod

- 统一写 `import * as z from 'zod'`。禁止 `import { z } from 'zod'`（同一组 schema 实测 90.8 KB 对 25.6 KB）。
- schema 放 `src/features/<领域>/schemas.ts`，前后端共用。命名 `XxxSchema`，类型 `type Xxx = z.infer<typeof XxxSchema>`。
- 错误文案写中文，因为同一份 schema 的错误会直接显示在表单里。
- 跨信任边界的数据一律先 parse：请求体、AI 输出、第三方响应、`localStorage`、URL 查询参数。

## 8. 提示消息

- 全局一个 toast 管理器（`Toast.createToastManager()`），`Toast.Provider` 放在根布局。
- 业务代码从 `@/components/ui/toast` 调用封装好的方法（成功、错误、promise 三态、带撤销），不直接用 Base UI 的 Toast 部件。具体 API 在 M1 的 Playbook 里定稿。

