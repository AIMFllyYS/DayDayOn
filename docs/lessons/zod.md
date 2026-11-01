# lessons — zod

> 适用版本：zod@4.6.7（M3 安装）。以下条目来自 Phase 3 的体积实测和 2026-10-31 对官方文档的核对。

### import { z } from 'zod' 让前端包大了三倍多
- 症状：同一组 schema，前端包里 zod 占 90.8 KB（min+gzip）。
- 根因：命名导入 `z` 会带上整个命名空间对象，tree-shaking 失效；`import * as z` 实测 25.6 KB（2026-10-31，esbuild）。
- 规则：统一写 `import * as z from 'zod'`。
- 元：zod@4.6.7 | 2026-10-31 | 候选毕业方向：lint（`no-restricted-syntax` 禁止命名导入 `z`）

### 照 @hono/zod-openapi 的文档从它导入 z
- 症状：前后端共用的 schema 文件 `import { z } from '@hono/zod-openapi'`，前端也被带上 OpenAPI 生成代码。
- 根因：官方示例为了用 `.openapi()` 从该包导入 `z`；zod 4 下组件命名可以用 `.meta({ id })` 代替。
- 规则：共用 schema 只从 `zod` 导入，命名用 `.meta({ id })`；`@hono/zod-openapi` 的 `z` 只在 `src/server/api/` 里用于参数元数据。
- 元：zod@4.6.7、@hono/zod-openapi@1.6.3 | 2026-10-31 | 候选毕业方向：lint

### zod 4 的错误定制参数是 `{ error: '...' }`，且扁平化用顶层 `z.flattenError(err)`
- 症状：写 `{ message: '...' }`、`required_error`、`invalid_type_error` 或调 `err.flatten()` 时报类型错误或弃用。
- 根因：zod 4 统一把校验错误文案收口为 `{ error: '...' }`，并把实例方法 `.flatten()` 移到了命名空间函数 `z.flattenError(err)`；字符串格式校验优先用顶层 `z.email()`、`z.url()`、`z.uuid()`。
- 规则：错误文案写 `{ error: '...' }`；提取字段错误一律调 `z.flattenError(r.error).fieldErrors`。
- 元：zod@4.6.7 | 2026-11-01 | 候选毕业方向：规范（`client-data-and-forms.md`）

