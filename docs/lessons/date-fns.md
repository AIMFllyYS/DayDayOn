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

