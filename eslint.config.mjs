import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// ---------------------------------------------------------------------------
// 导入禁令（no-restricted-imports）
// 依据：docs/libraries.md「互斥禁令」与各封装层入口、ui-primitives.md 第 9 节、
// api-conventions.md 第 14 节、ai-and-quota.md 第 11 节、database.md 第 10 节。
//
// no-restricted-imports 在多个配置对象之间不会合并，文件命中的最后一个对象整体生效。
// 所以下面不手写覆盖：每条限制声明 allow（豁免目录）或 only（只在这些目录生效），
// 再按目录生成"完整的"选项集，越具体的目录排在越后面。
// 新增限制只改 BANNED 或 RESTRICTIONS，不要在下方 defineConfig 里另写 no-restricted-imports。
// ---------------------------------------------------------------------------

/** 互斥禁令：全项目禁止 import。每项对应 libraries.md 里的一条 */
const BANNED = [
  [
    '图标用自研 Icon（src/components/ui/icon.tsx）',
    ['lucide-react', '@heroicons/*', 'react-icons', 'react-icons/*', '@tabler/icons-react'],
  ],
  [
    '样式只用 Tailwind + globals.css token',
    ['styled-components', '@emotion/*', 'unocss', '@unocss/*'],
  ],
  ['className 用 src/lib/cn.ts', ['clsx', 'classnames', 'tailwind-merge']],
  [
    '交互原语只用 Base UI（经 src/components/ui/）',
    [
      'radix-ui',
      '@radix-ui/*',
      'react-aria-components',
      'react-aria',
      '@headlessui/*',
      '@ark-ui/*',
      'vaul',
      'cmdk',
    ],
  ],
  [
    '动效用 CSS 预设与 <ViewTransition>',
    [
      'motion',
      'motion/*',
      'framer-motion',
      'react-spring',
      '@react-spring/*',
      'gsap',
      'gsap/*',
      'animejs',
      '@formkit/auto-animate',
      '@formkit/auto-animate/*',
      'lottie-*',
      '@lottiefiles/*',
      '@rive-app/*',
    ],
  ],
  [
    '提示消息用 Base UI Toast（src/components/ui/toast.tsx）',
    ['sonner', 'react-hot-toast', 'react-toastify'],
  ],
  [
    '日历用 react-day-picker（只经 calendar.tsx）',
    ['react-datepicker', '@mui/x-date-pickers', '@mui/x-date-pickers/*'],
  ],
  [
    '日期计算用 date-fns + @date-fns/tz（只经 src/lib/time/）',
    [
      'dayjs',
      'dayjs/*',
      'moment',
      'moment-timezone',
      'luxon',
      'temporal-polyfill',
      '@js-temporal/polyfill',
    ],
  ],
  [
    '表单用 Base UI Form / Field + zod',
    ['react-hook-form', '@hookform/*', '@tanstack/react-form', 'formik', '@conform-to/*'],
  ],
  [
    '图表用自研 SVG + d3-shape（只经 src/components/charts/）',
    [
      'recharts',
      'echarts',
      'echarts-for-react',
      'chart.js',
      'react-chartjs-2',
      '@visx/*',
      '@nivo/*',
      'd3',
      'd3-scale',
    ],
  ],
  [
    '图片压缩用原生 canvas；服务端不转码用户图片',
    ['browser-image-compression', 'compressorjs', 'sharp'],
  ],
  ['客户端数据请求用 TanStack Query（只经 src/lib/api/）', ['swr', 'swr/*', 'axios', 'ky']],
  ['校验用 zod', ['valibot', 'yup', 'joi', 'arktype']],
  ['鉴权用 Better Auth', ['next-auth', 'next-auth/*', '@auth/*', 'lucia', 'iron-session', 'jose']],
  [
    '数据访问用 Drizzle + pg',
    ['prisma', '@prisma/*', 'kysely', 'postgres', 'typeorm', 'sequelize'],
  ],
  [
    '接口层用 Hono + @hono/zod-openapi',
    ['@orpc/*', '@trpc/*', 'express', 'fastify', '@hono/node-server', '@hono/vercel'],
  ],
  [
    '发信用 nodemailer，模板写成 HTML 字符串函数',
    ['@alicloud/*', 'mjml', 'react-email', '@react-email/*'],
  ],
  [
    'AI 只用 deepseek-flash（@ai-sdk/deepseek）',
    ['@ai-sdk/*', '!@ai-sdk/deepseek', '!@ai-sdk/react'],
  ],
  ['测试用 vitest', ['jest', '@jest/*', 'mocha']],
  [
    'PWA 用 app/manifest.ts + 手写 public/sw.js',
    ['serwist', '@serwist/*', 'next-pwa', '@ducanh2912/next-pwa', 'workbox-*'],
  ],
  ['定时任务用周期键懒计算 + 系统 cron', ['node-cron', 'croner', 'pg-boss', 'bullmq']],
  ['限流计数存 PostgreSQL，不用 Redis', ['ioredis', 'redis']],
  [
    '禁止腾讯云服务',
    ['tencentcloud-sdk-nodejs', 'tencentcloud-sdk-nodejs-*', 'cos-nodejs-sdk-v5', 'cos-js-sdk-v5'],
  ],
  [
    '人机验证用 @marsidev/react-turnstile（只经 src/components/ui/turnstile.tsx）',
    ['react-turnstile', 'react-google-recaptcha', '@hcaptcha/*'],
  ],
]

