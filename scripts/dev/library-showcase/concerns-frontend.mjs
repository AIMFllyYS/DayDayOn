// 组件库对齐（demo-init Phase 3）：前端关注点的调研结论。
// 事实只来自 2026-10-31 本次会话抓取的官方文档、npm registry、GitHub 与本地实测（data.json）。
// 抓不到的不写；包的版本、发布时间、维护者、许可证、体积由 build.mjs 从 data.json 读取，不在这里手写。

export const frontend = [
  {
    no: 1,
    slug: 'interaction-primitives',
    title: '交互原语',
    group: 'A 基础组件库',
    adr: '0004',
    needs: [
      '底部抽屉：手机打卡入口，要能下滑关闭，里面的表单遇到软键盘不被遮挡',
      '居中对话框、确认对话框（删除、退出登录、注销）',
      '下拉菜单、Popover',
      '下拉选择、可搜索组合框（运动品类可自定义，科目标签、自定义字段的多选）',
      '滑块（饮食份量）、数字输入（体重一位小数、时长）',
      '验证码输入（邮箱 6 位验证码）',
      '焦点管理、键盘操作、读屏可用',
    ],
    barsNote:
      '三个组合覆盖的组件不完全相同：Base UI 组合含 Drawer、Combobox、NumberField、OTPField、Field、Form 共 15 个；Radix 组合没有数字输入和表单，抽屉、组合框分别用 vaul、cmdk 代替；React Aria 组合另含 DatePicker、Calendar、TimeField。',
    layer:
      '选"无样式原语 + 本项目自有样式"。带样式的全家桶（shadcn/ui、HeroUI）会带来第二套按钮和卡片，和已有 15 个按 token 写好的原子组件冲突；完全自研的话，抽屉手势、iOS 软键盘、焦点圈定、组合框的无障碍都要自己实现，风险高。',
    candidates: [
      {
        name: 'Base UI',
        pkg: '@base-ui/react',
        verdict: 'pick',
        size: {
          case: 'base-ui 全套',
          also: [
            ['首屏组合（Drawer + Dialog + Toast）', 'base-ui 首屏（Drawer + Dialog + Toast）'],
          ],
        },
        caps: [
          'Drawer 基于 Dialog，加了滑动关闭、吸附点和 VirtualKeyboardProvider（底部抽屉里有输入框时处理软键盘）；1.3.0 起转为稳定版',
          'Combobox / Autocomplete、Select（支持多选）、Menu、Popover、AlertDialog、Slider、NumberField、Tabs、Checkbox',
          'OTPField 已转为稳定版，正好用于邮箱验证码',
          'Toast（见关注点 3）和 Field / Form（见关注点 6）也在同一个包里',
          '所有组件在一个包里，可按子路径导入、可 tree-shaking；shadcn/ui 官方以它为底座',
        ],
        warn: [
          '单个组件比 Radix 大：Dialog 23.4 KB 对 13.9 KB，Select 44.4 KB 对 31.6 KB。弹层类组件要按需懒加载',
          'peer 依赖声明了 date-fns 和 @date-fns/tz，是给尚未公开的 Calendar 组件用的（GitHub issue #4632）。本项目本来就要用这两个包（关注点 5），不额外增加依赖',
          'iOS 26 起，遮罩层要用 position: absolute 并加一段全局样式，官方快速上手里有说明',
        ],
        code: {
          src: 'https://base-ui.com/react/components/number-field',
          text: `import { NumberField } from '@base-ui/react/number-field'

<NumberField.Root defaultValue={100}>
  <NumberField.Group>
    <NumberField.Decrement />
    <NumberField.Input />
    <NumberField.Increment />
  </NumberField.Group>
</NumberField.Root>`,
        },
        fit: '盘点里的原语一个库全部覆盖，包括 vaul 停更以后底部抽屉的替代方案。体积偏大的问题用两条规则处理：只从 src/components/ui/ 按子路径导入；弹层类组件在用户点开时才加载。',
      },
      {
        name: 'Radix Primitives',
        pkg: 'radix-ui',
        verdict: 'alt',
        size: { case: 'radix 等价组合（+ vaul + cmdk）' },
        caps: [
          'Dialog、AlertDialog、Popover、DropdownMenu、Select、Slider、Toast、Tabs、Checkbox',
          '验证码输入是 unstable_OneTimePasswordField（未稳定）',
        ],
        warn: [
          '没有 Drawer，要另装 vaul，而 vaul 的 README 写明"This repo is unmaintained"',
          '没有组合框。cmdk 是命令面板，不是表单里的组合框；也没有 NumberField',
          '传递依赖 73 个，是候选里最多的',
        ],
        fit: '单组件更小，但缺的三样（抽屉、组合框、数字输入）要靠额外的库补，其中一个已经停更。',
      },
      {
        name: 'React Aria Components',
        pkg: 'react-aria-components',
        verdict: 'alt',
        size: { case: 'react-aria-components 等价组合（含 DatePicker）' },
        caps: [
          '组件最全：DatePicker、DateRangePicker、TimeField、Calendar、ComboBox、NumberField、Sheet',
          'Toast 仍以 UNSTABLE_ 前缀导出（本次核对导出名）',
        ],
        warn: [
          '日期组件使用 @internationalized/date 的日期类型，会和 date-fns 形成两套日期表示',
          'Apache-2.0 许可证',
        ],
        fit: '能把日期选择器一并解决，但实测组合体积和 Base UI 相当，还多一套日期类型，Toast 未稳定。',
      },
      {
        name: '自研 + 原生',
        kind: 'self',
        verdict: 'no',
        caps: [
          '现有 Sheet 基于原生 <dialog>：焦点圈定和 Esc 由浏览器负责',
          '可用原生 Popover API、<select>、<input type="range">',
        ],
        warn: [
          '现有 Sheet 只有进场动画，没有退场动画和下滑关闭',
          '组合框、抽屉手势、iOS 软键盘适配都要自己写和测',
        ],
        fit: '0 KB，但工作量和无障碍风险都落在自己身上，不划算。',
      },
      {
        name: 'Headless UI',
        pkg: '@headlessui/react',
        verdict: 'no',
        caps: ['Dialog、Menu、Listbox、Combobox、Popover、Switch、Tabs'],
        warn: ['没有抽屉、滑块、数字输入、Toast', '12 个月内只有 7 次发布'],
        fit: '缺口比 Radix 还多。',
      },
    ],
    decision: {
      owner: 'Base UI（@base-ui/react）',
      version: '1.9.0',
      wrapper: 'src/components/ui/（每个原语一个封装文件；业务代码禁止直接 import @base-ui/react）',
      rules: [
        '只在 src/components/ui/ 里按子路径导入 @base-ui/react/<组件>，不从包根导入',
        '弹层类组件（Drawer、Dialog、AlertDialog、Select、Combobox、Menu、Popover）在使用处用 next/dynamic 懒加载，或在用户第一次点开时加载',
        '现有 Sheet 改为基于 Base UI 的 Drawer（手机）/ Dialog（≥768px），对外接口不变',
        'className 拼接继续用自写的 cn()，不引入 tailwind-merge：实测默认配置会把 "text-body text-muted" 合并成 "text-muted"，把语义字号吞掉',
      ],
      rejected: [
        ['Radix Primitives', '缺抽屉、组合框、数字输入，补齐要用已停更的 vaul'],
        ['React Aria Components', '体积相当，日期类型与 date-fns 重复，Toast 未稳定'],
        ['vaul', 'README 写明不再维护'],
        ['shadcn/ui、HeroUI', '带样式的全家桶，会和现有原子组件形成两套外观'],
        ['自研', '抽屉手势、软键盘、组合框无障碍的成本和风险过高'],
      ],
      cost: '单组件体积比 Radix 大；需要在 Playbook 里把每个原语重新套上本项目样式。',
      review: [
        'Base UI 公开 Calendar 组件时（评估替代关注点 4 的 react-day-picker）',
        '移动端抽屉出现长期未修的问题时',
        '首屏 JS 超出预算时',
      ],
    },
    sources: [
      ['Base UI 快速上手', 'https://base-ui.com/react/overview/quick-start'],
      ['Base UI Drawer', 'https://base-ui.com/react/components/drawer'],
      ['Base UI 发布记录', 'https://base-ui.com/react/overview/releases'],
      ['Base UI issue #4632（peer 依赖）', 'https://github.com/mui/base-ui/issues/4632'],
      ['vaul README', 'https://github.com/emilkowalski/vaul'],
    ],
  },
  {
    no: 2,
    slug: 'motion',
    title: '动效',
    group: 'A 基础组件库',
    adr: '0005',
    needs: [
      '按钮按压回弹、开关和勾选',
      '弹层进出场',
      '列表增删（待办勾选后移走）',
      '打卡成功盖章、团团欢呼',
      '团团的 13 种动作',
      '页面切换',
    ],
    layer:
      '本项目是组件微交互和庆祝动画，不是滚动叙事长卷。先看 CSS 和浏览器原生能力够不够，不够再上 JS 动画库。',
    candidates: [
      {
        name: 'CSS 预设 + React <ViewTransition>',
        kind: 'native',
        verdict: 'pick',
        sizeNote: '0 KB',
        caps: [
          'globals.css 里已有 fade-up、pop-in、sheet-up、stamp、wiggle 等预设和"减少动态效果"适配；团团的动作也是 CSS 动画类（interactive-pet.tsx）',
          'Base UI 弹层和 Toast 提供 data-starting-style / data-ending-style，进退场用 CSS 写',
          'React 19.3 内置 <ViewTransition> 和 addTransitionType；Next 16.4 App Router 无需配置即可使用（node_modules/next/dist/docs 的 View transitions 指南）',
          '浏览器不支持时页面照常工作，只是没有过渡动画',
        ],
        warn: [
          'Next 文档提示部分动画在 Safari 上表现可能不同',
          '没有弹簧物理和拖拽手势（手势由 Base UI 的 Drawer、Toast 提供）',
        ],
        fit: '覆盖全部需求，不增加任何依赖。',
      },
      {
        name: 'Motion',
        pkg: 'motion',
        verdict: 'alt',
        size: {
          case: 'motion：motion 组件',
          also: [
            ['LazyMotion + m', 'motion：LazyMotion + m + domAnimation'],
            ['mini animate', 'motion：mini animate'],
          ],
        },
        caps: ['弹簧、手势、布局动画、退场动画'],
        fit: '能力最强，但本项目需要的手势已经由 Base UI 提供，列表和页面过渡由 ViewTransition 提供，剩下的用不到。',
      },
      {
        name: 'Rive',
        pkg: '@rive-app/react-canvas',
        verdict: 'no',
        caps: ['状态机驱动的矢量动画，需要 Rive 编辑器制作 .riv 文件'],
        fit: '团团目前是 SVG + CSS。等团团需要复杂的状态机动画、并且有人用 Rive 编辑器做素材时再评估。',
      },
      {
        name: 'Lottie',
        pkg: 'lottie-react',
        verdict: 'no',
        caps: ['播放 After Effects 导出的 JSON 动画'],
        fit: '整包约 191 KB，本项目没有 AE 素材。',
      },
      {
        name: 'AutoAnimate',
        pkg: '@formkit/auto-animate',
        verdict: 'no',
        caps: ['给列表增删自动加动画'],
        fit: '和 ViewTransition 能力重叠，12 个月内只有 1 次发布。',
      },
    ],
    decision: {
      owner: '不引入动效库：CSS 预设 + React <ViewTransition>',
      version: '—',
      wrapper: 'src/app/globals.css（预设）；列表和页面过渡的写法在 Playbook 动效页示范',
      rules: [
        '只动 transform 和 opacity（进度条宽度、圆环描边除外）',
        '弹层和 Toast 的进退场用 Base UI 的 data-starting-style / data-ending-style 写 CSS',
        '列表增删和页面切换用 <ViewTransition>；不在组件里临时写 keyframes',
      ],
      rejected: [
        ['Motion', '需要的手势和过渡已有 Base UI 与 ViewTransition 覆盖'],
        ['Rive / Lottie', '没有对应的动画素材和制作流程'],
        ['AutoAnimate', '与 ViewTransition 重叠'],
      ],
      cost: '没有弹簧物理；Safari 上的部分过渡效果可能不同。',
      review: [
        '需要拖拽排序（自定义仪表盘，v0.2）或弹簧物理时',
        '团团需要状态机动画时（评估 Rive）',
      ],
    },
    sources: [
      [
        'Next.js 16.4 View transitions 指南（本地 node_modules/next/dist/docs/01-app/02-guides/view-transitions.md）',
        'https://nextjs.org/docs/app/guides/view-transitions',
      ],
      [
        'Base UI Toast（data-starting-style / data-ending-style）',
        'https://base-ui.com/react/components/toast',
      ],
    ],
  },
  {
    no: 3,
    slug: 'toast',
    title: '提示消息',
    group: 'A 基础组件库',
    adr: '0006',
    needs: [
      '打卡成功、保存失败',
      '删除待办后"撤销"',
      'AI 识别"处理中 → 完成 / 失败"',
      '在非 React 代码里也能调用（例如请求封装里统一提示错误）',
    ],
    layer: '跟随交互原语的所有者，避免出现第二套弹层、焦点和动画体系。',
    candidates: [
      {
        name: 'Base UI Toast',
        pkg: '@base-ui/react',
        verdict: 'pick',
        size: {
          detail: 'base-ui/toast',
          note: '单独打包的体积；和 Drawer、Dialog 一起打包时大部分代码共享',
        },
        caps: [
          '全局 toastManager：在 React 树之外也能 add / close / update / promise',
          'promise 三态（loading / success / error）、actionProps 撤销按钮、按 id 更新',
          '滑动关闭、数量上限、F6 跳到提示区域',
        ],
        fit: '覆盖全部需求，和关注点 1 是同一个依赖，不新增包。',
      },
      {
        name: 'Sonner',
        pkg: 'sonner',
        verdict: 'alt',
        size: { case: 'sonner' },
        caps: ['开箱即用的堆叠动画、promise、撤销'],
        warn: ['单人维护；12 个月内 1 次发布'],
        fit: '更小、默认效果好，但会多一个依赖和一套独立的样式与动画写法。',
      },
      {
        name: 'react-hot-toast',
        pkg: 'react-hot-toast',
        verdict: 'no',
        caps: ['轻量提示'],
        warn: ['单人维护'],
        fit: '同样是额外依赖，能力不如前两者。',
      },
    ],
    decision: {
      owner: 'Base UI Toast',
      version: '跟随 @base-ui/react 1.9.0',
      wrapper: 'src/components/ui/toast.tsx（导出 Toaster 和全局 toast 管理器）',
      rules: [
        '全站只有一个 Toast.Provider，放在根布局',
        '错误提示的文案从统一的错误码映射表取（见接口层规范）',
      ],
      rejected: [
        ['Sonner', '多一个依赖和一套样式体系'],
        ['react-hot-toast', '同上，能力更弱'],
      ],
      cost: '堆叠动画要自己用 CSS 变量写。',
      review: ['Base UI Toast 出现无法绕过的问题时'],
    },
    sources: [['Base UI Toast', 'https://base-ui.com/react/components/toast']],
  },
  {
    no: 4,
    slug: 'date-time-picker',
    title: '日期与时间选择',
    group: 'B 板块专用',
    adr: '0007',
    needs: [
      '睡眠：入睡和起床时间，常常跨午夜',
      '待办 DDL：日期 + 时间',
      '补卡：选过去的某一天',
      '打卡日历：月视图，标出已打卡的日子（主页、目标详情）',
    ],
    layer:
      '输入和展示分开选。输入时间、日期用原生控件：手机上会弹系统的滚轮或日历，最顺手。可见的日历网格需要自定义每一天的样式，用库。',
    candidates: [
      {
        name: '原生 input（date / time / datetime-local）+ 自研时间区间',
        kind: 'native',
        verdict: 'pick',
        sizeNote: '0 KB',
        caps: [
          'iOS / Android 弹出系统选择器',
          '外框用现有 Field 组件统一样式',
          '睡眠区间：两个 time 输入，起床早于入睡时自动算作次日，同时显示时长',
        ],
        warn: ['原生控件内部的弹出层无法定制样式'],
        fit: '输入场景足够，零依赖。',
      },
      {
        name: 'React DayPicker',
        pkg: 'react-day-picker',
        verdict: 'pick',
        size: { case: 'react-day-picker + zhCN' },
        caps: [
          '月历组件，自带中文 locale',
          '可替换日格组件，用来给已打卡的日子上色',
          '依赖 date-fns 和 @date-fns/tz，与关注点 5 共用',
        ],
        warn: ['npm 维护者只有 1 人（bus factor）'],
        fit: '负责"看得见的日历"，体积里的 date-fns 部分和关注点 5 去重。',
      },
      {
        name: 'React Aria DatePicker / TimeField',
        pkg: 'react-aria-components',
        verdict: 'alt',
        caps: ['分段输入、日历弹层、区间选择，无障碍和国际化完整'],
        warn: ['使用 @internationalized/date，与 date-fns 形成两套日期类型'],
        fit: '最完整，但要为日期多引入一个原语库。',
      },
      {
        name: 'Base UI Calendar',
        kind: 'self',
        verdict: 'no',
        caps: ['正在开发，尚未公开（issue #4632）'],
        fit: '还不能用。',
      },
    ],
    decision: {
      owner: '输入：原生控件；日历：React DayPicker',
      version: 'react-day-picker 10.0.2',
      wrapper: 'src/components/ui/calendar.tsx、date-field.tsx、time-range-field.tsx',
      rules: [
        '时间输入只用原生控件，外框套 Field',
        '日历只经 calendar.tsx 使用，不在业务代码里直接 import react-day-picker',
      ],
      rejected: [
        ['React Aria', '多一套日期类型和原语库'],
        ['Base UI Calendar', '尚未公开'],
      ],
      cost: '原生弹出层样式不可定制；React DayPicker 是单人维护。',
      review: [
        'Base UI 公开 Calendar 时，评估合并到关注点 1 的所有者',
        'React DayPicker 长期无人维护时',
      ],
    },
    sources: [['Base UI issue #4632', 'https://github.com/mui/base-ui/issues/4632']],
  },
  {
    no: 5,
    slug: 'date-time-calc',
    title: '日期与时区计算',
    group: 'B 板块专用',
    adr: '0008',
    needs: [
      '打卡日归属：按用户时区，并且每天 04:00 才算换日',
      '每周一 00:00（北京时间）重置 AI 额度',
      '时长、周 / 月区间、中文格式化',
      'Node 24 服务端和浏览器（包括 iPhone Safari）结果一致',
    ],
    layer: '函数式工具库 + 时区扩展。原生 Temporal 是最终方案，但现在还不能直接用。',
    candidates: [
      {
        name: 'date-fns 4 + @date-fns/tz',
        pkg: 'date-fns',
        verdict: 'pick',
        size: { case: 'date-fns 常用 + zhCN + @date-fns/tz' },
        caps: [
          '按需导入的纯函数',
          'TZDate：带时区的日期对象',
          '已是 Base UI 的 peer 依赖、React DayPicker 的依赖',
        ],
        fit: '项目里本来就会出现这两个包，选它不增加日期库的数量。',
      },
      {
        name: 'Day.js + utc / timezone 插件',
        pkg: 'dayjs',
        verdict: 'alt',
        size: { case: 'dayjs + utc + timezone' },
        caps: ['链式 API，插件扩展'],
        fit: '更小，但会和 React DayPicker 带进来的 date-fns 并存，形成两个日期库。',
      },
      {
        name: '原生 Temporal',
        kind: 'native',
        verdict: 'no',
        caps: ['TC39 Stage 4，Chrome 144+、Firefox 139+ 已支持'],
        warn: [
          '截至 2026-09，Safari 稳定版仍不支持（web-platform-tests interop issue #1381）',
          'Node 24 默认不开启（Node 26 起默认开启）',
        ],
        fit: '用户主要用 iPhone，现在用就得带 polyfill。',
      },
      {
        name: 'temporal-polyfill',
        pkg: 'temporal-polyfill',
        verdict: 'no',
        caps: ['Temporal 的 polyfill'],
        fit: '整包约 19 KB，等 Safari 支持后再直接用原生。',
      },
    ],
    decision: {
      owner: 'date-fns + @date-fns/tz',
      version: 'date-fns 4.4.0、@date-fns/tz 1.5.0',
      wrapper:
        'src/lib/time/（例如 localDateOf(instant, timeZone, dayStartHour)、weekKey(instant)）',
      rules: [
        '业务代码不直接做 Date 加减和时区换算，一律调用 src/lib/time/',
        'src/lib/time/ 的每个函数都要有单元测试，覆盖跨午夜、04:00 换日、周一切换',
      ],
      rejected: [
        ['Day.js', '会和 date-fns 并存'],
        ['Temporal / polyfill', 'Safari 稳定版未支持'],
      ],
      cost: '日后迁到 Temporal 时要改 src/lib/time/ 一处。',
      review: ['Safari 稳定版支持 Temporal 且服务器升级到 Node 26 LTS 时'],
    },
    sources: [
      [
        'MDN Temporal',
        'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal',
      ],
      [
        'web-platform-tests interop issue #1381',
        'https://github.com/web-platform-tests/interop/issues/1381',
      ],
    ],
  },
  {
    no: 6,
    slug: 'forms',
    title: '表单与动态表单',
    group: 'B 板块专用',
    adr: '0009',
    needs: [
      '新人引导、目标设置、五类打卡表单、体重与满意度',
      '自定义目标：字段编辑器（增删字段、选类型）+ 按字段 schema 渲染的动态表单',
      '校验错误和服务端返回的错误显示在对应字段下',
    ],
    layer:
      '先问：表单状态要不要交给一个库管？本项目的表单都是几个到十几个字段，最复杂的是按 schema 渲染的动态表单，而 schema 是自己定义的。项目开了 React Compiler，库的写法要和编译器兼容。',
    candidates: [
      {
        name: 'Base UI Form / Field + zod',
        pkg: '@base-ui/react',
        verdict: 'pick',
        size: { detail: 'base-ui/form', also: [['Field', 'base-ui/field', 'detail']] },
        caps: [
          'onFormSubmit 直接拿到字段值对象',
          'validate 支持同步和异步，validationMode 可选提交时、失焦、变更时',
          'errors 属性合并服务端返回的字段错误，字段改动后自动清除',
          '和关注点 1 是同一个依赖',
        ],
        fit: '覆盖全部需求；状态是普通 React state，和 React Compiler 没有冲突。',
      },
      {
        name: 'React Hook Form',
        pkg: 'react-hook-form',
        verdict: 'no',
        size: { case: 'react-hook-form + zodResolver（不含 zod）' },
        caps: ['生态最大，字段数组、脏值跟踪'],
        warn: [
          'react.dev 的 incompatible-library 规则点名 useForm 的 watch 属于"内部可变"，React Compiler 会跳过用到它的组件（官方建议改用 useWatch）',
        ],
        fit: '能用，但要额外记住哪些 API 和编译器冲突。',
      },
      {
        name: 'TanStack Form',
        pkg: '@tanstack/react-form',
        verdict: 'alt',
        size: { case: '@tanstack/react-form' },
        caps: ['类型安全、细粒度订阅、Standard Schema'],
        warn: ['v2 处于 alpha，官方迁移文档说明会修改多个面向 React 的 API'],
        fit: '等 v2 稳定后再评估。',
      },
    ],
    decision: {
      owner: '不引入表单库：Base UI Form / Field + zod',
      version: '跟随 @base-ui/react；zod 见关注点 10',
      wrapper:
        'src/components/ui/field.tsx（现有）改为基于 Base UI Field；动态表单 src/features/goal/components/schema-form.tsx',
      rules: [
        '表单提交时用同一份 zod schema 校验，把 issue 转成 { 字段名: 错误 } 交给 Form 的 errors',
        '动态表单的字段类型是固定清单（数字、文本、单选、多选、布尔、时长、评分），渲染和校验都从这份清单生成',
      ],
      rejected: [
        ['React Hook Form', '部分 API 与 React Compiler 冲突'],
        ['TanStack Form', 'v2 将改 API，当前处于 alpha'],
      ],
      cost: '字段数组、脏值跟踪等需要时自己写。',
      review: ['出现多步骤、大量字段数组的表单时', 'TanStack Form v2 稳定时'],
    },
    sources: [
      ['Base UI Forms 指南', 'https://base-ui.com/react/handbook/forms'],
      [
        'react.dev incompatible-library',
        'https://react.dev/reference/eslint-plugin-react-hooks/lints/incompatible-library',
      ],
      ['TanStack Form 从 v1 迁移', 'https://tanstack.com/form/alpha/docs/migrate-from-v1'],
    ],
  },
  {
    no: 7,
    slug: 'charts',
    title: '图表',
    group: 'B 板块专用',
    adr: '0010',
    needs: [
      '体重曲线（几十个点）',
      '后台每日 AI 花费曲线',
      '营养素环 / 条（已有 ProgressRing）',
      '打卡周热力图、仪表盘迷你图',
      '手账风格，强定制',
    ],
    layer:
      '数据量小、图表种类少、外观要和 token 一致 → 自研 SVG 组件，只借一个曲线数学工具；不用通用图表库。',
    candidates: [
      {
        name: '自研 SVG + d3-shape',
        pkg: 'd3-shape',
        verdict: 'pick',
        size: { bundlephobia: true },
        caps: [
          '只用 line、area、arc 和 curveMonotoneX 生成平滑路径',
          '线性比例尺几行代码自己写',
          'ISC 许可证',
        ],
        warn: [
          '最近一次发布是 2022-12，超过 12 个月。d3-shape 是功能已完成的稳定库，每周下载量过亿',
        ],
        fit: '体积最小，外观完全可控。',
      },
      {
        name: 'Recharts 3',
        pkg: 'recharts',
        verdict: 'no',
        size: { case: 'recharts 折线图' },
        caps: ['声明式 React 图表'],
        warn: ['一张折线图实测 104.5 KB，37 个传递依赖（含 Redux Toolkit、immer）'],
        fit: '对几张小图来说太重。',
      },
      {
        name: 'ECharts 6',
        pkg: 'echarts',
        verdict: 'no',
        caps: ['功能最全的图表库'],
        fit: '整包约 359 KB，Canvas 渲染，样式难对齐 token。',
      },
      {
        name: 'd3-scale',
        pkg: 'd3-scale',
        verdict: 'no',
        size: { case: 'd3-shape + d3-scale（折线数学）', note: '与 d3-shape 合计' },
        caps: ['比例尺'],
        fit: '会带进 d3-array、d3-interpolate、d3-time 等；我们只需要线性比例尺。',
      },
      {
        name: 'uPlot',
        pkg: 'uplot',
        verdict: 'no',
        caps: ['高性能时间序列图'],
        fit: 'Canvas，最近发布 2025-03；面向大数据量。',
      },
    ],
    decision: {
      owner: '自研 SVG 图表 + d3-shape',
      version: 'd3-shape 3.2.0',
      wrapper:
        'src/components/charts/（LineChart、WeekHeatmap、Sparkline；营养素环复用 ProgressRing）；d3-shape 只允许在这个目录里 import',
      rules: [
        '图表颜色只用板块色和状态色 token',
        '每个图表都有文字替代（aria-label 或可见的数值摘要）',
      ],
      rejected: [
        ['Recharts', '一张折线图 104.5 KB'],
        ['ECharts', '整包约 359 KB，Canvas 难对齐 token'],
        ['d3-scale', '传递依赖多，需求只有线性比例尺'],
      ],
      cost: '缩放、多序列、交互提示要自己做。',
      review: ['需要缩放、大数据量或复杂交互图表时'],
    },
    sources: [['d3-shape', 'https://github.com/d3/d3-shape']],
  },
  {
    no: 8,
    slug: 'image-pipeline',
    title: '浏览器端图片压缩与传输',
    group: 'B 板块专用',
    adr: '0011',
    needs: [
      '拍照或选图 → 浏览器压缩 → 发给 deepseek-flash 识别',
      '图片永不落盘、不上云（ADR-0002 第 4 节）',
      '主要是 iPhone 照片',
    ],
    layer: '浏览器原生能力（createImageBitmap + canvas）就够，关键是格式和尺寸选对。',
    facts: [
      'Safari 从未支持用 canvas 编码 WebP，请求 WebP 会静默返回 PNG（MDN：不支持的格式回退为 image/png）',
      'DeepSeek 接受 JPEG、PNG、GIF、WebP；推理前把图片缩放到约 1300×1300 的像素总量，每张图最多 1024 个 token',
      'AI SDK 的 DeepSeek provider 支持内联图片（file part）；也支持 DeepSeek Files API（uploadFile），文件会存在 DeepSeek，保留 1 小时到 30 天，不设过期则永久保存',
    ],
    candidates: [
      {
        name: '原生 createImageBitmap + canvas.toBlob（JPEG）',
        kind: 'native',
        verdict: 'pick',
        sizeNote: '0 KB（约 50 行自写代码）',
        caps: [
          '把像素总量缩到不超过约 1300×1300（再大 DeepSeek 也会缩小）',
          'JPEG 质量 0.8，所有浏览器都能编码',
          '重新编码会去掉 EXIF（包括 GPS 位置）',
        ],
        fit: '零依赖，行为可控。',
      },
      {
        name: 'browser-image-compression',
        pkg: 'browser-image-compression',
        verdict: 'no',
        size: { case: 'browser-image-compression' },
        caps: ['在 Web Worker 里压缩'],
        warn: ['最近一次发布 2023-03，仓库最近一次提交 2024-03', '单人维护'],
        fit: '底层同样是 canvas，为 50 行代码多一个停滞的依赖。',
      },
      {
        name: 'Compressor.js',
        pkg: 'compressorjs',
        verdict: 'no',
        caps: ['canvas 压缩'],
        fit: '同样是 canvas，没有必要。',
      },
    ],
    decision: {
      owner: '不引入库：原生 canvas 压缩为 JPEG',
      version: '—',
      wrapper:
        'src/lib/image/compress.ts（浏览器端）；src/server/ai/image.ts（服务端只在内存里转成内联 file part）',
      rules: [
        '压缩输出统一为 JPEG（质量 0.8），像素总量不超过约 1300×1300；取代 ADR-0002 第 4 节"WebP、长边 ≤ 1600px"的写法',
        '图片只以内联 file part 发给 DeepSeek，**禁止调用 uploadFile / DeepSeek Files API**（文件会存在 DeepSeek 一侧）',
        '服务端只在内存里处理，不写临时文件，不记录 base64',
        '浏览器解码失败时（例如 Chrome 桌面打不开 HEIC）提示"这张图打不开，换一张或截个图试试"',
      ],
      rejected: [
        ['browser-image-compression', '2023 年以来没有发布'],
        ['Compressor.js', '同样的原理，不需要库'],
      ],
      cost: 'JPEG 比 WebP 稍大；HEIC 在部分桌面浏览器打不开。',
      review: ['Safari 支持 canvas 编码 WebP 时', 'DeepSeek 调整图片尺寸或计费规则时'],
    },
    sources: [
      ['DeepSeek 图像理解指南', 'https://api-docs.deepseek.com/guides/vision'],
      ['AI SDK DeepSeek provider', 'https://ai-sdk.dev/providers/ai-sdk-providers/deepseek'],
      [
        'MDN HTMLCanvasElement.toBlob',
        'https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob',
      ],
      [
        'Safari 不编码 WebP 的说明（dev.to）',
        'https://dev.to/harshit_katheria/ask-canvas-for-a-webp-in-safari-and-you-silently-get-a-png-5hn6',
      ],
    ],
  },
]
