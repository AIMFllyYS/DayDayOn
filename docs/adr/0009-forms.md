# ADR-0009：表单与动态表单——不引入表单库：Base UI Form / Field + zod

- 状态：Accepted（负责人 2026-10-31 拍板：Phase 3 的 17 项建议全部采纳）
- 日期：2026-10-31
- 决策人：项目负责人（AI 提供分析）
- 对比页：[docs/designs/library-showcase/06-forms.html](../designs/library-showcase/06-forms.html)

## 背景

- 新人引导、目标设置、五类打卡表单、体重与满意度
- 自定义目标：字段编辑器（增删字段、选类型）+ 按字段 schema 渲染的动态表单
- 校验错误和服务端返回的错误显示在对应字段下

先定的层：先问：表单状态要不要交给一个库管？本项目的表单都是几个到十几个字段，最复杂的是按 schema 渲染的动态表单，而 schema 是自己定义的。项目开了 React Compiler，库的写法要和编译器兼容。

## 面临的选项

- **Base UI Form / Field + zod**（`@base-ui/react`）：推荐。覆盖全部需求；状态是普通 React state，和 React Compiler 没有冲突。
- **React Hook Form**（`react-hook-form`）：不采用。能用，但要额外记住哪些 API 和编译器冲突。
- **TanStack Form**（`@tanstack/react-form`）：备选。等 v2 稳定后再评估。

## 决定

不引入表单库：Base UI Form / Field + zod，版本 跟随 @base-ui/react；zod 见关注点 10。

- 封装层入口：src/components/ui/field.tsx（现有）改为基于 Base UI Field；动态表单 src/features/goal/components/schema-form.tsx
- 表单提交时用同一份 zod schema 校验，把 issue 转成 { 字段名: 错误 } 交给 Form 的 errors
- 动态表单的字段类型是固定清单（数字、文本、单选、多选、布尔、时长、评分），渲染和校验都从这份清单生成

## 理由

覆盖全部需求；状态是普通 React state，和 React Compiler 没有冲突。

- onFormSubmit 直接拿到字段值对象
- validate 支持同步和异步，validationMode 可选提交时、失焦、变更时
- errors 属性合并服务端返回的字段错误，字段改动后自动清除
- 和关注点 1 是同一个依赖

## 放弃了什么

- React Hook Form：部分 API 与 React Compiler 冲突
- TanStack Form：v2 将改 API，当前处于 alpha

已知代价：字段数组、脏值跟踪等需要时自己写。

## 何时重审

- 出现多步骤、大量字段数组的表单时
- TanStack Form v2 稳定时
