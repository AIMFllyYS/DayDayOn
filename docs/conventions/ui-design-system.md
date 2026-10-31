# 页面设计规范（设计系统 v0.1）

> 日期：2026-10-31 · 状态：草案，在 Playbook 里评审后定稿
> 实际效果：本地 `pnpm dev` 后打开 <http://localhost:23329/dev/playbook>（只在开发环境可见）
> 本文取代架构基线 7.4 节"在 Pencil 里先定设计 token"的做法：设计稿直接用代码写在 Playbook 里。

## 1. 定位与工作流

视觉方向叫"治愈手账"：把每天的打卡做成一本和朋友一起写的手账。奶油纸底加点阵底纹，重点卡片像贴纸，打卡成功时盖一个章。

**Playbook 是全站可复用设计的唯一来源。**

1. 新的 token、原子组件、交互模式，先在 `/dev/playbook` 加演示。
2. 用右下角的「批注」在区块上写修改意见，需要画图说明时用画板，导出 JSON 放进 `docs/designs/reviews/`（见第 12 节）。
3. 按批注修改，定稿后再用到正式页面。
4. 页面里出现重复的样式组合时，先下沉成组件并在 Playbook 登记，再回到页面使用。

组件分层，上层只能引用下层：

| 层 | 位置 | 内容 |
|---|---|---|
| 设计 token | `src/app/globals.css` | 颜色、字号、圆角、阴影、缓动、动画预设 |
| 原子组件 | `src/components/ui/` | 无业务逻辑：按钮、卡片、徽章、进度、表单、弹层、图标 |
| 布局组件 | `src/components/layout/` | 应用外壳：底部导航、侧栏、顶栏、导航项配置 |
| 吉祥物 | `src/components/mascot/` | 团团的绘制（MascotSvg）、静态版（Mascot）、互动版（InteractivePet） |
| 领域组件 | `src/features/<领域>/components/` | 带业务含义：Agent、打卡、目标 |
| 页面 | `src/app/(app)/…` | 只做组合 |
| Playbook | `src/app/dev/playbook/` | 只展示，正式代码不得引用 |

## 2. 色彩

语义色定义在 `:root`，再由 `@theme inline` 映射成 Tailwind 工具类（`bg-surface`、`text-muted`、`bg-exercise-soft`…）。以后加深色模式只需要覆盖 `:root`。

**底色与文字**

| token | 值 | 用途 |
|---|---|---|
| `background` | `#fff8f0` | 页面底色（奶油纸） |
| `surface` | `#fffdf9` | 卡片、弹层 |
| `surface-sunken` | `#f8eee2` | 凹陷区、进度槽、输入区 |
| `foreground` | `#4a3f35` | 正文、标题（暖棕墨，不用纯黑） |
| `muted` | `#7a6a5b` | 辅助文字，在 background 上对比度约 4.9:1 |
| `subtle` | `#a8998a` | 占位符和装饰，**不用于正文** |
| `border` / `border-strong` | `#eadccb` / `#dcc8b2` | 分隔线 / 次按钮描边 |

**品牌主色：珊瑚** `primary #f28b74`，另有 `primary-hover`、`primary-soft`、`primary-ink`、`on-primary`。主色实底上的文字用 `on-primary`（深棕），因为白字在珊瑚色上对比度只有约 2.4:1，达不到 WCAG AA。

**板块色**：每个板块三档。base 用于图形和进度，soft 用于底色，ink 用于 soft 底上的文字。

| 板块 | base | soft | ink |
|---|---|---|---|
| 运动 `exercise` | `#7cc9a6` 薄荷 | `#e1f4ea` | `#2c6a50` |
| 饮食 `diet` | `#f5c95e` 黄油 | `#fdf2d2` | `#7a5608` |
| 睡眠 `sleep` | `#a99de6` 薰衣草 | `#ece8fb` | `#4a3f8c` |
| 学习 `study` | `#86bde8` 天空 | `#e1eefa` | `#24578a` |
| 自定义 `custom` | `#f2a0b8` 樱花 | `#fce6ed` | `#8c3553` |

**状态色**：`success`、`warning`、`danger`，同样分 base / soft / ink 三档。

规则：

