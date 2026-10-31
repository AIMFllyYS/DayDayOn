# 代码风格

> 格式、lint 规则和提交信息由工具强制（Prettier、ESLint、commitlint），本文只写工具管不到的约定。
> 代码长度与文件放置见 [code-size-and-organization.md](./code-size-and-organization.md)；Next.js 特有规则见 [nextjs-16-patterns.md](./nextjs-16-patterns.md)。

## 组件与渲染

- 默认 Server Component；只在需要交互或浏览器 API 时加 `'use client'`，并尽量放在叶子组件
- 客户端组件懒加载用 `next/dynamic`
- 优先命名导出；page / layout / route 等 Next 约定文件除外

## TypeScript

- strict 模式，禁止 `any`，用 `unknown` + 类型收窄
- 跨信任边界的数据（请求体、AI 输出、第三方响应）一律先用 zod 校验再使用
- 金额用整数"微元"（1 元 = 1,000,000 微元），不用浮点数；超过 `Number.MAX_SAFE_INTEGER` 风险的值用 `bigint` 或字符串传输

## 样式

- 使用 Tailwind CSS，不用 CSS Modules（覆盖第三方组件时除外）
- 条件 className 用 `cn()`
- 颜色、圆角、阴影等只引用设计 token，不在组件里写死色值；字号用语义类（`text-body`、`text-caption`…），不用 `text-sm`
- 着色统一走 `src/components/ui/tone.ts`，类名写完整字符串，不拼接 `bg-${tone}`
- 页面不重新写按钮、卡片、进度条；缺组件先在 Playbook 里加（[ui-design-system.md](./ui-design-system.md)）

## 文案与注释

- 界面文案用中文；代码注释用中文
- 注释写"为什么"，不复述代码做了什么

## 测试

- 涉及钱和规则的纯函数必须有单元测试：额度预占 / 结算、热量计算、打卡日归属、连续打卡计算（完整清单与写法见 [testing.md](./testing.md)）
- 界面改动用 ego-browser 在手机和桌面宽度下实际操作验收

## 各库的落地规范

接口、数据库、鉴权、AI、时间、前端数据与表单、交互原语、PWA 各有一份规范，清单见 [conventions/README.md](./README.md)。写对应代码前先读。

## dev/ 调试区

- 调试 / 原型代码放在 `src/app/dev/`（URL `/dev/*`）。`dev/layout.tsx` 统一做生产守卫 `if (process.env.NODE_ENV === 'production') notFound()`，读数据的调试页在页面顶部再加一次
- `dev/` 可以引用正式代码，正式代码不得引用 `dev/`
- 演示区块加 `data-ann="playbook.<页面>.<区块>"`，批注工具才能稳定定位
- 调试完成后迁移到正式路由，并清理对应的调试页（Playbook 长期保留）
