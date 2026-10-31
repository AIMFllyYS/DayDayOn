# ADR-0004：交互原语——Base UI（@base-ui/react）

- 状态：Accepted（负责人 2026-10-31 拍板：Phase 3 的 17 项建议全部采纳）
- 日期：2026-10-31
- 决策人：项目负责人（AI 提供分析）
- 对比页：[docs/designs/library-showcase/01-interaction-primitives.html](../designs/library-showcase/01-interaction-primitives.html)

## 背景

- 底部抽屉：手机打卡入口，要能下滑关闭，里面的表单遇到软键盘不被遮挡
- 居中对话框、确认对话框（删除、退出登录、注销）
- 下拉菜单、Popover
- 下拉选择、可搜索组合框（运动品类可自定义，科目标签、自定义字段的多选）
- 滑块（饮食份量）、数字输入（体重一位小数、时长）
- 验证码输入（邮箱 6 位验证码）
- 焦点管理、键盘操作、读屏可用

先定的层：选"无样式原语 + 本项目自有样式"。带样式的全家桶（shadcn/ui、HeroUI）会带来第二套按钮和卡片，和已有 15 个按 token 写好的原子组件冲突；完全自研的话，抽屉手势、iOS 软键盘、焦点圈定、组合框的无障碍都要自己实现，风险高。

## 面临的选项

- **Base UI**（`@base-ui/react`）：推荐。盘点里的原语一个库全部覆盖，包括 vaul 停更以后底部抽屉的替代方案。体积偏大的问题用两条规则处理：只从 src/components/ui/ 按子路径导入；弹层类组件在用户点开时才加载。
- **Radix Primitives**（`radix-ui`）：备选。单组件更小，但缺的三样（抽屉、组合框、数字输入）要靠额外的库补，其中一个已经停更。
- **React Aria Components**（`react-aria-components`）：备选。能把日期选择器一并解决，但实测组合体积和 Base UI 相当，还多一套日期类型，Toast 未稳定。
- **自研 + 原生**：不采用。0 KB，但工作量和无障碍风险都落在自己身上，不划算。
- **Headless UI**（`@headlessui/react`）：不采用。缺口比 Radix 还多。

## 决定

Base UI（@base-ui/react），版本 1.9.0。

- 封装层入口：src/components/ui/（每个原语一个封装文件；业务代码禁止直接 import @base-ui/react）
- 只在 src/components/ui/ 里按子路径导入 @base-ui/react/<组件>，不从包根导入
- 弹层类组件（Drawer、Dialog、AlertDialog、Select、Combobox、Menu、Popover）在使用处用 next/dynamic 懒加载，或在用户第一次点开时加载
- 现有 Sheet 改为基于 Base UI 的 Drawer（手机）/ Dialog（≥768px），对外接口不变
- className 拼接继续用自写的 cn()，不引入 tailwind-merge：实测默认配置会把 "text-body text-muted" 合并成 "text-muted"，把语义字号吞掉

## 理由

盘点里的原语一个库全部覆盖，包括 vaul 停更以后底部抽屉的替代方案。体积偏大的问题用两条规则处理：只从 src/components/ui/ 按子路径导入；弹层类组件在用户点开时才加载。

- Drawer 基于 Dialog，加了滑动关闭、吸附点和 VirtualKeyboardProvider（底部抽屉里有输入框时处理软键盘）；1.3.0 起转为稳定版
- Combobox / Autocomplete、Select（支持多选）、Menu、Popover、AlertDialog、Slider、NumberField、Tabs、Checkbox
- OTPField 已转为稳定版，正好用于邮箱验证码
- Toast（见关注点 3）和 Field / Form（见关注点 6）也在同一个包里
- 所有组件在一个包里，可按子路径导入、可 tree-shaking；shadcn/ui 官方以它为底座

## 放弃了什么

- Radix Primitives：缺抽屉、组合框、数字输入，补齐要用已停更的 vaul
- React Aria Components：体积相当，日期类型与 date-fns 重复，Toast 未稳定
- vaul：README 写明不再维护
- shadcn/ui、HeroUI：带样式的全家桶，会和现有原子组件形成两套外观
- 自研：抽屉手势、软键盘、组合框无障碍的成本和风险过高

已知代价：单组件体积比 Radix 大；需要在 Playbook 里把每个原语重新套上本项目样式。

## 何时重审

- Base UI 公开 Calendar 组件时（评估替代关注点 4 的 react-day-picker）
- 移动端抽屉出现长期未修的问题时
- 首屏 JS 超出预算时