- 组件只引用 token，不写死色值。着色统一走 `src/components/ui/tone.ts` 的 `Tone`，类名写成完整字符串（Tailwind 才扫描得到），不拼接 `bg-${tone}`。
- 板块色只用来表示板块，不挪作他用。板块的中文名和图标从 `moduleMeta` 取。
- 不只靠颜色区分状态，同时给文字或图标。

## 3. 字体

| token | 字体 | 用途 |
|---|---|---|
| `font-sans` | Nunito + 系统中文（苹方 / HarmonyOS Sans / MiSans / 微软雅黑） | 默认字体 |
| `font-display` | Fredoka + 同上 | 品牌字、统计数字、徽章里的数字 |
| `font-mono` | 系统等宽 | 调试信息、工具调用参数 |

- 两个拉丁字体都是 OFL 授权，许可证放在 `src/assets/fonts/`。已子集化为只含拉丁字母、数字和常用标点的 woff2：Nunito 约 31KB（字重 200–1000），Fredoka 约 28KB（字重 400–700，已去掉宽度轴）。由 `src/lib/fonts.ts` 用 `next/font/local` 加载。
- 不用 `next/font/google`：本地开发在国内网络下拉不到 Google Fonts。
- 不下载中文 webfont。中文圆体（如资源圆体）按常用 3500 字子集化后仍超过 1MB，首屏太重。以后如果要做中文标题圆体，只能按页面用到的固定文案做子集。
- 子集化命令（需要 `fonttools` 和 `brotli`）：

```powershell
pyftsubset Nunito.ttf --unicodes="U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201D,U+2022,U+2026,U+00B7,U+2190-2193,U+2212,U+00D7,U+00F7,U+2030" --layout-features="kern,liga,tnum,lnum,pnum,case" --flavor=woff2 --output-file=nunito-latin-var.woff2
python -m fontTools.varLib.instancer Fredoka.ttf wdth=100 wght=400:700 -o Fredoka-wght.ttf
```

**字号阶梯**（语义命名，每档自带行高）：

| 类名 | 字号 / 行高 | 用途 |
|---|---|---|
| `text-display` | 32 / 40 | 页面大标题、关键数字 |
| `text-title` | 24 / 32 | 页面标题（顶栏） |
| `text-heading` | 20 / 28 | 卡片标题、弹层标题 |
| `text-subhead` | 17 / 26 | 列表主文字、小节标题 |
| `text-body` | 16 / 26 | 正文、输入框 |
| `text-caption` | 14 / 21 | 辅助说明 |
| `text-tiny` | 12 / 17 | 徽章、标签、时间戳 |

- 不用 `text-sm`、`text-lg` 这类非语义字号；不用小于 12px 的字。
- 输入框字号固定 16px，否则 iOS Safari 聚焦时会放大页面。
- 标题 bold，正文 regular，强调 semibold。统计数字用 `font-display` + `tabular-nums`。

## 4. 形状与空间

- **圆角**：`sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · 3xl 32 · full`。卡片 2xl，弹层 3xl，输入框 xl，按钮和徽章 full，图标底座 lg–2xl。
- **阴影**（暖棕色、低透明度）：`soft` 列表和次按钮；`card` 默认卡片；`float` 弹层、悬浮导航和悬停态；`sticker` 贴纸卡片（白描边 + 投影，每屏不超过 2 张）；`primary` 主色按钮的彩色投影。
- **间距**：沿用 Tailwind 的 4px 栅格。页面左右边距手机 16px、桌面 32px；卡片内边距 16 / 20px；卡片之间 12px。
- **底纹**：`bg-paper` 是手账点阵纸，只用于应用背景，卡片内部保持纯色。

## 5. 动效

动效用来表达"发生了什么"：按下、出现、完成。所有动画从预设里选，不在组件里临时写 keyframes。

**时长**（放在 `:root`，用 `duration-(--dur-base)` 引用；Tailwind 4 没有 duration 命名空间）

| token | 值 | 用途 |
|---|---|---|
| `--dur-instant` | 80ms | 悬停变色、焦点环 |
| `--dur-fast` | 150ms | 按压、颜色切换 |
| `--dur-base` | 220ms | 开关、分段切换、展开 |
| `--dur-slow` | 360ms | 进场、弹层、进度变化 |
| `--dur-celebrate` | 720ms | 盖章等庆祝动画 |

