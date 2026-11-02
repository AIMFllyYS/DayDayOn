# 页面设计规范（设计系统 v0.2）

> 日期：2026-10-31 · 2026-11-01 按第一轮批注（[reviews/annotations-20261101-1141.json](../designs/reviews/annotations-20261101-1141.json)）修订 · 状态：草案，在 Playbook 里评审后定稿
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
| 原子组件 | `src/components/ui/` | 无业务逻辑：按钮、卡片、徽章、进度、表单控件、弹层、反馈、日历、图标 |
| 图表组件 | `src/components/charts/` | 热力图（Heatmap）、折线图（LineChart）、柱状图（BarChart）与线性比例尺 |
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

**品牌主色：跟随主题，默认奶茶焦糖** `primary #93603f`，另有 `primary-hover`、`primary-soft`、`primary-ink`、`on-primary`（奶油色 `#fffaf3`）。

2026-11-01 评审结论：原来的珊瑚实底（`#f28b74` + 深棕字）大面积铺开显得廉价，而徽章的"浅底 + 同色深字"很舒服。配色原则因此改为：

1. 面积越大，颜色越要退后。高饱和色只出现在小面积的字、图标、进度上。
2. 实底只用深而柔的低饱和色，上面用奶油色字，对比度 ≥ 4.8:1。
3. 同一色相分浅（soft）/ 中（base）/ 深（ink）三档。一个区域只有一个实底主按钮，其他操作用 `soft`、`secondary` 或 `ghost`。

**主题色**：用户可选，只换主色这一组（按钮、当前态、开关、焦点环、主色投影），板块色、状态色、底色不随主题变。色值在 `globals.css` 的 `[data-theme]` 块里，id 和名称在 `src/lib/theme.ts`，选择器是 `ThemePicker`。偏好暂存在 localStorage（`daydayon:theme:v1`），接入账号后改存用户设置，并在根布局提前写 `data-theme` 避免闪一下默认色。任何元素加 `data-theme` 都能局部换色。

| 主题 | primary | soft | ink | 奶油字对比度 |
|---|---|---|---|---|
| `caramel` 奶茶焦糖（默认） | `#93603f` | `#f3e2cf` | `#6b3f26` | 5.1 |
| `terracotta` 陶土红 | `#b0533f` | `#fbe1d8` | `#873524` | 4.9 |
| `matcha` 抹茶绿 | `#4a7a52` | `#e0eddb` | `#2e5835` | 4.8 |
| `haze` 雾霾蓝 | `#51709b` | `#e0e8f4` | `#2c4a74` | 4.9 |
| `berry` 莓果紫 | `#a5557a` | `#f6e0e9` | `#7b3456` | 4.8 |

吉祥物的腮红、嘴巴是插画专用色，不引用主色（否则换成抹茶绿时腮红会变绿）。

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

**预设**：`animate-fade-in`、`fade-out`、`fade-up`、`pop-in`、`sheet-up`、`sheet-down`、`stamp`、`wiggle`、`shake`、`wave-bob`、`confetti`，以及循环类的 `breathe`、`float`、`shimmer`、`spin-slow`。

**统一手感**：

