import type { ModuleTone } from '@/components/ui/tone'

/*
 * 五大打卡板块的「单一信息源」：总览页、子页头部速览、守则面板都从这里取，
 * 一条规则只写一次，避免在三个地方各写一遍。
 */

/** 五个板块共享的三态输入（只在总览说一次，不在每个板块重复） */
export const SHARED_INPUT_MODES = [
  { mode: '手动填写', icon: 'edit', detail: '表单录入' },
  { mode: '智能拍照', icon: 'camera', detail: '实拍识别' },
  { mode: '智能上传', icon: 'sparkles', detail: '截图 / 文本解析' },
] as const

export interface ModuleSpec {
  tone: ModuleTone
  slug: string
  /** 完整名：「好好吃饭」 */
  title: string
  /** 板块短名，用于切换器 */
  short: string
  /** 一句话定位（≤ 24 字） */
  tagline: string
  /** 裁判的核心门槛（一句话） */
  threshold: string
  /** 达标盖章示例 */
  pass: string
  /** 拦截存档示例 */
  block: string
  /** 页面守则：各不超过 3 条，每条尽量 ≤ 40 字 */
  dos: string[]
  donts: string[]
  /** 对应规范文档 */
  docRef: string
  /** 三个面板各自的一句话摘要 */
  summaries: { sandbox: string; compare: string; rules: string }
  /** 折叠的「设计说明」：原来占主视觉的长描述，保留但默认收起 */
  details: { sandbox: string; compare: string; rules: string }
}

