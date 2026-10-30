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
- 颜色、圆角、阴影等只引用设计 token，不在组件里写死色值

## 文案与注释

- 界面文案用中文；代码注释用中文
- 注释写"为什么"，不复述代码做了什么

## 测试

- 涉及钱和规则的纯函数必须有单元测试：额度预占 / 结算、热量计算、打卡日归属、连续打卡计算
- 界面改动用 ego-browser 在手机和桌面宽度下实际操作验收

## _dev/ 调试区

- 调试 / 原型代码放在 `src/app/_dev/`，页面顶部必须有守卫：`if (process.env.NODE_ENV === 'production') notFound()`
- `_dev/` 可以引用正式代码，正式代码不得引用 `_dev/`
- 调试完成后迁移到正式路由，并清理 `_dev/`