- 按压：`active:scale-[0.96]` + `ease-spring` + `dur-fast`（`Button` 已内置）。
- 可点卡片：悬停上浮 2px 并换成 `float` 阴影，按下缩到 0.98（`Card interactive`）。
- 打卡成功：盖章 + 吉祥物欢呼，只在完成打卡的那一刻出现。
- 评分反馈（`Rating`）：很糟整组抖一下（支持的手机轻震 40ms）、不太好表情摇一摇、一般五个表情依次起伏、不错 / 超棒从选中项撒彩纸（板块色）。只在用户点击时播放。

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
| `Button` / `IconButton` | `button.tsx` | 变体 primary / secondary / soft / ghost / danger；md 高 44px 是默认；`loading` 保持宽度；图标按钮必须传 `label`。primary 只给一个区域里唯一的主操作，实底上的图标只画描边 |
| `Card` / `CardHeader` | `card.tsx` | 变体 plain / sticker / sunken / outline；`interactive` 加悬停和按压 |
| `Badge` / `IconTile` | `badge.tsx` | soft 底 + ink 字；`dot` 表示状态 |
| `ProgressBar` / `ProgressRing` / `StepProgress` | `progress.tsx` | 都有 `role="progressbar"` 和 `label`；`active` 表示进行中；分段进度用于一天多次的目标 |
| `Field` / `Input` / `Textarea` | `field.tsx` | Base UI Field / Input：标签、提示、错误自动关联；错误文案替换提示；`aria-invalid` 驱动错误样式 |
| `Form` | `form.tsx` | Base UI Form：接收客户端 zod `fieldErrors` 或服务端 `fields`，对应 `name` 的字段改动后自动清除错误 |
| `Select` / `Combobox` | `select.tsx`、`combobox.tsx` | Base UI Select / Combobox：单选下拉与可筛选/可新建（`creatable`）组合框；弹层类页面级懒加载 |
| `NumberField` | `number-field.tsx` | Base UI NumberField：步进按钮 + 滚轮微调 + 单位后缀；关闭原生 HTML5 `step` 校验，范围由 zod 把关 |
| `OTPField` | `otp-field.tsx` | 6 位数字验证码输入：支持粘贴、自动跳格、退格回退，填满自动触发 `onComplete` |
| `Checkbox` | `checkbox.tsx` | Base UI Checkbox：待办勾选与多选框，外层保证 44×44px 触控区 |
| `DateField` / `TimeField` / `TimeRangeField` | `date-field.tsx`、`time-field.tsx`、`time-range-field.tsx` | 原生日期与时间输入（ADR-0007）；`TimeRangeField` 跨午夜自动标"次日"并实时计算睡眠时长 |
| `ImagePicker` | `image-picker.tsx` | 选图 / 拍照 + 内存 Canvas 压缩预览（最长边 ≤ 1280px，WebP/JPEG ≤ 800KB），不落盘 |
| `Switch` | `switch.tsx` | Base UI Switch，`role="switch"`，外层 44px 触控区 |
| `SegmentedControl` | `segmented-control.tsx` | Base UI Tabs 驱动的页面内视图切换，方向键可切换 |
| `Rating` | `rating.tsx` | 满意度 1–5，选中项用板块色；选中时有情绪反馈（第 5 节），`feedback={false}` 关闭 |
| `MenuList` / `MenuItem` | `menu-list.tsx` | 设置列表；`danger` 用于退出登录、注销 |
| `Sheet` | `sheet.tsx` | Base UI Drawer（`<768px` 底部抽屉，支持下滑关闭）+ Dialog（`≥768px` 居中对话框），打开时锁住背景滚动 |
| `ConfirmDialog` | `confirm-dialog.tsx` | Base UI AlertDialog：高危或丢数据操作二次确认（点遮罩不关闭），支持异步 `onConfirm` |
| `Popover` / `Tooltip` / `Menu` / `Collapsible` | `popover.tsx`、`tooltip.tsx`、`menu.tsx`、`collapsible.tsx` | Base UI 浮层、行内操作菜单与折叠面板，统一 `z-50` 与 `data-starting-style` / `data-ending-style` 过渡 |
| `ToastViewport` / `toast` | `toast.tsx` | Base UI Toast：`toast.success / error / info`，手机在底栏上方、桌面在右下角 |
| `Calendar` | `calendar.tsx` | `react-day-picker` 唯一封装入口：周一起始、中文月份、板块色调选中态，支持补卡日期范围限制 |
| `EmptyState` / `ErrorState` | `empty-state.tsx`、`error-state.tsx` | 空状态（配静态吉祥物 + 主操作）与加载失败重试卡片 |
| `ThemePicker` | `theme-picker.tsx` | 主题色单选；每个色块自带 `data-theme`，组件里不写色值；`compact` 只显示色块 |
| `Avatar` / `AvatarStack` | `avatar.tsx` | 支持预设头像（`preset:*`）或昵称首字；`ring` 表示连续打卡中 |
| `Stamp` | `stamp.tsx` | 打卡印章，`animate` 只在刚完成时播放 |
| `Skeleton` | `skeleton.tsx` | 形状接近真实内容，不用转圈代替 |
| `Icon` | `icon.tsx` | 手绘双层图标，见下文；当前态描边加粗到 2.4px |

