# lessons — React DayPicker（react-day-picker）

> 适用版本：react-day-picker@10.0.2（M2 安装）。以下条目来自 2026-10-31 对官方文档和 registry 的核对，尚未在本项目代码里踩到。

### 官网示例的包名是 @daypicker/react
- 症状：照官网示例写 `import { DayPicker } from '@daypicker/react'`，装了第二个包。
- 根因：官网改用 `@daypicker/react` 这个名字，它只是依赖 `react-day-picker@10.0.2` 的转发包。
- 规则：本项目只装、只 import `react-day-picker`；照抄示例时替换包名，locale 路径同理（`react-day-picker/locale/zh-CN`）。
- 元：react-day-picker@10.0.2 | 2026-10-31 | 候选毕业方向：lint（禁止 `@daypicker/*`）

