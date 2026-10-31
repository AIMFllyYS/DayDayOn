# ADR-0008：日期与时区计算——date-fns + @date-fns/tz

- 状态：Accepted（负责人 2026-10-31 拍板：Phase 3 的 17 项建议全部采纳）
- 日期：2026-10-31
- 决策人：项目负责人（AI 提供分析）
- 对比页：[docs/designs/library-showcase/05-date-time-calc.html](../designs/library-showcase/05-date-time-calc.html)

## 背景

- 打卡日归属：按用户时区，并且每天 04:00 才算换日
- 每周一 00:00（北京时间）重置 AI 额度
- 时长、周 / 月区间、中文格式化
- Node 24 服务端和浏览器（包括 iPhone Safari）结果一致

先定的层：函数式工具库 + 时区扩展。原生 Temporal 是最终方案，但现在还不能直接用。

## 面临的选项

- **date-fns 4 + @date-fns/tz**（`date-fns`）：推荐。项目里本来就会出现这两个包，选它不增加日期库的数量。
- **Day.js + utc / timezone 插件**（`dayjs`）：备选。更小，但会和 React DayPicker 带进来的 date-fns 并存，形成两个日期库。
- **原生 Temporal**：不采用。用户主要用 iPhone，现在用就得带 polyfill。
- **temporal-polyfill**（`temporal-polyfill`）：不采用。整包约 19 KB，等 Safari 支持后再直接用原生。

## 决定

date-fns + @date-fns/tz，版本 date-fns 4.4.0、@date-fns/tz 1.5.0。

- 封装层入口：src/lib/time/（例如 localDateOf(instant, timeZone, dayStartHour)、weekKey(instant)）
- 业务代码不直接做 Date 加减和时区换算，一律调用 src/lib/time/
- src/lib/time/ 的每个函数都要有单元测试，覆盖跨午夜、04:00 换日、周一切换

## 理由

项目里本来就会出现这两个包，选它不增加日期库的数量。

- 按需导入的纯函数
- TZDate：带时区的日期对象
- 已是 Base UI 的 peer 依赖、React DayPicker 的依赖

## 放弃了什么

- Day.js：会和 date-fns 并存
- Temporal / polyfill：Safari 稳定版未支持

已知代价：日后迁到 Temporal 时要改 src/lib/time/ 一处。

## 何时重审

- Safari 稳定版支持 Temporal 且服务器升级到 Node 26 LTS 时