export const MODULE_SPECS: readonly ModuleSpec[] = [
  {
    tone: 'diet',
    slug: 'diet',
    title: '好好吃饭',
    short: '饮食',
    tagline: '5 分制营养裁判 · 按体质分档执裁',
    threshold: 'AI 评分 > 3.0 分才盖章；炸鸡、含糖可乐等一票否决',
    pass: '午餐番茄炒蛋 + 杂粮饭 + 西蓝花 · 4.4 分',
    block: '晚餐炸鸡配可乐 · 0.0 分，仅记录热量',
    dos: [
      '明确标出 3.0 分有效线，超过才允许盖章',
      '按早中晚碳水与 GI 节律判罚，并展示核验依据',
      '不同体质分档：减脂严管，增肌温和',
    ],
    donts: [
      '不要让一张炸鸡夜宵照片混过有效打卡',
      '不要只算总热量，忽略 GI、钠、添加糖',
      '不要对所有体型一刀切',
    ],
    docRef: 'ui-design-system.md · ai-and-quota.md · ADR-0002',
    summaries: {
      sandbox: '手机内的完整流程：选方式 → 填写 → 结果弹窗 → 分析页，左侧切换场景样本',
      compare: '同一套规则下，4 个场景的成绩单对比',
      rules: '体质档位与饮食目标的检验规则',
    },
    details: {
      sandbox:
        '菜单选记录方式，点进独立填写页：内容分成折叠分区，一次只开一个，一屏内完成；有效打卡按钮固定在最底。「达标规则」「评判依据」是标题下的标签，点开进二级页。打卡后弹窗提示，进入分析页（文件夹式）。',
      compare:
        'A 清洁午餐 4.4 分通过、B 炸鸡可乐 0.0 分熔断、C 冰淇淋 3.3 分擦线、D 红油牛肉面 2.4 分不及格。成绩单含仪表环、3.0 分标尺、餐盘均衡条、GI 节律与联网核验。',
      rules:
        '偏胖减脂期严控油脂、精制糖与晚间碳水，垃圾食品一票否决；标准体型对标膳食指南；偏瘦增肌期放宽干净复合碳水，重点看优质蛋白。',
    },
  },
  {
    tone: 'exercise',
    slug: 'exercise',
    title: '动一动',
    short: '运动',
    tagline: '按运动品类分级的有效阈值',
    threshold: '快走需时长与距离双达标，跑步高 MET 门槛更低，力量看时长或容量',
    pass: '户外慢跑 32 分钟 · 196 kcal',
    block: '饭后散步 10 分钟，仅记为日常活动',
    dos: [
      '按品类分级核验：快走、跑步、力量各用各的阈值',
      '抗阻训练不看公里数，改看时长或动作容量',
      '低于阈值时温柔拦截，记为日常活动备忘',
    ],
    donts: [
      '不要用同一个分钟数卡所有运动',
      '不要让取快递散步或通勤骑行混入连击',
      '不要把两个带步进按钮的 NumberField 并排',
    ],
    docRef: 'ui-design-system.md · ai-and-quota.md · ADR-0002',
    summaries: {
      sandbox: '手机内的完整流程：选方式 → 填写 → 结果弹窗 → 分析页，左侧切换场景样本',
      compare: '达标运动与「伪运动」的判决卡对比',
      rules: '4 大运动品类的有效阈值矩阵',
    },
    details: {
      sandbox:
        '菜单选记录方式，点进独立填写页：内容分成折叠分区，一次只开一个，一屏内完成；有效打卡按钮固定在最底。「达标规则」「评判依据」是标题下的标签，点开进二级页。打卡后弹窗提示，进入分析页（文件夹式）。',
      compare:
        '达标：A 户外跑步 25 分钟 4.2 公里、C 深蹲 5 组 × 15 次。拦截：B 饭后慢走 10 分钟 0.6 公里、D 共享单车通勤 7 分钟 1.2 公里。',
      rules:
        '快走/健步走、跑步、力量/蹲起、球类/骑行/游泳/跳绳 4 大品类的自动判决基线，用户可按个人目标微调覆盖。',
    },
  },
  {
    tone: 'sleep',
    slug: 'sleep',
    title: '早点睡',
    short: '睡眠',
    tagline: '入睡红线 + 有效时长，双门槛',
    threshold: '入睡不晚于红线（如 23:30），且睡满 6.5–9.5 小时',
    pass: '23:15 入睡 → 07:10 起 · 7h55m',
    block: '02:15 入睡 → 10:30 起，属熬夜补觉，仅存档',
    dos: [
      '入睡红线与有效时长必须同时满足',
      '熬夜补觉时降级为「仅保存睡眠记录」，不报错',
      '跨午夜时间统一用 TimeRangeField，自动标「次日」',
    ],
    donts: [
      '不要只按总时长判定，否则凌晨 3 点睡也能拿章',
      '不要在晚睡时阻止提交，诚实归档到趋势图',
      '不要用深色夜空黑底，统一浅薰衣草底',
    ],
    docRef: 'ui-design-system.md · time-and-dates.md · ADR-0007',
    summaries: {
      sandbox: '手机内的完整流程：选方式 → 填写 → 结果弹窗 → 分析页，左侧切换场景样本',
      compare: '按时入睡与熬夜补觉的裁判卡对比',
      rules: '入睡红线与有效时长的双门槛演示',
    },
    details: {
      sandbox:
        '菜单选记录方式，点进独立填写页：内容分成折叠分区，一次只开一个，一屏内完成；有效打卡按钮固定在最底。「达标规则」「评判依据」是标题下的标签，点开进二级页。打卡后弹窗提示，进入分析页（文件夹式）。',
      compare:
        'A 23:15 按时入睡 · 7h55m 有效盖章；B 02:15 入睡 · 8h15m 熬夜补觉被拦截。团团说明原因，数据照常归档。',
      rules:
        '褪黑素分泌高峰与慢波深睡修复窗口集中在前半夜，所以必须同时满足入睡红线与有效时长才计入早睡连击。',
    },
  },
  {
    tone: 'study',
    slug: 'study',
    title: '学一点',
    short: '学习',
    tagline: '专注时长 + 内容实质，双核验',
    threshold: '专注 ≥ 25 分钟，且笔记摘要与学习目标一致',
    pass: '二叉树笔记 + 专注 45 分钟 + 提炼 BFS 复杂度',
    block: '只填「背单词」专注 5 分钟，提示继续专注',
    dos: [
      '专注时长与要点摘录都要核验，防翻书糊弄',
      '未满门槛时提供「暂存碎片学习」，同日累加达标',
      '上传 HTML/TXT 笔记先在客户端去噪，只发正文',
    ],
    donts: [
      '不要让 2–5 分钟的「看书」记录直接盖章',
      '不要把未去噪的 HTML 源码渲染进扫描镜',
      '不要暴露 token 消耗或内部 prompt',
    ],
    docRef: 'ui-design-system.md · ai-and-quota.md · ADR-0002',
    summaries: {
      sandbox: '手机内的完整流程：选方式 → 填写 → 结果弹窗 → 分析页，左侧切换场景样本',
      compare: '有效学习与低时长敷衍的裁判卡对比',
      rules: '番茄钟底线与笔记提纯的双机制',
    },
    details: {
      sandbox:
        '菜单选记录方式，点进独立填写页：内容分成折叠分区，一次只开一个，一屏内完成；有效打卡按钮固定在最底。「达标规则」「评判依据」是标题下的标签，点开进二级页。打卡后弹窗提示，进入分析页（文件夹式）。',
      compare: '有效打卡与未满番茄钟门槛被拦截的双轨反馈，拦截时提示继续专注后再盖章。',
      rules:
        '拒绝「看了 3 分钟书糊弄打卡」：单次最低专注时长加实质学习内容的语义核验，支持笔记与错题本截图提炼摘要。',
    },
  },
  {
    tone: 'custom',
    slug: 'custom',
    title: '我的小目标',
    short: '自定义',
    tagline: '独立期限 + 自拼字段 + 自定义裁判',
    threshold: '每个目标自设起止期限与达标条件，如饮水 ≥ 6 杯且含糖饮料 = 0',
    pass: '戒糖饮水：温水 7 杯 + 含糖饮料 0 杯',
    block: '喝水 7 杯但加了 1 杯全糖奶茶，诚实存档',
    dos: [
      '每个目标独立起止日期，顶栏下展示剩余天数与进度',
      '7 类动态字段单列垂直排布，按目标按需渲染',
      '多条件组合规则由 AI 逐项打勾核验',
    ],
    donts: [
      '不要让多个目标共用一个固定表单',
      '不要把复杂控件并排塞进同一行',
      '不要写死 hex 色值，统一用 bg-custom-soft / text-custom-ink',
    ],
    docRef: 'ui-design-system.md · client-data-and-forms.md · ADR-0003',
    summaries: {
      sandbox: '手机内的完整流程：选方式 → 填写 → 结果弹窗 → 分析页，左侧切换场景样本',
      compare: '满足规则与踩红线的裁判卡对比',
      rules: '期限、动态字段与检验规则设计器',
    },
    details: {
      sandbox:
        '菜单选记录方式，点进独立填写页：内容分成折叠分区，一次只开一个，一屏内完成；有效打卡按钮固定在最底。「达标规则」「评判依据」是标题下的标签，点开进二级页。打卡后弹窗提示，进入分析页（文件夹式）。',
      compare: '满足全部自定义规则则盖章；触碰一票否决红线（如偷喝全糖奶茶）则诚实存档、不盖章。',
      rules:
        '用户设定起止日期、勾选所需字段（数字、文本、单选、多选、布尔、时长、评分），并设定达到什么条件才算有效打卡。',
    },
  },
]

export const MODULE_SPEC_BY_SLUG = Object.fromEntries(
  MODULE_SPECS.map((m) => [m.slug, m]),
) as Record<string, ModuleSpec>