/**
 * 把包名列表转成锚定的正则：每项匹配包本身及其子路径，`*` 匹配一段（不跨 `/`），
 * `!` 开头的项是例外。不用 gitignore 风格的 group：它会匹配任意路径段，
 * 比如 'motion' 会误伤 '@/lib/motion'，'ai' 会误伤 './ai'。
 */
function pkgRegex(names) {
  const toSource = (name) => name.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')
  const include = names.filter((n) => !n.startsWith('!')).map(toSource)
  const exclude = names.filter((n) => n.startsWith('!')).map((n) => toSource(n.slice(1)))
  const guard = exclude.length > 0 ? `(?!(?:${exclude.join('|')})(?:/|$))` : ''
  return `^${guard}(?:${include.join('|')})(?:/.*)?$`
}

const pkgMessage = (pkg, where) =>
  `${pkg} 只能在 ${where} 里 import（见 docs/libraries.md 封装层入口）`

/**
 * 每条限制：paths / patterns 是 no-restricted-imports 的原生选项；
 * allow = 这些目录豁免；only = 只在这些目录生效。两者都不写就是全局生效。
 */
const RESTRICTIONS = [
  ...BANNED.map(([reason, group]) => ({
    patterns: [{ regex: pkgRegex(group), message: `docs/libraries.md 互斥禁令：${reason}` }],
  })),
  {
    paths: [
      {
        name: '@base-ui/react',
        message: '只用子路径导入，如 @base-ui/react/drawer（ui-primitives.md）',
      },
    ],
  },
  {
    allow: ['src/components/ui/**'],
    patterns: [
      {
        regex: pkgRegex(['@base-ui/react/*']),
        message: pkgMessage('@base-ui/react', 'src/components/ui/'),
      },
    ],
  },
  {
    allow: ['src/components/ui/calendar.tsx'],
    patterns: [
      {
        regex: pkgRegex(['react-day-picker', 'react-day-picker/*']),
        message: pkgMessage('react-day-picker', 'src/components/ui/calendar.tsx'),
      },
    ],
  },
  {
    allow: ['src/components/ui/turnstile.tsx'],
    patterns: [
      {
        regex: pkgRegex(['@marsidev/react-turnstile', '@marsidev/react-turnstile/*']),
        message: pkgMessage('@marsidev/react-turnstile', 'src/components/ui/turnstile.tsx'),
      },
    ],
  },
  {
    allow: ['src/components/charts/**'],
    patterns: [
      {
        regex: pkgRegex(['d3-shape', 'd3-shape/*']),
        message: pkgMessage('d3-shape', 'src/components/charts/'),
      },
    ],
  },
  {
    allow: ['src/server/**', 'drizzle.config.ts', 'scripts/**'],
    patterns: [
      {
        regex: pkgRegex(['drizzle-orm', 'drizzle-orm/*', 'drizzle-kit', 'pg', 'pg/*']),
        message: pkgMessage('drizzle-orm / pg', 'src/server/'),
      },
    ],
  },
  {
    allow: ['src/server/api/**', 'src/app/api/v1/**', 'src/lib/api/client.ts'],
    patterns: [
      {
        regex: pkgRegex(['hono', 'hono/*', '@hono/zod-openapi', '@hono/zod-openapi/*']),
        message: pkgMessage(
          'hono / @hono/zod-openapi',
          'src/server/api/、src/app/api/v1/、src/lib/api/client.ts',
        ),
      },
    ],
  },
  {
    allow: ['src/server/api/**'],
    paths: [
      {
        name: '@hono/zod-openapi',
        importNames: ['z'],
        message:
          "import { z } from '@hono/zod-openapi' 只在 src/server/api/；其他地方用 import * as z from 'zod'",
      },
    ],
  },
  {
    allow: ['src/server/ai/**', 'src/features/agent/**'],
    patterns: [
      {
        regex: pkgRegex(['ai', 'ai/*']),
        message: pkgMessage(
          'ai',
          'src/server/ai/ 与 src/features/agent/（前端只 import ai 的类型与 DefaultChatTransport）',
        ),
      },
    ],
  },
  {
    allow: ['src/server/ai/**'],
    patterns: [
      {
        regex: pkgRegex(['@ai-sdk/deepseek', '@ai-sdk/deepseek/*']),
        message: pkgMessage('@ai-sdk/deepseek', 'src/server/ai/'),
      },
    ],
  },
  {
    paths: [
      {
        name: 'ai',
        importNames: ['uploadFile'],
        message:
          '禁止 uploadFile：DeepSeek Files API 会永久保存用户图片，只用内联 file part（ADR-0002）',
      },
    ],
  },
  {
    allow: ['src/features/agent/**'],
    patterns: [
      {
        regex: pkgRegex(['@ai-sdk/react', '@ai-sdk/react/*']),
        message: pkgMessage('@ai-sdk/react', 'src/features/agent/'),
      },
    ],
  },
  {
    only: ['src/server/ai/**'],
    paths: ['fs', 'node:fs', 'fs/promises', 'node:fs/promises'].map((name) => ({
      name,
      message: '用户图片永不落盘：src/server/ai/ 禁止 import 文件系统模块（ADR-0002）',
    })),
  },
  {
    allow: ['src/server/auth/**', 'src/lib/auth-client.ts', 'src/app/api/auth/**'],
    patterns: [
      {
        regex: pkgRegex(['better-auth', 'better-auth/*']),
        message: pkgMessage(
          'better-auth',
          'src/server/auth/、src/lib/auth-client.ts、src/app/api/auth/',
        ),
      },
    ],
  },
  {
    allow: ['src/lib/api/**'],
    patterns: [
      {
        regex: pkgRegex(['@tanstack/react-query', '@tanstack/react-query/*']),
        message: pkgMessage('@tanstack/react-query', 'src/lib/api/'),
      },
    ],
  },
  {
    allow: ['src/lib/time/**'],
    patterns: [
      {
        regex: pkgRegex(['date-fns', 'date-fns/*', '@date-fns/tz', '@date-fns/tz/*']),
        message: pkgMessage('date-fns / @date-fns/tz', 'src/lib/time/'),
      },
    ],
  },
  {
    allow: ['src/server/mail/**'],
    patterns: [
      {
        regex: pkgRegex(['nodemailer', 'nodemailer/*']),
        message: pkgMessage('nodemailer', 'src/server/mail/'),
      },
    ],
  },
  // zod 的 `import { z }` 禁令不放这里：paths.importNames 会把 `import * as z` 也一并报错，
  // 改在下方 no-restricted-syntax 里只匹配具名 / 默认导入。
  {
    allow: ['src/app/dev/**'],
    patterns: [
      {
        regex: pkgRegex(['@/app/dev', '@/app/dev/*']),
        message: '正式代码不能引用 src/app/dev/（调试区）',
      },
    ],
  },
]

