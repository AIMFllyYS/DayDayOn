# ADR-0012：客户端数据请求——TanStack Query

- 状态：Accepted（负责人 2026-10-31 拍板：Phase 3 的 17 项建议全部采纳）
- 日期：2026-10-31
- 决策人：项目负责人（AI 提供分析）
- 对比页：[docs/designs/library-showcase/09-client-data.html](../designs/library-showcase/09-client-data.html)

## 背景

- 首屏数据由 Server Component 直接调 service 输出
- 打卡、待办勾选：先更新界面，失败回滚
- 写入后刷新相关列表和统计
- AI 识别过程中轮询或流式更新状态

先定的层：首屏用 RSC；交互后的读写用一个客户端缓存库。只用 RSC + router.refresh() 做不到乐观更新和局部回滚。

## 面临的选项

- **TanStack Query 5**（`@tanstack/react-query`）：推荐。本项目写操作多，正好用到它最强的部分。
- **SWR**（`swr`）：备选。更小，但写入和回滚的工具比 TanStack Query 少。
- **只用 RSC + router.refresh()**：不采用。每次写入都要重新拉整页的 RSC 数据，没有乐观更新。

## 决定

TanStack Query，版本 5.105.0。

- 封装层入口：src/lib/api/（QueryClient、类型化的接口客户端、query key 工厂）
- query key 统一由 src/lib/api/keys.ts 生成
- 业务组件不直接 fetch /api/v1，一律经 src/lib/api/

## 理由

本项目写操作多，正好用到它最强的部分。

- useMutation 的 onMutate / onError 用于乐观更新与回滚
- 按 query key 失效刷新
- 以后做离线草稿时可以接持久化

## 放弃了什么

- SWR：写入与回滚工具较少
- 只用 RSC：没有乐观更新

已知代价：客户端多约 10 KB。

## 何时重审

- 做离线草稿（v0.2）时评估持久化方案