**缓动**：`ease-standard` 普通过渡；`ease-out-soft` 进场；`ease-in-soft` 退场；`ease-spring` 按压回弹、开关、选中（有过冲）。

**预设**：`animate-fade-in`、`fade-up`、`pop-in`、`sheet-up`、`stamp`、`wiggle`，以及循环类的 `breathe`、`float`、`shimmer`、`spin-slow`。

**统一手感**：

- 按压：`active:scale-[0.96]` + `ease-spring` + `dur-fast`（`Button` 已内置）。
- 可点卡片：悬停上浮 2px 并换成 `float` 阴影，按下缩到 0.98（`Card interactive`）。
- 打卡成功：盖章 + 吉祥物欢呼，只在完成打卡的那一刻出现。

规则：

- 只动 `transform` 和 `opacity`（进度条宽度、圆环描边除外）。
- 列表进场错开 60ms，最多错开 6 个。
- 循环动画只用于"正在进行"的状态，不做装饰性循环。一屏不同时播放两个庆祝动画。
- 动画期间按钮必须可点，动画不能阻塞操作。
- 系统开启"减少动态效果"时，`globals.css` 把所有动画和过渡缩短到 1ms，只保留最终状态。

动效全部用 CSS 实现，不引入动效库（[ADR-0005](../adr/0005-motion.md)，2026-10-31 拍板，取代架构基线 7.1 选 Motion 的结论）。弹层进退场用 Base UI 的 `data-starting-style` / `data-ending-style`，列表增删和页面切换用 React `<ViewTransition>`，写法见 [ui-primitives.md](./ui-primitives.md) 第 5 节。

## 6. 原子组件

| 组件 | 文件 | 要点 |
|---|---|---|
| `Button` / `IconButton` | `button.tsx` | 变体 primary / secondary / soft / ghost / danger；md 高 44px 是默认；`loading` 保持宽度；图标按钮必须传 `label` |
| `Card` / `CardHeader` | `card.tsx` | 变体 plain / sticker / sunken / outline；`interactive` 加悬停和按压 |
| `Badge` / `IconTile` | `badge.tsx` | soft 底 + ink 字；`dot` 表示状态 |
| `ProgressBar` / `ProgressRing` / `StepProgress` | `progress.tsx` | 都有 `role="progressbar"` 和 `label`；`active` 表示进行中；分段进度用于一天多次的目标 |
| `Field` / `Input` / `Textarea` | `field.tsx` | 错误文案替换提示；`aria-invalid` 驱动错误样式 |
| `Switch` | `switch.tsx` | `role="switch"`，外层 44px 触控区 |
| `SegmentedControl` | `segmented-control.tsx` | 页面内视图切换，方向键可切换 |
| `Rating` | `rating.tsx` | 满意度 1–5，选中项用板块色 |
| `MenuList` / `MenuItem` | `menu-list.tsx` | 设置列表；`danger` 用于退出登录、注销 |
| `Sheet` | `sheet.tsx` | 原生 `<dialog>`：手机底部滑出，≥768px 居中；Esc、点遮罩关闭；打开时锁住背景滚动 |
| `Avatar` / `AvatarStack` | `avatar.tsx` | 暂时只显示昵称首字；`ring` 表示连续打卡中 |
| `Stamp` | `stamp.tsx` | 打卡印章，`animate` 只在刚完成时播放 |
| `Skeleton` | `skeleton.tsx` | 形状接近真实内容，不用转圈代替 |
| `Icon` | `icon.tsx` | 手绘双层图标，见下文；当前态描边加粗到 2.4px |

- 组件对外的 `className` 只用来补充布局（间距、宽度）。`cn()` 目前不合并冲突类名，不要用它覆盖组件的颜色和尺寸。
- 没有 hooks 的组件不加 `'use client'`，由使用它的客户端组件传入事件处理函数；只有 `Sheet` 这类用到 effect 的组件是客户端组件。

### 图标

- 风格叫"错版印刷"：一层 2px 圆头描边，另一层是同色 22% 透明的色块，向右下错开约 1px，像套色没对齐的手账印刷。尺寸小于 16px 时只画描边（`lineOnly` 也可以强制只画描边）。
- 全部手绘，**不用 lucide、Heroicons 等通用图标库的路径**：通用图标太常见，和"手账"气质不搭。新增图标在 `icon.tsx` 里画，先在 Playbook 的图标区和已有图标放在一起比对。
- 板块图标是小插画而不是几何符号：运动是跑鞋、饮食是盛满的碗和筷子、睡眠是月亮和星星、学习是打开的本子和铅笔、自定义是闪光贴纸。
- 主导航图标同理：主页是带爱心窗的小房子、待办是夹着便签的清单、排行是领奖台和星星。

