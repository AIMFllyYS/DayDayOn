# lessons — date-fns 与 @date-fns/tz

> 适用版本：date-fns@4.4.0、@date-fns/tz@1.5.0（M1 随 Base UI 安装）。以下条目来自 2026-10-31 对官方 README 的核对，尚未在本项目代码里踩到。

### 结果取决于运行环境的系统时区
- 症状：本机（Asia/Shanghai）测试通过，CI（UTC）或服务器上打卡日差一天。
- 根因：`new Date(y, m, d)`、`startOfDay()` 等默认按系统时区计算。
- 规则：时区相关计算一律显式传时区：`new TZDate(instant, zone)` 或 `{ in: tz(zone) }`（date-fns 4 起支持）；只在 `src/lib/time/` 里写。
- 元：date-fns@4.4.0 | 2026-10-31 | 候选毕业方向：封装层（`src/lib/time/`）+ lint（业务代码禁止 import date-fns）

### @date-fns/tz 的仓库已迁移
- 症状：去 `github.com/date-fns/tz` 查文档，看到的是迁移提示。
- 根因：该包已并入 date-fns 主仓库的 `pkgs/tz`。
- 规则：查文档去 `github.com/date-fns/date-fns/tree/main/pkgs/tz`。
- 元：@date-fns/tz@1.5.0 | 2026-10-31 | 候选毕业方向：无

### ISO 周数跨年时不能用 `getYear(date)` 拼周期键
- 症状：2026-12-28 至 2026-12-31（屬於 2027-W01，或年初属于上一年 W52/W53）用 `getYear()` 拼成 `2026-W01`，和上一年的第一周撞键。
- 根因：ISO 8601 周的所属年份是 `getISOWeekYear(date)`，在年初/年末几天与公历年 `getYear(date)` 不同。
- 规则：周周期键一律用 `getISOWeekYear` + `getISOWeek`（已封装在 `src/lib/time/` 与 `src/server/quota/period.ts`），禁止手写 `getYear`。
- 元：date-fns@4.4.0 | 2026-11-01 | 候选毕业方向：已沉淀到 `src/lib/time/`

