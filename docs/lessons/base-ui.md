# lessons — Base UI（@base-ui/react）

> 适用版本：@base-ui/react@1.9.0（M1 安装）。以下条目来自 2026-10-31 对官方文档的核对，尚未在本项目代码里踩到；实战中证实或推翻后更新本文件。

### 旧包名 @base-ui-components/react
- 症状：照训练数据或旧教程写 `@base-ui-components/react`，装到的是旧包。
- 根因：包已改名，官方文档每页顶部都注明以 `@base-ui/react` 为准。
- 规则：只写 `@base-ui/react`；看到旧包名的示例先改包名再参考。
- 元：@base-ui/react@1.9.0 | 2026-10-31 | 候选毕业方向：lint（禁止 `@base-ui-components/*`）

### 从包根导入
- 症状：`import { Dialog } from '@base-ui/react'`，按需加载的边界变模糊。
- 根因：官方示例都用子路径 `@base-ui/react/<组件>`；本项目的体积预算按子路径实测。
- 规则：只在 `src/components/ui/` 里按子路径导入。
- 元：@base-ui/react@1.9.0 | 2026-10-31 | 候选毕业方向：lint

### 弹层被页面元素盖住、iOS 26 遮罩盖不满
- 症状：弹层出现在某些 `z-index` 元素下面；iOS 26 Safari 上对话框遮罩底部露出页面。
- 根因：Base UI 要求应用根节点 `isolation: isolate`；iOS 26 起遮罩需要 `position: absolute` 配合 `body { position: relative }`。
- 规则：按 ui-primitives.md 第 2 节在根布局一次性设置，不在单个组件里调 `z-index`。
- 元：@base-ui/react@1.9.0 | 2026-10-31 | 候选毕业方向：封装层（根布局）

### 软键盘高度变量没有默认值
- 症状：抽屉底部的输入框在键盘收起后位置错乱。
- 根因：`--drawer-keyboard-inset` 只在键盘对齐时才设置，`var(--drawer-keyboard-inset)` 在其他时候无效。
- 规则：一律写 `var(--drawer-keyboard-inset, 0px)`；含输入框的抽屉包 `Drawer.VirtualKeyboardProvider`。
- 元：@base-ui/react@1.9.0 | 2026-10-31 | 候选毕业方向：封装层（`sheet.tsx`）