## 7. 导航与布局

| 视口宽度 | 主导航 | 打卡入口 |
|---|---|---|
| < 768px | 底部悬浮胶囊导航：主页 / 待办 / ＋ / 排行 / 我的 | "＋"打开底部弹层 |
| 768–1023px | 左侧窄栏，只显示图标 | 侧栏顶部"＋"，打开居中对话框 |
| ≥ 1024px | 左侧宽栏：品牌、图标 + 文字、AI 额度 | 侧栏顶部"打卡"按钮 |

- `BottomNav`、`SideNav`、`TopBar` 本身不定位，由应用外壳负责 `fixed` / `sticky` 和安全区（`--safe-top`、`--safe-bottom`）。
- 导航项只在 `src/components/layout/nav-items.ts` 定义一次，手机和桌面共用；高亮规则见 `isNavActive()`（主页精确匹配，其余按前缀匹配）。
- 一级页面显示主导航；二级页面隐藏底栏，顶栏带返回按钮。导航文字和页面标题一致，当前项加 `aria-current="page"`。
- 弹层里不再打开弹层。底栏之外的悬浮按钮不放在右下角。

## 8. Agent 组件

位于 `src/features/agent/`。一次助手回复里的思考、工具调用、文字输出本质上是同一个回合的不同 part，用一个 `<AgentTurn>` 呈现，不再拆成推理链、工具卡片、文字气泡三个独立组件。

**数据结构**（`types.ts`）对齐 AI SDK UIMessage 的 parts：`step-start`、`reasoning`、`tool`、`text`、`source`，按到达顺序排列。ToolLoopAgent 每一步是"思考 → 发出一个或多个工具调用（同一步里的多个调用是并行的）→ 拿到结果进入下一步"，`turn.ts` 按 `step-start` 把过程分成步。接入 `ai` 包时只写一层映射，并以 `node_modules/ai/docs/` 为准核对 state 取值。

**回合结构**（从上到下）：

| 区块 | 来源 | 规则 |
|---|---|---|
| 活动条 `ActivityTrail` | reasoning + tool | 默认收起，只占一行：左边说明正在做什么（"正在搜索等 3 件事"）或完成摘要（"12 个工具 · 11 秒"），右边是工具小方块。同一步并行的方块叠在一起，步与步之间留空；只显示最近 5 个，其余折成 +N；失败的方块带红点。点开是按步排列的时间线：思考是一段灰色小字（两行截断，点击展开），每个工具一行（图标、中文名、摘要、耗时），点行看参数和结果 |
| 正文 `AnswerText` | text | 回答是视觉重点。流式输出时末尾有闪烁光标；只支持空行分段和 `**加粗**`，按纯文本渲染，不用 innerHTML |
| 产物 | 业务组件 | AI 草稿卡、图表等，放在正文后面 |
| 来源 | source | 联网时引用的网页，去重后编号，显示域名 |
| 错误 | status = error | 原因 + 重试按钮 |

头像用团团：思考中 `thinking`，完成 `happy`，出错 `sad`。

**其他组件**

| 组件 | 规则 |
|---|---|
| `UserMessage` | 用户消息，主色浅底靠右；附件只写说明（"1 张照片 · 识别后不保存"），不显示原图 |
| `AiDraftCard` AI 草稿 | AI 结果先是草稿，主按钮永远是"确认记录"，不自动保存。把握度低于 0.6 时提示核对并提供"手动填写"；热量、睡眠类结果标注"估算结果，非医疗建议" |
| `QuotaMeter` AI 额度 | 显示"还剩多少"；金额以整数微元传入，展示时才换算成元；剩余低于 20% 用警告色 |
| `ThinkingDots` | 生成中的三个呼吸点，颜色跟随文字 |

**工具登记**：每个工具在 `tool-meta.ts` 写中文名（"联网搜索"）、进行时说法（"正在搜索"）、图标和色调。没登记的显示为"工具调用"。

