# ADR-0006：提示消息——Base UI Toast

- 状态：Accepted（负责人 2026-10-31 拍板：Phase 3 的 17 项建议全部采纳）
- 日期：2026-10-31
- 决策人：项目负责人（AI 提供分析）
- 对比页：[docs/designs/library-showcase/03-toast.html](../designs/library-showcase/03-toast.html)

## 背景

- 打卡成功、保存失败
- 删除待办后"撤销"
- AI 识别"处理中 → 完成 / 失败"
- 在非 React 代码里也能调用（例如请求封装里统一提示错误）

先定的层：跟随交互原语的所有者，避免出现第二套弹层、焦点和动画体系。

## 面临的选项

- **Base UI Toast**（`@base-ui/react`）：推荐。覆盖全部需求，和关注点 1 是同一个依赖，不新增包。
- **Sonner**（`sonner`）：备选。更小、默认效果好，但会多一个依赖和一套独立的样式与动画写法。
- **react-hot-toast**（`react-hot-toast`）：不采用。同样是额外依赖，能力不如前两者。

## 决定

Base UI Toast，版本 跟随 @base-ui/react 1.9.0。

- 封装层入口：src/components/ui/toast.tsx（导出 Toaster 和全局 toast 管理器）
- 全站只有一个 Toast.Provider，放在根布局
- 错误提示的文案从统一的错误码映射表取（见接口层规范）

## 理由

覆盖全部需求，和关注点 1 是同一个依赖，不新增包。

- 全局 toastManager：在 React 树之外也能 add / close / update / promise
- promise 三态（loading / success / error）、actionProps 撤销按钮、按 id 更新
- 滑动关闭、数量上限、F6 跳到提示区域

## 放弃了什么

- Sonner：多一个依赖和一套样式体系
- react-hot-toast：同上，能力更弱

已知代价：堆叠动画要自己用 CSS 变量写。

## 何时重审

- Base UI Toast 出现无法绕过的问题时
