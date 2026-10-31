# ADR-0010：图表——自研 SVG 图表 + d3-shape

- 状态：Accepted（负责人 2026-10-31 拍板：Phase 3 的 17 项建议全部采纳）
- 日期：2026-10-31
- 决策人：项目负责人（AI 提供分析）
- 对比页：[docs/designs/library-showcase/07-charts.html](../designs/library-showcase/07-charts.html)

## 背景

- 体重曲线（几十个点）
- 后台每日 AI 花费曲线
- 营养素环 / 条（已有 ProgressRing）
- 打卡周热力图、仪表盘迷你图
- 手账风格，强定制

先定的层：数据量小、图表种类少、外观要和 token 一致 → 自研 SVG 组件，只借一个曲线数学工具；不用通用图表库。

## 面临的选项

- **自研 SVG + d3-shape**（`d3-shape`）：推荐。体积最小，外观完全可控。
- **Recharts 3**（`recharts`）：不采用。对几张小图来说太重。
- **ECharts 6**（`echarts`）：不采用。整包约 359 KB，Canvas 渲染，样式难对齐 token。
- **d3-scale**（`d3-scale`）：不采用。会带进 d3-array、d3-interpolate、d3-time 等；我们只需要线性比例尺。
- **uPlot**（`uplot`）：不采用。Canvas，最近发布 2025-03；面向大数据量。

## 决定

自研 SVG 图表 + d3-shape，版本 d3-shape 3.2.0。

- 封装层入口：src/components/charts/（LineChart、WeekHeatmap、Sparkline；营养素环复用 ProgressRing）；d3-shape 只允许在这个目录里 import
- 图表颜色只用板块色和状态色 token
- 每个图表都有文字替代（aria-label 或可见的数值摘要）

## 理由

体积最小，外观完全可控。

- 只用 line、area、arc 和 curveMonotoneX 生成平滑路径
- 线性比例尺几行代码自己写
- ISC 许可证

## 放弃了什么

- Recharts：一张折线图 104.5 KB
- ECharts：整包约 359 KB，Canvas 难对齐 token
- d3-scale：传递依赖多，需求只有线性比例尺

已知代价：缩放、多序列、交互提示要自己做。

## 何时重审

- 需要缩放、大数据量或复杂交互图表时