规则：

- 不要给每个工具一张大卡片；工具再多，收起时也只占一行。
- 失败的工具直接显示原因和降级方案（"网页打不开，已改用搜索结果"），不需要用户点开。
- 过程里不显示 token 数、模型名等技术细节。
- 不展示用户上传的原图（图片不落盘，见 ADR-0002 第 4 节）。

## 9. 吉祥物团团

头顶小芽、右侧别着樱花粉波点蝴蝶结的糯米团子。代码在 `src/components/mascot/`：

| 文件 | 作用 |
|---|---|
| `mascot-svg.tsx` | 只负责按参数画出一帧：`mood`（9 种表情）、`look`（视线 -1 到 1）、`blink`、`blush`（腮红 0–1）、`arm`（9 种姿势：rest / wave / up / hug / cover / think / hold / startle / droop，不传时按表情自动选）。手臂画在身体前面、绕肩膀转动，所以举手、挥手时不会被身体挡住。能对应 token 的颜色都用 `var(--…)` |
| `mascot.tsx` | 静态版：空状态、对话头像、插画位 |
| `interactive-pet.tsx` | 互动版：手势、动作、说话气泡、粒子特效；`ref.play(action)` 供外部触发，`onEvent` 回报用户做了什么 |

表情：开心、欢呼、喜欢、害羞、吃东西、思考中、吓一跳、犯困、失落。

手势：

| 操作 | 反应 |
|---|---|
| 悬停 | 眼睛跟着指针，身体朝指针微微倾斜 |
| 点击 | 蹦一下，说句话 |
| 双击（300ms 内两次点击） | 转圈，冒星星 |
| 长按（450ms） | 越压越扁地蓄力，松手大跳 |
| 来回抚摸（按住移动累计 140px） | 害羞脸红，冒爱心 |
| 把零食拖给它 | 吧唧吧唧吃东西 |
| 15 秒不理 | 睡着冒 z，点一下吓醒 |

外部动作：挥手、蹦一下、大跳、转圈（绕竖轴横向转）、点头、摇头、害羞（缩成一小团 + 捂脸）、比心、吃东西、思考、吓一跳、庆祝打卡、睡觉。动画都是 `globals.css` 里的 `pet-*` 预设。

规则：

- 只对用户的操作做出反应；眨眼和呼吸是唯一的自发动作。
- 说话气泡不超过 8 个字，1.8 秒后消失。
- 互动版只出现在「我的」页和打卡成功时；列表、头像用静态版。一屏不放两只互动团团。
- 不遮挡内容或按钮；不用团团传达错误详情，错误说明写在文字里。

## 10. 可访问性

- 可点区域不小于 44×44px。
- 文字对比度不低于 4.5:1（大字 3:1）。`subtle` 色只用于占位符和装饰。
- 图标按钮、进度条、开关、评分、团团都有可读名称。
- 焦点环统一由 `:focus-visible` 提供（3px 主色半透明描边），组件不要去掉。
- 遵守"减少动态效果"系统设置（第 5 节）。

## 11. 文案语气

- 像朋友一样说话，简短、具体、不说教。例如"今天还没有待办""识别好了！确认一下数值吧～"。
- 错误提示说明原因和下一步，例如"网页打不开（超时 10 秒），已改用估算值"。
- 不用感叹号堆叠，不用网络流行语，不用 emoji 代替图标。

## 12. 批注与画板

`/dev` 下的所有页面都挂着批注工具（`src/app/dev/_annotate/`），右下角三个按钮：「批注」、画板、列表。

**批注**

1. 点「批注」或按 `Alt+Shift+A` 进入拾取模式，悬停会高亮最近的 `data-ann` 区块。
2. 点击区块，写下意见，选类型（视觉 / 布局 / 交互 / 动效 / 文案 / 缺陷）和优先级（P0 必须改 / P1 应该改 / P2 可以改），`Ctrl+Enter` 保存。编辑框里可以点「画个草图」，草图会挂在这条批注上。
3. 页面上会出现编号图钉；列表里可以定位、编辑、看草图、标记解决、删除，可以在"本页 / 全部"之间切换。
4. 「导出 JSON」下载 `annotations-YYYYMMDD-HHmm.json`，放进 `docs/designs/reviews/`。也可以复制到剪贴板，或导入别人导出的文件（按 id 合并）。

