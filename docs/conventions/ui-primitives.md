# 交互原语与封装层规范

> 日期：2026-10-31 · 状态：初版。本文档由初始化时联网调研生成，条目未经实战验证，踩坑后按 [lessons 机制](../lessons/README.md)修订。
> 依据：[ADR-0004](../adr/0004-interaction-primitives.md)（Base UI）、[ADR-0005](../adr/0005-motion.md)（动效）、[ADR-0006](../adr/0006-toast.md)（Toast）、[ADR-0007](../adr/0007-date-time-picker.md)（日历）、[ADR-0010](../adr/0010-charts.md)（图表）、[ADR-0021](../adr/0021-preset-avatars.md)（预设头像）。
> 官方资料（2026-10-31 抓取）：Base UI 的 Quick start、Drawer、Toast、Form 文档（Markdown 版）。库的坑见 [lessons/base-ui.md](../lessons/base-ui.md)。
> 外观（色彩、字号、动效 token、组件清单、批注流程）以 [ui-design-system.md](./ui-design-system.md) 为准。本文只管第三方原语怎么接进来。

## 1. 封装层

| 原语 | 封装文件（`src/components/ui/`） | 基于 |
|---|---|---|
| 底部抽屉 / 对话框 | `sheet.tsx`（对外接口不变） | Base UI Drawer（< 768px）/ Dialog（≥ 768px） |
| 确认对话框 | `confirm-dialog.tsx` | AlertDialog |
| 提示消息 | `toast.tsx` | Toast |
| 下拉选择 | `select.tsx` | Select |
| 组合框（可搜索、多选、可新建） | `combobox.tsx` | Combobox |
| 菜单 | `menu.tsx` | Menu |
| 气泡 | `popover.tsx` | Popover |
| 滑块 | `slider.tsx` | Slider |
| 数字输入 | `number-field.tsx` | NumberField |
| 验证码输入 | `otp-field.tsx` | OTPField |
| 表单与字段 | `form.tsx`、`field.tsx`（改造现有） | Form、Field |
| 复选框 | `checkbox.tsx` | Checkbox |
| 日历 | `calendar.tsx` | React DayPicker |
| 人机验证弹窗 | `turnstile.tsx` | Base UI Dialog + 自研手账点选 `<canvas>`（ADR-0023） |
| 开关、分段控件、评分 | 现有 `switch.tsx`、`segmented-control.tsx`、`rating.tsx` | 保持自研 |

- 只在 `src/components/ui/` 里 import Base UI，并且只用子路径：`import { Drawer } from '@base-ui/react/drawer'`。不从 `@base-ui/react` 包根导入。
- 封装文件对外导出本项目的组件 API（例如 `<Select options value onValueChange />`），在内部组装好 Base UI 的部件。业务代码里不出现 `Select.Root`、`Select.Trigger` 这类 Base UI 部件名。
- 样式只用设计 token 和语义字号。状态样式用 Base UI 的 data 属性（`data-open`、`data-disabled`、`data-highlighted`、`data-starting-style`、`data-ending-style`）配合 Tailwind 的 `data-*:` 变体。
- 每个封装组件先在 `/dev/playbook` 有演示并通过批注定稿，再用到页面（ui-design-system.md 第 1 节）。

## 2. 根布局的一次性设置（M1 安装时做）

- 应用内容外包一层设置了 `isolation: isolate` 的根节点，让弹层始终在页面内容之上，`z-index` 不互相干扰（Base UI Quick start）。
- 全局样式加 `body { position: relative; }`：iOS 26 起，Safari 的对话框遮罩要用 `position: absolute` 才能盖住整个可视区域。
- 全站只有一个 `Toast.Provider`（带全局 toast 管理器），放在根布局。
- 这几处要改 `src/app/layout.tsx` 和 `src/app/globals.css`，动手前先和正在改设计系统的会话对齐，避免互相覆盖。

## 3. 懒加载

- 弹层类组件（Drawer、Dialog、AlertDialog、Select、Combobox、Menu、Popover）在使用处用 `next/dynamic` 懒加载，或在第一次打开时加载。主页外壳的首屏不加载任何弹层代码（M1 完成标准）。
- Toast 是例外：全局常驻，随根布局加载。

## 4. 底部抽屉

- 手机打卡入口用 Drawer，向下滑动关闭。
- 抽屉里有输入框时包一层 `Drawer.VirtualKeyboardProvider`，软键盘弹出时它会滚动让聚焦的字段可见。
- 用到软键盘高度变量时必须写成 `var(--drawer-keyboard-inset, 0px)`：这个变量只在键盘对齐时才设置，不带默认值的写法在其他时候无效。
- 抽屉里有自己处理横向拖动的区域（例如轮播）时，给它加 `data-base-ui-swipe-ignore="x"`；完全不参与滑动关闭的加 `data-base-ui-swipe-ignore`。
- 弹层打开时，安卓返回键和 APK 壳的返回键先关闭弹层（[routing.md](./routing.md) 第 7 节）。

## 5. 动效

- 弹层、Toast 的进退场用 Base UI 的 `data-starting-style` / `data-ending-style` 写 CSS 过渡，时长和缓动只用 ui-design-system.md 第 5 节的 token。
- 列表增删、页面切换用 React 的 `<ViewTransition>`。浏览器不支持时没有过渡动画，功能照常。
- 不引入任何动效库（[libraries.md](../libraries.md) 互斥禁令）。团团的动画继续用 CSS 类。

## 6. 日历

- `calendar.tsx` 是 React DayPicker 的唯一入口：`weekStartsOn={1}`，中文 locale 从 `react-day-picker/locale/zh-CN` 子路径导入。
- 样式用本项目的 token 重写，不使用它自带的默认配色。已打卡的日子按板块色标记。
- 官网示例的包名写作 `@daypicker/react`，那只是 `react-day-picker` 的转发包。照抄示例时把包名换成 `react-day-picker`（[lessons/react-day-picker.md](../lessons/react-day-picker.md)）。

## 7. 图表

- `src/components/charts/` 自研 SVG：`LineChart`（体重、花费）、`WeekHeatmap`、`Sparkline`；营养素环复用 `ProgressRing`。
- `d3-shape` 只在这个目录里 import，只用 `line`、`area`、`arc` 和 `curveMonotoneX`。比例尺自己写几行线性映射，不引入 `d3-scale`。
- 颜色只用板块色和状态色 token。每个图表都有文字替代：`aria-label`，或可见的数值摘要。

## 8. 头像

- 只用预设头像（团团的不同表情 × 板块配色），没有选择头像时显示昵称首字。不支持上传（ADR-0021）。

## 9. 工具强制（待落地，M1）

| 规则 | 形式 |
|---|---|
| `@base-ui/react`、`@base-ui/react/*` 只能在 `src/components/ui/**` import | ESLint `no-restricted-imports`（按目录覆盖） |
| 禁止从 `@base-ui/react` 包根导入 | ESLint `no-restricted-imports`（`paths`） |
| `react-day-picker` 只能在 `calendar.tsx` import；`d3-shape` 只能在 `src/components/charts/**` | ESLint `no-restricted-imports` |
| 禁止 import [libraries.md](../libraries.md) 互斥禁令里的包 | ESLint `no-restricted-imports`（`patterns`） |

