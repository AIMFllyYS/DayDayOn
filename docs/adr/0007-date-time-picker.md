# ADR-0007：日期与时间选择——输入：原生控件；日历：React DayPicker

- 状态：Accepted（负责人 2026-10-31 拍板：Phase 3 的 17 项建议全部采纳）
- 日期：2026-10-31
- 决策人：项目负责人（AI 提供分析）
- 对比页：[docs/designs/library-showcase/04-date-time-picker.html](../designs/library-showcase/04-date-time-picker.html)

## 背景

- 睡眠：入睡和起床时间，常常跨午夜
- 待办 DDL：日期 + 时间
- 补卡：选过去的某一天
- 打卡日历：月视图，标出已打卡的日子（主页、目标详情）

先定的层：输入和展示分开选。输入时间、日期用原生控件：手机上会弹系统的滚轮或日历，最顺手。可见的日历网格需要自定义每一天的样式，用库。

## 面临的选项

- **原生 input（date / time / datetime-local）+ 自研时间区间**：推荐。输入场景足够，零依赖。
- **React DayPicker**（`react-day-picker`）：推荐。负责"看得见的日历"，体积里的 date-fns 部分和关注点 5 去重。
- **React Aria DatePicker / TimeField**（`react-aria-components`）：备选。最完整，但要为日期多引入一个原语库。
- **Base UI Calendar**：不采用。还不能用。

## 决定

输入：原生控件；日历：React DayPicker，版本 react-day-picker 10.0.2。

- 封装层入口：src/components/ui/calendar.tsx、date-field.tsx、time-range-field.tsx
- 时间输入只用原生控件，外框套 Field
- 日历只经 calendar.tsx 使用，不在业务代码里直接 import react-day-picker

## 理由

输入场景足够，零依赖。

- iOS / Android 弹出系统选择器
- 外框用现有 Field 组件统一样式
- 睡眠区间：两个 time 输入，起床早于入睡时自动算作次日，同时显示时长

## 放弃了什么

- React Aria：多一套日期类型和原语库
- Base UI Calendar：尚未公开

已知代价：原生弹出层样式不可定制；React DayPicker 是单人维护。

## 何时重审

- Base UI 公开 Calendar 时，评估合并到关注点 1 的所有者
- React DayPicker 长期无人维护时