/** 去掉末尾的 `/**`，得到目录前缀（文件路径原样返回） */
const stripGlob = (glob) => glob.replace(/\/\*\*$/, '')

/** glob a 是否覆盖 glob b：相同，或 a 是目录且 b 在其中 */
const covers = (a, b) =>
  a === b || (a.endsWith('/**') && stripGlob(b).startsWith(`${stripGlob(a)}/`))

/** 某个目录（zone）上生效的完整选项集；zone 为 null 表示全局默认 */
function optionsFor(zone) {
  const paths = []
  const patterns = []
  for (const r of RESTRICTIONS) {
    if (zone === null) {
      if (r.only) continue
    } else {
      if ((r.allow ?? []).some((a) => covers(a, zone))) continue
      if (r.only && !r.only.some((o) => covers(o, zone))) continue
    }
    if (r.paths) paths.push(...r.paths)
    if (r.patterns) patterns.push(...r.patterns)
  }
  return { paths, patterns }
}

// 所有出现过的目录。重叠的目录一定是嵌套关系，按前缀长度排序后，越具体的越靠后、越优先
const zones = [
  ...new Set(RESTRICTIONS.flatMap((r) => [...(r.allow ?? []), ...(r.only ?? [])])),
].sort((a, b) => stripGlob(a).length - stripGlob(b).length)

const restrictedImports = [
  {
    name: 'daydayon/restricted-imports',
    rules: { 'no-restricted-imports': ['error', optionsFor(null)] },
  },
  ...zones.map((zone) => ({
    name: `daydayon/restricted-imports:${zone}`,
    files: [zone],
    rules: { 'no-restricted-imports': ['error', optionsFor(zone)] },
  })),
]

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 禁止 any：用 unknown + 类型收窄
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // PM2 只能加载 CommonJS 配置，这类文件允许 require()
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  ...restrictedImports,
  {
    // 全项目只有这一处配置 no-restricted-syntax；要加规则就加在这个数组里
    name: 'daydayon/restricted-syntax',
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportDeclaration[source.value=/^zod(\\u002F|$)/] > :matches(ImportSpecifier[imported.name='z'], ImportDefaultSpecifier)",
          message: "统一写 import * as z from 'zod'（libraries.md：命名导入体积大 3 倍）",
        },
        {
          selector:
            "ExportNamedDeclaration[source.value=/^zod(\\u002F|$)/] > ExportSpecifier[local.name='z']",
          message: "统一写 import * as z from 'zod'（libraries.md：命名导入体积大 3 倍）",
        },
      ],
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
    '.claude/**',
    'wf_*/**',
    '.worktrees/**',
    'docs/designs/library-showcase/**',
  ]),
])

export default eslintConfig
