# 时间与日期规范

> 日期：2026-10-31 · 状态：初版。本文档由初始化时联网调研生成，条目未经实战验证，踩坑后按 [lessons 机制](../lessons/README.md)修订。
> 依据：[ADR-0008](../adr/0008-date-time-calc.md)（date-fns 4 + @date-fns/tz）、[ADR-0007](../adr/0007-date-time-picker.md)（原生输入 + React DayPicker）、[ADR-0020](../adr/0020-jobs.md)（周期键）、[ADR-0002](../adr/0002-account-quota-risk.md) 第 5 节（北京时间周一重置）。
> 官方资料（2026-10-31 抓取）：`@date-fns/tz` README（`TZDate`、`tz()`）、React DayPicker 本地化文档。库的坑见 [lessons/date-fns.md](../lessons/date-fns.md)、[lessons/react-day-picker.md](../lessons/react-day-picker.md)。

## 1. 三种时间

| 概念 | 存储 | 接口格式 | 例子 |
|---|---|---|---|
| 时间点：发生在哪一刻 | `timestamptz`（UTC） | ISO 8601，带 `Z` | 打卡提交时间、入睡时刻、DDL |
| 本地日期：算在哪一天 | `date` | `YYYY-MM-DD` | 打卡日、体重记录日 |
| 时长 | `integer` 秒 | `durationSeconds` | 运动 30 分钟 = `1800` |

- 不把"23:30"这类本地时间字符串当作时间点存储。睡眠的入睡、起床由前端按用户时区组合成时刻再提交。
- 打卡日由服务端用 `src/lib/time/` 计算后写入，不信任客户端传来的打卡日。

## 2. 时区

- 用户时区存在个人资料里（IANA 名称，默认 `Asia/Shanghai`），可以在"我的 → 个人资料"修改。打卡日按用户时区算。
- 业务周期一律按北京时间 `Asia/Shanghai`，与用户时区无关：每周额度（周一 00:00 重置）、全站每日花费上限、排行榜的周 / 月。
- 代码不依赖运行环境的系统时区。服务器、CI（Ubuntu，默认 UTC）、用户浏览器的系统时区都可能不同。凡是和时区有关的计算，都显式传入时区：`new TZDate(instant, zone)`，或 date-fns 函数的 `{ in: tz(zone) }` 选项。
- 禁止：
  - `new Date(年, 月, 日)` 这类按系统时区构造日期的写法；
  - 用 `getHours()`、`getDate()`、`getDay()` 读取业务含义上的本地时间；
  - 手写 `+ 8 * 3600 * 1000` 一类的时区偏移；
  - 在 SQL 里用 `AT TIME ZONE` 计算打卡日。

## 3. src/lib/time/：唯一入口

- 业务代码不直接 import `date-fns`、`@date-fns/tz`，也不自己做日期加减。缺函数就在 `src/lib/time/` 里加，并补测试。
- 需要"现在"的函数把 `now` 作为参数传入，方便测试。
- 首批函数（M2 写好，全部带测试）：

| 函数 | 作用 |
|---|---|
| `localDateOf(instant, timeZone, dayStartHour = 4)` | 时刻 → 打卡日。凌晨 4 点前算前一天，熬夜打卡不会记到第二天。`dayStartHour` 可在偏好设置里改 |
| `dayKey(instant)` | 北京时间的日期键 `2026-10-31`（全站日上限） |
| `weekKey(instant)` | 北京时间的 ISO 周键 `2026-W44`（每周额度、周榜） |
| `monthKey(instant)` | 北京时间的月键 `2026-10`（月榜） |
| `combineLocal(date, time, timeZone)` | 本地日期 + 本地时间 → 时刻 |
| `sleepRange(bedDate, bedTime, wakeTime, timeZone)` | 起床时间早于入睡时间时算作次日；返回两个时刻和时长秒数 |
| `secondsBetween(a, b)` | 两个时刻之间的秒数 |

- 一周从周一开始。周键使用 ISO 周（年末、年初的那一周按 ISO 规则归属）。

## 4. 显示

- 显示用原生 `Intl.DateTimeFormat('zh-CN', { timeZone, … })` 和 `Intl.RelativeTimeFormat('zh-CN')`，零体积。date-fns 只用于计算，不用它的 `format` 加中文 locale 做显示。
- 格式化函数集中在 `src/lib/time/format.ts`：`10月31日 周六`、`23:30`、`1小时30分`、`3分钟前`。
- 显示时间点时用用户时区；显示周期（"本周额度"）时用北京时间并注明。

## 5. 输入

- 日期、时间输入只用原生 `<input type="date">`、`<input type="time">`、`<input type="datetime-local">`，外框套 `Field`（ADR-0007）。iOS / Android 会弹出系统选择器。
- 原生控件的值是本地字符串（`2026-10-31`、`23:30`），提交前用 `combineLocal()` 转成时刻。
- 待办的 DDL 用 `datetime-local`。
- 睡眠区间用两个 `time` 输入，起床早于入睡时显示"次日"，并实时显示时长（`time-range-field.tsx`）。
- 日历视图（打卡日历）只经 `src/components/ui/calendar.tsx` 使用 React DayPicker：`weekStartsOn={1}`，中文 locale 从 `react-day-picker/locale/zh-CN` 子路径导入（导出名在安装后核对）。

## 6. 测试必须覆盖

- 跨午夜：23:59 与 00:00。
- 换日边界：`dayStartHour = 4` 时的 03:59 与 04:00。
- 周一切换：北京时间周日 23:59:59 与周一 00:00:00。
- 跨年的 ISO 周。
- 用户时区不是北京时间时，打卡日与周期键各自正确。
- 睡眠跨午夜、起床时间等于入睡时间（视为输入错误）。
- 测试里用固定的时刻字面量（`new Date('2026-10-31T15:59:59Z')`），不用 `Date.now()`。本机（Asia/Shanghai）和 CI（UTC）两种系统时区下都必须通过。