**画板**（`sketch/`）：用来说明"想要什么样子"，比文字批注更直接。

- 画框：手机 390 / 桌面 1280 / 自由画布，坐标就是真实像素。
- 工具：选择（V）、画笔（P）、矩形（R）、椭圆（O）、箭头（A）、文字（T）、橡皮（E）；5 种颜色、3 种粗细；`Ctrl+Z` / `Ctrl+Shift+Z` 撤销重做，`Delete` 删除选中项。
- **引用组件**：右侧组件库里点一下，就把真实组件（按钮、卡片、进度条、底部导航、侧栏、团团、AI 回复、草稿卡等）放进画框，可以拖动、拖右下角改尺寸、改属性（文字、变体、色调），还能写一句说明显示在组件上方。组件登记在 `sketch/registry.tsx`，新增原子组件时顺手登记。
- 层级：组件在下层，笔迹和图形在中层，文字在上层。
- 从右下角的画板按钮直接打开时，保存后会弹出编辑框，草图挂在"整页"这条批注上。
- **截图**：批注列表底部「导入」和「清空」之间的「截图」。点击后浏览器会询问共享哪个标签页（选当前标签页），然后拖框选区域，截图自动放进新画板，可以直接在上面画圈、写字、摆组件。截图时批注界面全部隐藏，不会被截进去。实现用浏览器自带的 `getDisplayMedia`，不引入 html2canvas（它对新 CSS 支持不全，截出来和真实页面不一样）。截图最长边压到 1600px，存成 WebP。
- 「导出 SVG」把当前草图下载成独立 SVG（组件画成带名称和属性的虚线框），方便放进文档。

**存储与导出格式**

- 批注和草图分别存在 localStorage 的 `daydayon:annotations:v1`、`daydayon:sketches:v1`，换浏览器或清缓存会丢失，评审完及时导出。删除批注会一并删除它的草图。截图比较占空间，localStorage 约 5MB 满了会提示先导出。
- 导出格式 `schema: "daydayon.annotations/v2"`：`items` 是批注，`sketches` 是被引用的草图。每条批注记录路由、视口宽高和 DPR、区块（`data-ann`、CSS 路径、标签、前 80 个字、文档坐标下的位置和尺寸）、点击点在区块内的相对坐标、内容、类型、优先级、状态、`sketchId` 和时间。每张草图记录画框和元素列表；组件元素用 `ref` + `props` 精确描述用了哪个组件、什么参数。导入时 v1、v2 都接受。

给新的演示区块加 `data-ann="playbook.<页面>.<区块>"`，批注才能稳定定位；没有 `data-ann` 时退回 CSS 路径，页面结构变了可能对不上。

## 13. 待定事项

> 2026-10-31 起，下表中涉及引入第三方库的事项统一在 demo-init Phase 3 对齐，结论以 [docs/libraries.md](../libraries.md) 为准。负责人已于 2026-10-31 拍板（ADR-0004 至 0020），第三方原语的接入方式见 [ui-primitives.md](./ui-primitives.md)。

| 事项 | 现状 | 何时处理 |
|---|---|---|
| 交互原语 | 已定：Base UI（ADR-0004），不用 shadcn/ui、Radix。`Sheet` 目前仍是原生 `<dialog>`，只有进场动画 | M1：安装 Base UI 后改为 Drawer / Dialog，补齐下拉、组合框、菜单等 |
| 图标库 | 不引入。2026-10-31 决定所有图标手绘（第 6 节） | — |
| clsx + tailwind-merge | 已定不引入：`cn()` 只做拼接（tailwind-merge 会吞掉语义字号，见 libraries.md） | — |
| 动效库 | 已定不引入（ADR-0005） | — |
| 团团形象、logo | 团团已细化（第 9 节），logo 仍是占位 | 设计评审后定稿；CSS 动画不够用时走 libraries.md 的变更规则（Rive、Lottie 目前在禁令里） |
| 深色模式 | 未做；token 已分层 | 浅色定稿后 |
| Prettier 类名排序 | `prettier-plugin-tailwindcss` 没有配置 `tailwindStylesheet`，自定义 token 类会被排到最前 | 在 `.prettierrc.json` 加 `"tailwindStylesheet": "./src/app/globals.css"` |
