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

### NumberField 的原生 step 校验拦截非步长倍数的默认值
- 症状：时长默认 30 分钟、步长 `step={5}`（或带 `min` 偏移）时，不点步进直接提交表单被浏览器原生 `stepMismatch` 拦截。
- 根因：`BaseNumberField.Input` 会透传 `step` 到原生 `<input>`，触发 HTML5 `stepMismatch` 校验，Base UI `Form` 判为无效并阻止 `onFormSubmit`。
- 规则：`number-field.tsx` 只把 `step` 传给 `BaseNumberField.Root`（供 ± 按钮和滚轮使用），在 `BaseNumberField.Input` 上显式设 `step="any"`，合法范围统一由 zod 校验。
- 元：@base-ui/react@1.9.0 | 2026-11-01 | 候选毕业方向：已沉淀到 `src/components/ui/number-field.tsx`

### Form 的 errors 属性引用不稳定导致改字段后仍无法重新提交
- 症状：受控表单第一次提交校验失败后，用户修改了字段再点提交，错误又闪回来且 `onFormSubmit` 不触发。
- 根因：Base UI `Form` 内部用 `useValueChanged(externalErrors, () => setErrors(externalErrors))` 同步外部 `errors`；如果封装层每次渲染都返回新的 `cleanErrors(errors)` 对象，受控输入每次重绘都会把刚由 `clearErrors(name)` 清除的错误重置回去；同时传给 `Field` 的受控 `error` 属性使 `invalid={true}` 常驻，也会拦截提交。
- 规则：`Form` 内必须用 `useMemo(() => cleanErrors(errors), [errors])` 保持引用稳定；直接传 `Field error={...}` 的受控字段在 `onChange` / `onValueChange` 时同步清除对应错误键。
- 元：@base-ui/react@1.9.0 | 2026-11-01 | 候选毕业方向：已沉淀到 `src/components/ui/form.tsx`

### Select.Value 的 placeholder 不能靠空子元素触发
- 症状：`<BaseSelect.Value>{placeholder}</BaseSelect.Value>` 在选中项后仍一直显示 placeholder。
- 根因：`BaseSelect.Value` 传入非函数 `children` 时会完全覆盖选中项文本；未选中的占位文本应使用 `placeholder` 属性。
- 规则：写 `<BaseSelect.Value placeholder={placeholder} />`；需要自定义渲染时传函数 `(value) => ...`。
- 元：@base-ui/react@1.9.0 | 2026-11-01 | 候选毕业方向：已沉淀到 `src/components/ui/select.tsx`

### Combobox 支持新建条目时不能只传字符串数组
- 症状：用户输入列表中没有的词时下拉列表为空，无法点选新建。
- 根因：`BaseCombobox` 自身没有内置 `creatable` 模式，只会过滤 `items`。
- 规则：封装层在输入词不匹配现有项时，向 `items` 末尾追加一个带 `__creatable` 标记的合成项，选中该项时调用 `onCreate(query)`。
- 元：@base-ui/react@1.9.0 | 2026-11-01 | 候选毕业方向：已沉淀到 `src/components/ui/combobox.tsx`

