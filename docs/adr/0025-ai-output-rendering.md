# ADR-0025 — AI 输出渲染：Markdown、KaTeX、Mermaid

- 状态：Proposed
- 日期：2026-11-02
- 决策人：项目负责人（AI 整理，待拍板）

## 背景

Agent 的回复需要全量渲染 Markdown（标题、列表、表格、引用、代码块），并支持 LaTeX 公式（KaTeX）和 Mermaid 图示。目前 `AnswerText` 只支持空行分段和 `**加粗**`，流式时未闭合的语法会渲染跳动。

负责人要求做成一个**低耦合、模块清晰**的独立组件，任何界面都能复用，不只在 Agent 里用。

## 面临的选项

- **Markdown 渲染**：`react-markdown`（生态成熟，默认不渲染原始 HTML）vs Vercel 的 `streamdown`（专为 AI 流式，但依赖 tailwind-merge/clsx——本仓库互斥禁令）vs `marked` + 自写渲染（需要 innerHTML + 自己做 XSS 过滤，与「不用 innerHTML」冲突）。
- **公式**：KaTeX vs MathJax。KaTeX 更快、更适合服务端/离线渲染。
- **图示**：Mermaid vs 自研 SVG 思维导图。
- **代码高亮**：shiki vs 不高亮。

## 决定

1. **`src/components/markdown/`** 独立组件层，对外只暴露 `<Markdown text streaming />`。内部拆 `index / elements / code / math / diagram` 五个文件。
2. **Markdown**：`react-markdown@10` + `remark-gfm`。**流式**用 `remend@1`（零依赖，字符串补全）补全未闭合的 `**`、代码块、公式。不渲染原始 HTML；链接只允许 http/https/mailto、新窗口 + `noopener noreferrer`；**外部图片不加载**，转成「图片：域名」链接（避免把用户 IP 暴露给第三方）。
3. **KaTeX**：`remark-math` + `rehype-katex` + `katex@0.19`。三级懒加载的第二级：文本含 `$`/`$$` 才 `next/dynamic` 加载；字体随制品打包，不走外部 CDN。
4. **Mermaid**：`mermaid@12`，三级懒加载的第三级：代码块是 `mermaid` 才动态加载，`securityLevel: 'strict'`，配色映射 token，渲染失败降级显示源码。**elkjs 布局不启用**；打包后确认 elkjs（EPL/GPL 双许可）不进入任何 chunk 再合并。
5. **代码块不高亮**：等宽字体 + 凹陷底色 + 语言标签 + 复制按钮。shiki 以后需要再按变更规则引入。
6. **提示词白名单**：对比用表格；热量/BMI/运动消耗公式用 KaTeX；计划用 mindmap、流程用 flowchart、时间用 timeline。简单问题不画图。

## 理由

- react-markdown 默认把 HTML 当纯文本，天然防 XSS，不需要额外 sanitize。
- 三级懒加载让普通回复零额外体积（Mermaid 浏览器端约 1–2MB、KaTeX JS 约 270KB），符合「首屏不加载弹层代码」的既有约束。
- 外部图片不加载、协议白名单，与「用户图片永不落盘、隐私最小化」一致。

## 放弃了什么

- `streamdown`：更省事但会间接引入 tailwind-merge/clsx（互斥禁令）。
- `marked` + innerHTML：违背现有「不用 innerHTML」原则，需自写 XSS 过滤。
- 代码语法高亮：打卡场景代码少，先不加依赖。

## 何时重审

- Mermaid 的 elkjs 许可证风险（EPL-2.0 OR GPL-3.0）需在打包分析后确认不随制品分发；若进入 chunk 则改用 `mermaid/mermaid.esm.min` 或放弃流程图类图。
