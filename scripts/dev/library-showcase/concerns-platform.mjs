// 组件库对齐（demo-init Phase 3）：数据请求、校验与业务基础设施关注点的调研结论。
// 规则同 concerns-frontend.mjs：事实只来自 2026-10-31 本次会话的抓取与实测。

export const platform = [
  {
    no: 9,
    slug: 'client-data',
    title: '客户端数据请求',
    group: 'C 业务基础设施',
    adr: '0012',
    needs: [
      '首屏数据由 Server Component 直接调 service 输出',
      '打卡、待办勾选：先更新界面，失败回滚',
      '写入后刷新相关列表和统计',
      'AI 识别过程中轮询或流式更新状态',
    ],
    layer:
      '首屏用 RSC；交互后的读写用一个客户端缓存库。只用 RSC + router.refresh() 做不到乐观更新和局部回滚。',
    candidates: [
      {
        name: 'TanStack Query 5',
        pkg: '@tanstack/react-query',
        verdict: 'pick',
        size: { case: '@tanstack/react-query' },
        caps: [
          'useMutation 的 onMutate / onError 用于乐观更新与回滚',
          '按 query key 失效刷新',
          '以后做离线草稿时可以接持久化',
        ],
        fit: '本项目写操作多，正好用到它最强的部分。',
      },
      {
        name: 'SWR',
        pkg: 'swr',
        verdict: 'alt',
        size: { case: 'swr' },
        caps: ['以读取为主的缓存，useSWRMutation 处理写入'],
        fit: '更小，但写入和回滚的工具比 TanStack Query 少。',
      },
      {
        name: '只用 RSC + router.refresh()',
        kind: 'native',
        verdict: 'no',
        sizeNote: '0 KB',
        caps: ['不加库'],
        fit: '每次写入都要重新拉整页的 RSC 数据，没有乐观更新。',
      },
    ],
    decision: {
      owner: 'TanStack Query',
      version: '5.105.0',
      wrapper: 'src/lib/api/（QueryClient、类型化的接口客户端、query key 工厂）',
      rules: [
        'query key 统一由 src/lib/api/keys.ts 生成',
        '业务组件不直接 fetch /api/v1，一律经 src/lib/api/',
      ],
      rejected: [
        ['SWR', '写入与回滚工具较少'],
        ['只用 RSC', '没有乐观更新'],
      ],
      cost: '客户端多约 10 KB。',
      review: ['做离线草稿（v0.2）时评估持久化方案'],
    },
    sources: [['TanStack Query', 'https://tanstack.com/query/latest']],
  },
  {
    no: 10,
    slug: 'validation',
    title: '数据校验',
    group: 'C 业务基础设施',
    adr: '0013',
    needs: ['接口入参与出参', 'AI 结构化输出', '环境变量', '表单', '自定义目标的字段 schema'],
    layer: '服务端和浏览器共用一个 schema 库。',
    candidates: [
      {
        name: 'zod 4',
        pkg: 'zod',
        verdict: 'pick',
        size: {
          detail: 'zod: import * as z',
          also: [
            ['import { z } from "zod"', 'zod: import { z }', 'detail'],
            ['zod/mini', 'zod/mini'],
          ],
        },
        caps: [
          'AI SDK、Better Auth（直接依赖 zod）、@hono/zod-openapi（peer zod ^4）都以 zod 为中心',
          '0 个依赖',
        ],
        warn: [
          '**导入写法决定体积**：同样的 schema，`import * as z from "zod"` 实测 25.6 KB，`import { z } from "zod"` 实测 90.8 KB',
        ],
        fit: '生态一致，一个 schema 库贯穿前后端。',
      },
      {
        name: 'Valibot',
        pkg: 'valibot',
        verdict: 'alt',
        size: { case: 'valibot' },
        caps: ['函数式、极小'],
        fit: '体积最小，但其他依赖都用 zod，会变成两个校验库。',
      },
      {
        name: 'ArkType',
        pkg: 'arktype',
        verdict: 'no',
        caps: ['类型语法式 schema'],
        fit: '生态不匹配。',
      },
    ],
    decision: {
      owner: 'zod',
      version: '4.6.7',
      wrapper: '无封装层（工具库豁免）；schema 放在 src/features/<领域>/schemas.ts',
      rules: [
        '统一写 `import * as z from "zod"`；ESLint 用 no-restricted-syntax 禁止 `import { z } from "zod"`',
        '浏览器端体积吃紧时，纯客户端 schema 可以改用 zod/mini',
      ],
      rejected: [
        ['Valibot', '和生态里的 zod 重复'],
        ['ArkType', '生态不匹配'],
      ],
      cost: '客户端校验约 25 KB。',
      review: ['客户端 JS 超预算时（评估 zod/mini）'],
    },
    sources: [['zod 文档', 'https://zod.dev']],
  },
  {
    no: 11,
    slug: 'auth',
    title: '鉴权与会话',
    group: 'C 业务基础设施',
    adr: '0014',
    needs: [
      '邮箱验证码登录，只接受白名单邮箱（ADR-0002 第 3 节）',
      '会话 cookie',
      '管理员角色 + 两步验证',
      '封号并吊销全部会话',
      'IP 限流（ADR-0002 第 6 节）',
      '以后 APK / Kotlin 用 bearer token',
    ],
    layer: '自托管的成熟鉴权库。登录与会话是安全红线，禁止自研（ADR-0003）。',
    candidates: [
      {
        name: 'Better Auth 1.7',
        pkg: 'better-auth',
        verdict: 'pick',
        caps: [
          'emailOTP 插件：验证码登录、未注册自动注册、allowedAttempts 限制错误次数',
          'admin 插件：角色、封禁 / 解封、吊销会话',
          'twoFactor 插件；内置限流，可存数据库（rateLimit.storage = "database"），可按路径设规则',
          'advanced.ipAddress.ipAddressHeaders 可只信任 x-real-ip，和本项目 Nginx 配置一致',
          '匿名遥测默认关闭',
          'Auth.js 已由 Better Auth 团队维护，Auth.js 官方建议新项目用 Better Auth',
        ],
        code: {
          src: 'https://better-auth.com/docs/plugins/email-otp',
          text: `import { betterAuth } from 'better-auth'
import { emailOTP } from 'better-auth/plugins'

export const auth = betterAuth({
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        // 通过 SMTP 发送验证码
      },
    }),
  ],
})`,
        },
        fit: '需求逐条都有现成功能，并有 Drizzle 适配器。',
      },
      {
        name: 'Auth.js（next-auth）',
        pkg: 'next-auth',
        verdict: 'no',
        caps: ['OAuth 为主的会话库'],
        warn: [
          'npm latest 仍是 4.24.x，v5 停在 beta（5.0.0-beta.32）',
          'README：Auth.js 已并入 Better Auth，新项目建议直接用 Better Auth',
        ],
        fit: '不适合新项目。',
      },
      { name: '自研', kind: 'self', verdict: 'no', caps: [], fit: '违反安全红线。' },
    ],
    decision: {
      owner: 'Better Auth',
      version: '1.7.14',
      wrapper:
        'src/server/auth/（对外只暴露 requireUser()、requireAdmin()）；/api/auth/[...all] 挂 Better Auth 处理器',
      rules: [
        '插件：emailOTP、admin、twoFactor（只给管理员开启）；APK 阶段再加 bearer',
        'rateLimit.storage 用 "database"，规则按 ADR-0002 第 6 节配置',
        'advanced.ipAddress.ipAddressHeaders 设为 ["x-real-ip"]',
        '显式设置 telemetry.enabled = false，服务器 .env 加 BETTER_AUTH_TELEMETRY=0',
        '邮箱白名单和规范化在注册前的 hook 里执行，有单元测试',
      ],
      rejected: [
        ['Auth.js', 'v5 未稳定，官方建议新项目改用 Better Auth'],
        ['自研', '安全红线'],
      ],
      cost: '依赖 20 个传递包（其中自带 kysely）；大版本升级要跑迁移。',
      review: ['Better Auth 大版本升级或出现安全公告时'],
    },
    sources: [
      ['Better Auth Email OTP', 'https://better-auth.com/docs/plugins/email-otp'],
      ['Better Auth 限流', 'https://better-auth.com/docs/concepts/rate-limit'],
      ['Better Auth admin 插件', 'https://better-auth.com/docs/plugins/admin'],
      ['Better Auth 遥测', 'https://better-auth.com/docs/reference/telemetry'],
      [
        'Auth.js is now part of Better Auth',
        'https://better-auth.com/blog/authjs-joins-better-auth',
      ],
    ],
  },
  {
    no: 12,
    slug: 'data-access',
    title: '数据访问',
    group: 'C 业务基础设施',
    adr: '0015',
    needs: [
      'PostgreSQL 18（服务器 127.0.0.1:23432）',
      'TypeScript 写 schema，生成可审阅的 SQL 迁移文件',
      '事务和原子更新（额度预占与结算）',
      'Better Auth 适配器',
    ],
    layer: 'SQL 风格的 ORM + 迁移工具；数据库驱动单独选。',
    candidates: [
      {
        name: 'Drizzle ORM 0.45 + drizzle-kit',
        pkg: 'drizzle-orm',
        verdict: 'pick',
        caps: [
          'drizzle-orm 0 个依赖',
          'drizzle-kit generate 生成 SQL 迁移',
          'Better Auth 的 peer 依赖接受 drizzle-orm ^0.45.2 或 1.0 RC',
        ],
        warn: [
          '1.0 正处于 RC（rc.5），npm latest 仍是 0.45.x；官方提供 drizzle-kit up 升级',
          'drizzle-kit（开发依赖）会带进 3 个版本的 esbuild，都有 postinstall 脚本（本次扫描）',
        ],
        fit: '和需求最贴合，运行时零依赖。',
      },
      {
        name: 'Drizzle ORM 1.0 RC',
        kind: 'variant',
        verdict: 'alt',
        sizeNote: '1.0.0-rc.5（npm rc 标签）',
        caps: ['新的迁移目录结构和关系查询'],
        fit: '省掉以后一次升级，但生产环境不用 RC。',
      },
      {
        name: 'Prisma',
        pkg: 'prisma',
        verdict: 'no',
        caps: ['schema 优先的 ORM'],
        warn: ['npm latest 标签指向 8.0.0-rc.29，直接安装会装上 RC'],
        fit: '需要生成步骤，稳定线不清晰。',
      },
      {
        name: 'Kysely',
        pkg: 'kysely',
        verdict: 'no',
        caps: ['类型安全的查询构建器'],
        fit: '没有从 schema 生成迁移的能力。',
      },
    ],
    driver: [
      [
        'pg（node-postgres）8.23',
        '选用：Better Auth peer 支持 pg，以后的 pg-boss 也用 pg，全项目只有一个驱动',
      ],
      ['postgres（postgres.js）4.0.0', '不用：4.0.0 是 2026-10-30 刚发布的大版本'],
    ],
    decision: {
      owner: 'Drizzle ORM + drizzle-kit + pg',
      version: 'drizzle-orm 0.45.4、drizzle-kit 0.31.11、pg 8.23.1',
      wrapper:
        'src/server/db/（client.ts、schema/<领域>.ts、migrations/）；只有 src/server/ 可以 import drizzle-orm 和 pg',
      rules: [
        '迁移用 drizzle-kit generate 生成并提交，PR 里审 SQL；生产环境不用 push',
        'Better Auth 的表用 npx auth generate 生成到 Drizzle schema',
      ],
      rejected: [
        ['Drizzle 1.0 RC', '生产不用 RC'],
        ['Prisma', 'latest 指向 RC'],
        ['Kysely', '没有迁移生成'],
      ],
      cost: '1.0 稳定后需要升级一次（drizzle-kit up）。',
      review: ['Drizzle 1.0 发布稳定版时'],
    },
    sources: [['Drizzle 升级到 v1', 'https://orm.drizzle.team/docs/upgrade-v1']],
  },
  {
    no: 13,
    slug: 'api-layer',
    title: '接口层与契约',
    group: 'C 业务基础设施',
    adr: '0016',
    needs: [
      '/api/v1 统一 REST，Web、APK 壳、未来 Kotlin 共用',
      '输出 OpenAPI 契约给 Kotlin 生成客户端',
      '中间件：鉴权、限流、幂等键、统一错误体 { code, detail }',
      '浏览器端有类型的客户端',
    ],
    layer: '挂在 Next Route Handler 里的轻量 API 框架，能从 zod schema 生成 OpenAPI。',
    candidates: [
      {
        name: 'Hono 4 + @hono/zod-openapi',
        pkg: 'hono',
        verdict: 'pick',
        caps: [
          'hono 0 个依赖',
          '@hono/zod-openapi：peer zod ^4、hono ≥ 4.10，从路由定义生成 OpenAPI 文档',
          'App Router 用法：app/api/[[...route]]/route.ts（Hono 官方 Next.js 指南）',
        ],
        warn: [
          '官方示例用 @hono/vercel 的 handle()；是否可以直接导出 app.fetch、免装这个包，实施时先验证',
        ],
        code: {
          src: 'https://hono.dev/examples/zod-openapi',
          text: `import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

const route = createRoute({
  method: 'get',
  path: '/users/{id}',
  request: { params: ParamsSchema },
  responses: { 200: { content: { 'application/json': { schema: UserSchema } }, description: '…' } },
})

const app = new OpenAPIHono()
app.openapi(route, (c) => c.json({ id: c.req.valid('param').id, name: '…', age: 20 }))`,
        },
        fit: '契约、中间件、类型化客户端一次解决。',
      },
      {
        name: 'oRPC',
        pkg: '@orpc/server',
        verdict: 'alt',
        caps: ['端到端类型、OpenAPI 处理器、TanStack Query 集成'],
        warn: ['官方入门文档已改为安装 @beta（v2），正在大版本过渡'],
        fit: '等 v2 稳定后可以再看。',
      },
      {
        name: '原生 Route Handler + zod',
        kind: 'native',
        verdict: 'alt',
        sizeNote: '0 依赖',
        caps: ['不加框架'],
        fit: 'OpenAPI、中间件链、类型化客户端都要自己写。',
      },
    ],
    decision: {
      owner: 'Hono + @hono/zod-openapi',
      version: 'hono 4.13.14、@hono/zod-openapi 1.6.3',
      wrapper:
        'src/app/api/v1/[[...route]]/route.ts 挂载；路由按领域写在 src/server/api/<领域>.ts；错误码登记在 src/server/api/errors.ts',
      rules: [
        'handler 只做四件事：解析入参 → requireUser() → 调 service → 映射结果',
        'OpenAPI 导出到 docs/specs/api/openapi.json 并提交，CI 检查与代码一致',
      ],
      rejected: [
        ['oRPC', 'v2 大版本过渡中'],
        ['原生 Route Handler', '契约和中间件要全部手写'],
      ],
      cost: '多两个服务端依赖（不进客户端包）。',
      review: ['oRPC v2 稳定且需要 RPC 风格时'],
    },
    sources: [
      ['Hono：Next.js', 'https://hono.dev/docs/getting-started/nextjs'],
      ['Hono：Zod OpenAPI', 'https://hono.dev/examples/zod-openapi'],
      ['oRPC 入门', 'https://orpc.dev/docs/getting-started'],
    ],
  },
  {
    no: 14,
    slug: 'smtp',
    title: 'SMTP 发信',
    group: 'C 业务基础设施',
    adr: '0017',
    needs: [
      '登录验证码邮件',
      '额度异常告警邮件（发给管理员）',
      '阿里云邮件推送，SMTP 465（ADR-0002 第 2 节）',
    ],
    layer: '通用 SMTP 客户端，而不是云厂商 SDK。',
    candidates: [
      {
        name: 'Nodemailer',
        pkg: 'nodemailer',
        verdict: 'pick',
        caps: ['0 个依赖，MIT-0 许可证', 'SMTP 密码只对一个发信地址有效，权限小'],
        warn: [
          '2026 年修复过地址解析和 SMTP 回复解析的漏洞（CVE-2026-110870、CVE-2026-110872，分别在 10.0.13、10.0.10 修复），版本至少用 10.3.1',
        ],
        fit: '最直接。',
      },
      {
        name: '阿里云邮件推送 SDK',
        pkg: '@alicloud/dm20151123',
        verdict: 'no',
        caps: ['调用邮件推送的 OpenAPI'],
        warn: ['需要阿里云 AccessKey（账号级凭据），权限比 SMTP 密码大'],
        fit: '多一份高权限密钥。',
      },
    ],
    decision: {
      owner: 'Nodemailer',
      version: '10.3.1',
      wrapper: 'src/server/mail/（transport、模板、sendOtp()、sendAlert()）',
      rules: [
        '邮件模板用简单 HTML 字符串，不引入模板引擎',
        '收件地址先过白名单校验再交给 Nodemailer',
      ],
      rejected: [['阿里云 SDK', '需要高权限 AccessKey']],
      cost: '—',
      review: ['Nodemailer 出现新的安全公告时'],
    },
    sources: [
      ['Nodemailer 发布记录', 'https://github.com/nodemailer/nodemailer/releases'],
      ['GHSA-597p-2mmq-hhg9', 'https://github.com/advisories/GHSA-597p-2mmq-hhg9'],
      ['GHSA-37fc-hcrp-mmff', 'https://github.com/advisories/GHSA-37fc-hcrp-mmff'],
    ],
  },
  {
    no: 15,
    slug: 'testing',
    title: '测试',
    group: 'C 业务基础设施',
    adr: '0018',
    needs: [
      '纯函数单元测试：额度预占与结算、热量计算、打卡日归属、连续打卡、邮箱规范化',
      'service 集成测试连本地 PostgreSQL',
      'CI 里不调用真实 DeepSeek',
      '界面验收用 ego-browser（不在测试框架里）',
    ],
    layer: '一个 TypeScript 原生的测试运行器；组件测试暂不做。',
    candidates: [
      {
        name: 'Vitest 5',
        pkg: 'vitest',
        verdict: 'pick',
        caps: ['原生 TS / ESM', 'peer 依赖 vite ^6 / ^7 / ^8（需要一起装 vite）'],
        fit: '生态主流，配置少。',
      },
      {
        name: 'node:test',
        kind: 'native',
        verdict: 'alt',
        sizeNote: '0 依赖',
        caps: ['Node 内置'],
        fit: '路径别名、模拟、覆盖率都要自己处理。',
      },
    ],
    decision: {
      owner: 'Vitest',
      version: '5.0.5（+ vite）',
      wrapper: 'vitest.config.ts；测试文件和被测文件放在一起（*.test.ts）',
      rules: ['AI 相关测试用 AI SDK 的 mock 模型', 'pnpm test 加入 CI 的 verify job'],
      rejected: [['node:test', '工具链要自己拼']],
      cost: '多两个开发依赖。',
      review: ['需要组件测试时（评估 Testing Library + happy-dom）'],
    },
    sources: [['Vitest', 'https://vitest.dev']],
  },
  {
    no: 16,
    slug: 'pwa',
    title: 'PWA 与 Service Worker',
    group: 'C 业务基础设施',
    adr: '0019',
    needs: [
      '可以安装到桌面（manifest、图标）',
      '离线时显示兜底页',
      '离线草稿放到 v0.2（ADR-0003）',
    ],
    layer: 'MVP 只要可安装 + 离线兜底，原生能力足够。',
    candidates: [
      {
        name: 'app/manifest.ts + 手写 public/sw.js',
        kind: 'native',
        verdict: 'pick',
        sizeNote: '0 依赖（约 50 行）',
        caps: [
          'Next 官方 PWA 指南即采用 manifest.ts + 手写 Service Worker',
          '导航请求网络优先，失败时返回预缓存的离线页',
        ],
        fit: '和 standalone 部署没有耦合。',
      },
      {
        name: 'Serwist（Turbopack 方案）',
        pkg: '@serwist/turbopack',
        verdict: 'alt',
        caps: ['预缓存清单、运行时缓存策略、离线兜底'],
        warn: [
          'Turbopack 方案在一个路由处理器里用 esbuild 编译 Service Worker，并用 git rev-parse 取版本号；standalone 制品里要额外带上 esbuild 二进制',
          '依赖里包含 @swc/core',
        ],
        fit: '做离线草稿时再评估。',
      },
    ],
    decision: {
      owner: '不引入库：原生 manifest + 手写 Service Worker',
      version: '—',
      wrapper: 'src/app/manifest.ts、public/sw.js、src/app/offline/page.tsx',
      rules: ['Service Worker 不缓存 /api/*，只缓存静态资源和离线页', 'sw.js 修改后版本号必须变化'],
      rejected: [['Serwist', 'MVP 用不到；Turbopack 方案和 standalone 制品有耦合']],
      cost: '缓存策略手写。',
      review: ['做离线草稿（v0.2）时'],
    },
    sources: [
      [
        'Next.js PWA 指南（本地 node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md）',
        'https://nextjs.org/docs/app/guides/progressive-web-apps',
      ],
      ['Serwist Turbopack', 'https://serwist.pages.dev/docs/next/turbo'],
    ],
  },
  {
    no: 17,
    slug: 'jobs',
    title: '定时任务',
    group: 'C 业务基础设施',
    adr: '0020',
    needs: [
      '每周一 00:00 重置 AI 额度',
      '每天 00:00 重置全站花费上限',
      '额度异常时给管理员发邮件',
      '数据库每日备份（已由系统 cron 完成）',
    ],
    layer: '这些"定时"大多可以改成"按周期懒计算"，不需要任务队列。',
    candidates: [
      {
        name: '按周期键懒计算 + 系统 cron',
        kind: 'native',
        verdict: 'pick',
        sizeNote: '0 依赖',
        caps: [
          '额度行带 period_key（例如 2026-W44，按北京时间）；新周期第一次读写时在同一事务里重置',
          '全站日上限同理，用日期键',
          '告警在越过阈值的那次请求里发送，按"每天每种告警一次"去重',
        ],
        fit: '服务器重启或停机也不会漏执行。',
      },
      {
        name: 'pg-boss',
        pkg: 'pg-boss',
        verdict: 'alt',
        caps: ['基于 PostgreSQL 的任务队列与定时任务'],
        fit: '做提醒、周报邮件（v0.2）时再引入。',
      },
      {
        name: 'node-cron / croner',
        pkg: 'croner',
        verdict: 'no',
        caps: ['进程内定时器'],
        fit: '进程重启或停机期间的任务会丢。',
      },
    ],
    decision: {
      owner: '不引入库：周期键懒计算 + 系统 cron',
      version: '—',
      wrapper: 'src/server/quota/（period.ts 计算周期键，依赖 src/lib/time/）',
      rules: ['周期计算只用 src/lib/time/ 的函数，并有单元测试覆盖周一、跨年、时区'],
      rejected: [
        ['pg-boss', 'MVP 没有需要队列的任务'],
        ['进程内定时器', '停机会漏'],
      ],
      cost: '读写额度时多一个判断。',
      review: ['需要提醒、周报等真正的定时任务时'],
    },
    sources: [['pg-boss', 'https://github.com/timgit/pg-boss']],
  },
]