此外，`src/components/charts/` 提供三类数据展示组件（只引 `d3-shape` 算路径，SVG 自绘，详见 [ui-primitives.md](./ui-primitives.md) 第 7 节）：

| 组件 | 文件 | 要点 |
|---|---|---|
| `Heatmap` | `heatmap.tsx` | 周一到周日 × N 周打卡热力格，4 档强度（0 / 1–49% / 50–99% / ≥100%），点击格子看当天明细 |
| `LineChart` | `line-chart.tsx` | 单折线 + 渐变面积图（体重趋势、每日 AI 花费），非负数据 Y 轴下界不低于 0，参考线支持目标值 |
| `BarChart` | `bar-chart.tsx` | 按天/周柱状图（运动时长、睡眠时长），达标柱用板块主色、未达标用浅档 |

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
| < 768px | 底部悬浮胶囊导航：主页 / 待办 / ＋ / 排行 / 我的。"＋"是收在栏内的圆角方块，不凸出栏外 | "＋"打开底部弹层 |
| 768–1023px | 左侧窄栏，只显示图标 | 侧栏顶部"＋"，打开居中对话框 |
| ≥ 1024px | 左侧宽栏（224px）：品牌、图标 + 文字、AI 额度。导航项高 44px、圆角 xl、caption 字号 | 侧栏顶部"打卡"按钮 |

- `BottomNav`、`SideNav`、`TopBar` 本身不定位，由应用外壳负责 `fixed` / `sticky` 和安全区（`--safe-top`、`--safe-bottom`）。
- 导航项只在 `src/components/layout/nav-items.ts` 定义一次，手机和桌面共用；高亮规则见 `isNavActive()`（主页精确匹配，其余按前缀匹配）。
- 一级页面显示主导航；二级页面隐藏底栏，顶栏带返回按钮。导航文字和页面标题一致，当前项加 `aria-current="page"`。
- 弹层里不再打开弹层。底栏之外的悬浮按钮不放在右下角。
- 全站隐藏滚动条（`globals.css` 的 base 层），滚动本身不受影响；需要提示"还能滚"时露出半张卡片或加渐隐，不靠滚动条。

## 8. Agent 组件

位于 `src/features/agent/`。一次助手回复里的思考、工具调用、文字输出本质上是同一个回合的不同 part，用一个 `<AgentTurn>` 呈现，不再拆成推理链、工具卡片、文字气泡三个独立组件。

**数据结构**（`types.ts`）对齐 AI SDK UIMessage 的 parts：`step-start`、`reasoning`、`tool`、`text`、`source`，按到达顺序排列。ToolLoopAgent 每一步是"思考 → 发出一个或多个工具调用（同一步里的多个调用是并行的）→ 拿到结果进入下一步"，`turn.ts` 按 `step-start` 把过程分成步。接入 `ai` 包时只写一层映射，并以 `node_modules/ai/docs/` 为准核对 state 取值。

**回合结构**（从上到下）：

| 区块 | 来源 | 规则 |
|---|---|---|
| 活动条 `ActivityTrail` | reasoning + tool | 进行中默认展开成时间线，回答完成后自动收起（用户手动开合过就以用户为准）。收起时只占一行：左边说明正在做什么（"正在搜索等 3 件事"）或完成摘要（"12 个工具 · 11 秒"），右边是工具小方块。同一步并行的方块叠在一起，步与步之间留空；只显示最近 5 个，其余折成 +N；失败的方块带红点。点开是按步排列的时间线：思考是一段灰色小字（两行截断，点击展开），每个工具一行（图标、中文名、摘要、耗时），点行看参数和结果 |
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
- 对话里的辅助按钮（重试、回放）用 `soft` / `ghost`，实底留给草稿卡的"确认记录"。
- 失败的工具直接显示原因和降级方案（"网页打不开，已改用搜索结果"），不需要用户点开。
- 过程里不显示 token 数、模型名等技术细节。
- 不展示用户上传的原图（图片不落盘，见 ADR-0002 第 4 节）。

## 9. 吉祥物：团团与墩墩

