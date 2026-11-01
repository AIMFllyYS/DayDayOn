import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// 规范见 docs/conventions/testing.md 第 4 节
export default defineConfig({
  resolve: {
    // Vite 8 内置：按 tsconfig.json 的 paths 解析 `@/`，不需要 vite-tsconfig-paths
    tsconfigPaths: true,
    alias: {
      // 项目没有安装 server-only 包（Next 内部处理），测试里指向空模块
      'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
})
