# Next.js 16.4 关键模式与陷阱

> 本文档是 `AGENTS.md` 中 Next.js 规则的完整版。写路由、配置、数据读取代码前先读本文。
> 权威来源是当前安装版本自带的文档：`node_modules/next/dist/docs/`。本文与它冲突时以它为准，并修正本文。

## proxy.ts 替代 middleware.ts

- 文件名是 `src/proxy.ts`，导出 `proxy` 函数；`middleware.ts` 已废弃
- 运行时固定为 `nodejs`
- 配置项 `skipMiddlewareUrlNormalize` 已改名 `skipProxyUrlNormalize`

## Async Request APIs

`params`、`searchParams`、`cookies()`、`headers()`、`draftMode()` 都返回 Promise，必须 `await`：

```ts
export default async function Page({ params }: PageProps<'/goals/[id]'>) {
  const { id } = await params
}
```

`PageProps`、`LayoutProps`、`RouteContext` 是 Next 生成的全局类型，所以 `pnpm typecheck` 会先运行 `next typegen`。

## Cache Components（本项目开启）

`next.config.ts` 里 `cacheComponents: true` 是 create-next-app 16.4 的默认值，本项目保持开启。核心规则：

- 页面中**不读请求数据**的部分会预渲染成静态外壳，首屏立即出现。
- **读 `cookies()` / `headers()` / 会话的组件必须放在 `<Suspense>` 里**，否则构建报错。
- **不要在 layout 顶层 `await` 会话**：那会让整个子树都等这个请求。把读会话的部分做成组件，放进 Suspense。
- 需要缓存的数据用 `'use cache'`；依赖会话的数据先取出 `userId` 再传给 `'use cache'` 函数，或用 `'use cache: private'`。
- 非 GET 请求和读了请求数据的 Route Handler 是动态的；不读请求数据但又必须每次执行的（如健康检查）调用 `await connection()`。

参考：`node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`。

## standalone 输出（本项目部署方式）

- `output: 'standalone'` 生成 `.next/standalone/`，包含 `server.js` 和精简过的 `node_modules`。
- **`public/` 和 `.next/static/` 不会自动拷进去**，打包制品时要手动复制到 `standalone/public` 和 `standalone/.next/static`。
- 运行时用 `PORT` 和 `HOSTNAME` 环境变量指定监听地址（本项目只监听 `127.0.0.1`）。
- **制品必须在 Linux 上构建**（GitHub Actions）。`sharp` 等原生依赖与平台绑定；Windows 上的 standalone 还可能因为目录链接退化而无法搬移。

## Turbopack

- `next dev` 和 `next build` 默认使用 Turbopack，不需要 `--turbopack`
- 有自定义 `webpack` 配置时构建会失败
- Tailwind 通过 `turbopack.rules` 里的 `@tailwindcss/turbopack` loader 处理，不使用 PostCSS 配置

## React Compiler

- `reactCompiler: true` 已开启，一般不需要手写 `useMemo` / `useCallback`
- 个别库与编译器配合有问题时，在对应组件里加 `'use no memo'` 并注释原因

## 其他约定

- `error.tsx` 必须是 Client Component（`'use client'`）
- `route.ts` 与 `page.tsx` 不能放在同一目录
- 业务接口不直接写 Route Handler：`/api/v1/[[...route]]/route.ts` 只把请求转给 Hono（[api-conventions.md](./api-conventions.md)）；`/api/auth/[...all]` 挂 Better Auth（[auth.md](./auth.md)）
- 用 `metadata` / `generateMetadata()` 管理页面元信息；`viewport` 单独导出
- `next lint` 已移除，用 `eslint .`
- `next dev` 会自动在 `AGENTS.md` 顶部写入 Next 的提示块，保留它即可
