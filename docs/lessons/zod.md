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

