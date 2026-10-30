import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 禁止 any：用 unknown + 类型收窄
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  globalIgnores([
    // eslint-config-next 的默认忽略项
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // 本项目追加
    'public/sw.js',
    'public/swe-worker-*.js',
    '.data/**',
    'artifact/**',
  ]),
])

export default eslintConfig
