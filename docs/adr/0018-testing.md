# ADR-0018：测试——Vitest

- 状态：Accepted（负责人 2026-10-31 拍板：Phase 3 的 17 项建议全部采纳）
- 日期：2026-10-31
- 决策人：项目负责人（AI 提供分析）
- 对比页：[docs/designs/library-showcase/15-testing.html](../designs/library-showcase/15-testing.html)

## 背景

- 纯函数单元测试：额度预占与结算、热量计算、打卡日归属、连续打卡、邮箱规范化
- service 集成测试连本地 PostgreSQL
- CI 里不调用真实 DeepSeek
- 界面验收用 ego-browser（不在测试框架里）

先定的层：一个 TypeScript 原生的测试运行器；组件测试暂不做。

## 面临的选项

- **Vitest 5**（`vitest`）：推荐。生态主流，配置少。
- **node:test**：备选。路径别名、模拟、覆盖率都要自己处理。

## 决定

Vitest，版本 5.0.5（+ vite）。

- 封装层入口：vitest.config.ts；测试文件和被测文件放在一起（*.test.ts）
- AI 相关测试用 AI SDK 的 mock 模型
- pnpm test 加入 CI 的 verify job

## 理由

生态主流，配置少。

- 原生 TS / ESM
- peer 依赖 vite ^6 / ^7 / ^8（需要一起装 vite）

## 放弃了什么

- node:test：工具链要自己拼

已知代价：多两个开发依赖。

## 何时重审

- 需要组件测试时（评估 Testing Library + happy-dom）