两只糯米团子，用户在新人引导里选一只，之后在「我的 → 外观」里随时换（`MascotSvg` / `Mascot` / `InteractivePet` 的 `character` 属性，`'tuan' | 'dun'`）。身体、表情、手臂、动作完全共用：

- **团团**（默认，偏女孩）：头顶两片圆叶小芽，樱花粉波点蝴蝶结别在头顶右上。
- **墩墩**（偏男孩）：雾蓝棒球帽（帽檐朝右）+ 黄色小星星徽章，帽顶一片小叶子；短粗眉毛，腮红淡 40%。

全站用用户选的那一只，AI 回复头像、空状态也跟着换。代码在 `src/components/mascot/`：

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

**悬浮团团（Agent 入口，ADR-0024）**：应用内常驻一只 `FloatingPet`（`src/features/agent/`），点开 Agent 弹窗、拖动、长按晃悠、双击转圈，边缘吸附露半头、顶部倒立、底部受 Dock 栏阻挡。它是「互动版」的特例：全站显示，但在「我的」页（已有一只互动团团）和全屏 Agent 页隐藏，遵守「一屏不放两只互动团团」；位置记在 localStorage。弹窗 `AgentPanel` 手机顶部留 1/3、左侧留 1/4，桌面右下角卡片，顶部小导航栏：历史 / 新对话 / 全屏 / 关闭。这同时取代第 7 节「底栏之外的悬浮按钮不放右下角」——悬浮团团是唯一的例外。

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

## 13. 页面预览

`/dev/playbook/pages` 用 Playbook 组件和假数据拼出每个真实页面（主页、待办、排行、我的、打卡表单、登录），上面是全部页面的手机缩略图墙，下面同时看手机 360 和桌面 ≥1000 两种形态。预览里的底栏、侧栏、"＋"都能点。

- 它是正式页面的对标样式：正式页面上线时要和预览长得一样；改页面样式先改预览，再改正式页面。
- 页面登记在 `src/app/dev/playbook/pages/_screens/registry.tsx`，新增路由时同步登记一页。
- 外壳 `app-shell.tsx` 和正式的 `(app)/layout.tsx` 同一套结构。演示框里断点不生效，所以外壳形态由参数决定，内容区用容器查询（`@container` / `@xl:`）适配宽度。
- 一屏只放一只互动吉祥物：缩略图墙和"手机 + 桌面"并排时，桌面里用静态版。

## 14. 待定事项

> 2026-10-31 起，下表中涉及引入第三方库的事项统一在 demo-init Phase 3 对齐，结论以 [docs/libraries.md](../libraries.md) 为准。负责人已于 2026-10-31 拍板（ADR-0004 至 0020），第三方原语的接入方式见 [ui-primitives.md](./ui-primitives.md)。

| 事项 | 现状 | 何时处理 |
|---|---|---|
| 交互原语 | 已完成：Base UI 1.9（ADR-0004），不用 shadcn/ui、Radix。`Sheet`、`ConfirmDialog`、`Select`、`Combobox`、`NumberField` 等已在 M1 落地 | 已完成（M1） |
| 图标库 | 不引入。2026-10-31 决定所有图标手绘（第 6 节） | — |
| clsx + tailwind-merge | 已定不引入：`cn()` 只做拼接（tailwind-merge 会吞掉语义字号，见 libraries.md） | — |
| 动效库 | 已定不引入（ADR-0005） | — |
| 团团形象、logo | 团团已细化（第 9 节）；logo 已定（ADR-0022）：唯一源 `src/components/layout/logo-svg.ts`，App 图标是团团和墩墩肩并肩，标签页图标与 `BrandMark` 是团团大头，底色固定奶茶焦糖，不随主题变 | 设计评审后定稿；CSS 动画不够用时走 libraries.md 的变更规则（Rive、Lottie 目前在禁令里） |
| 深色模式 | 未做；token 已分层 | 浅色定稿后 |
| Prettier 类名排序 | `prettier-plugin-tailwindcss` 没有配置 `tailwindStylesheet`，自定义 token 类会被排到最前 | 在 `.prettierrc.json` 加 `"tailwindStylesheet": "./src/app/globals.css"` |
