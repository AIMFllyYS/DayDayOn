# ADR-0005：动效——不引入动效库：CSS 预设 + React <ViewTransition>

- 状态：Accepted（负责人 2026-10-31 拍板：Phase 3 的 17 项建议全部采纳）
- 日期：2026-10-31
- 决策人：项目负责人（AI 提供分析）
- 对比页：[docs/designs/library-showcase/02-motion.html](../designs/library-showcase/02-motion.html)

## 背景

- 按钮按压回弹、开关和勾选
- 弹层进出场
- 列表增删（待办勾选后移走）
- 打卡成功盖章、团团欢呼
- 团团的 13 种动作
- 页面切换

先定的层：本项目是组件微交互和庆祝动画，不是滚动叙事长卷。先看 CSS 和浏览器原生能力够不够，不够再上 JS 动画库。

## 面临的选项

- **CSS 预设 + React <ViewTransition>**：推荐。覆盖全部需求，不增加任何依赖。
- **Motion**（`motion`）：备选。能力最强，但本项目需要的手势已经由 Base UI 提供，列表和页面过渡由 ViewTransition 提供，剩下的用不到。
- **Rive**（`@rive-app/react-canvas`）：不采用。团团目前是 SVG + CSS。等团团需要复杂的状态机动画、并且有人用 Rive 编辑器做素材时再评估。
- **Lottie**（`lottie-react`）：不采用。整包约 191 KB，本项目没有 AE 素材。
- **AutoAnimate**（`@formkit/auto-animate`）：不采用。和 ViewTransition 能力重叠，12 个月内只有 1 次发布。

## 决定

不引入动效库：CSS 预设 + React <ViewTransition>。

- 封装层入口：src/app/globals.css（预设）；列表和页面过渡的写法在 Playbook 动效页示范
- 只动 transform 和 opacity（进度条宽度、圆环描边除外）
- 弹层和 Toast 的进退场用 Base UI 的 data-starting-style / data-ending-style 写 CSS
- 列表增删和页面切换用 <ViewTransition>；不在组件里临时写 keyframes

## 理由

覆盖全部需求，不增加任何依赖。

- globals.css 里已有 fade-up、pop-in、sheet-up、stamp、wiggle 等预设和"减少动态效果"适配；团团的动作也是 CSS 动画类（interactive-pet.tsx）
- Base UI 弹层和 Toast 提供 data-starting-style / data-ending-style，进退场用 CSS 写
- React 19.3 内置 <ViewTransition> 和 addTransitionType；Next 16.4 App Router 无需配置即可使用（node_modules/next/dist/docs 的 View transitions 指南）
- 浏览器不支持时页面照常工作，只是没有过渡动画

## 放弃了什么

- Motion：需要的手势和过渡已有 Base UI 与 ViewTransition 覆盖
- Rive / Lottie：没有对应的动画素材和制作流程
- AutoAnimate：与 ViewTransition 重叠

已知代价：没有弹簧物理；Safari 上的部分过渡效果可能不同。

## 何时重审

- 需要拖拽排序（自定义仪表盘，v0.2）或弹簧物理时
- 团团需要状态机动画时（评估 Rive）
