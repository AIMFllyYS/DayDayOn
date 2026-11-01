// 导出 OpenAPI 文档：pnpm openapi:export → docs/specs/api/openapi.json（api-conventions.md 第 4、14 节）
// 不连数据库、不读 .env：只加载路由定义并生成文档。
import { mkdirSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// 服务端模块顶部的 `import 'server-only'` 由 Next 内部处理，项目没装这个包；
// 脚本里解析到 Vitest 用的同一个空模块（tsx 按 CJS 加载，不能用 data: URL）
const SERVER_ONLY_STUB = pathToFileURL(path.resolve('src/test/server-only-stub.ts')).href
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: SERVER_ONLY_STUB, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})

const OUTPUT = path.resolve('docs/specs/api/openapi.json')

async function main(): Promise<void> {
  const { buildOpenApiDocument } = await import('../../src/server/api/openapi')
  const document = buildOpenApiDocument()
  mkdirSync(path.dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`)
  const paths = Object.keys(document.paths ?? {}).length
  console.log(`[openapi:export] 已写入 ${path.relative(process.cwd(), OUTPUT)}（${paths} 个路径）`)
}

main().catch((error: unknown) => {
  console.error('[openapi:export] 失败', error)
  process.exitCode = 1
})
