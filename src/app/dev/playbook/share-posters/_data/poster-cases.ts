import type { MascotMood, MascotRegistryCharacter } from '@/components/mascot/mascot-svg'
import type { ModuleTone } from '@/components/ui/tone'
import type { CheckinGoal } from '@/features/checkin/components/form-types'
import type { Checkin, CreateCheckinInput, MealType } from '@/features/checkin/schemas'
import type { ReportPosterInput } from '@/features/checkin/share/report-poster'
import type { FieldDef } from '@/features/goal/schemas'
import { judge } from '@/features/referee/rules'
import type { PriorDietMeal } from '@/features/referee/rules/common'
import type { DietDishFact, Facts, RefereeTier } from '@/features/referee/schemas'
import { judgeInputOf } from '@/features/referee/subject'

/*
 * 分享海报画廊的用例：每个板块覆盖「达标 / 存档 / 内容多 / 内容少 / 离线无事实」等不同打卡设置。
 * 结论全部由真实的 judge() 算出（checkin-modules.md 第 8 节：Playbook 不另写判据）。
 */

export interface PosterCase {
  id: string
  module: ModuleTone
  label: string
  note: string
  mood: MascotMood
  character: MascotRegistryCharacter
  input: Omit<ReportPosterInput, 'mascotDataUrl' | 'orientation'>
}

const TODAY = '2026-11-19'
const TZ = 'Asia/Shanghai'

function goal(module: ModuleTone, title: string, fields: FieldDef[] | null = null): CheckinGoal {
  return {
    id: `demo-${module}`,
    module,
    title,
    target: { kind: 'count', value: 1 },
    fields,
    fieldVersion: fields ? 1 : null,
  }
}

function dish(
  name: string,
  kcal: number,
  proteinG: number,
  carbG: number,
  fatG: number,
  fiberG: number,
  sodiumMg: number,
  gi: number,
  extra: Partial<DietDishFact> = {},
): DietDishFact {
  return {
    name,
    portion: '1 份',
    kcal,
    proteinG,
    carbG,
    fatG,
    fiberG,
    sodiumMg,
    gi,
    junk: false,
    sweet: false,
    cooking: 'other',
    source: 'table',
    ...extra,
  }
}

interface BuildOptions {
  id: string
  label: string
  note: string
  goal: CheckinGoal
  subject: CreateCheckinInput
  facts?: Facts | null
  tier?: RefereeTier
  storedRules?: unknown
  priorDietMeals?: PriorDietMeal[]
  priorMinutesToday?: number
  advice?: string[]
  period?: { done: number; total: number }
  character?: MascotRegistryCharacter
  petName?: string
}

function build(o: BuildOptions): PosterCase {
  const verdict = judge(
    judgeInputOf(o.subject, {
      timeZone: TZ,
      fields: o.goal.fields ?? null,
      storedRules: o.storedRules ?? null,
      facts: o.facts ?? null,
      tier: o.tier ?? 'balanced-glycemic',
      priorDietMeals: o.priorDietMeals,
      priorMinutesToday: o.priorMinutesToday,
      extras: { refereeRunId: null, citations: [], advice: o.advice ?? [] },
    }),
  )
  const todayCheckins = (o.priorDietMeals ?? []).map((m, i) => priorCheckin(o.goal.id, m, i))
  return {
    id: o.id,
    module: o.goal.module,
    label: o.label,
    note: o.note,
    mood: verdict.isValid ? 'cheer' : verdict.settlement === 'pending' ? 'happy' : 'sleepy',
    character: o.character ?? 'tuan',
    input: {
      module: o.goal.module,
      goal: o.goal,
      verdict,
      subject: o.subject,
      todayCheckins,
      today: TODAY,
      period: o.period ?? { done: 12, total: 21 },
      pet: { character: o.character ?? 'tuan', name: o.petName ?? '团团' },
    },
  }
}

/** 把「今天已打过的餐次」包装成海报需要的 Checkin 形状 */
function priorCheckin(goalId: string, meal: PriorDietMeal, index: number): Checkin {
  return {
    id: `demo-prior-${index}`,
    goalId,
    module: 'diet',
    localDate: TODAY,
    occurredAt: `${TODAY}T00:00:00.000Z`,
    source: 'manual',
    isMakeup: false,
    durationSeconds: null,
    count: 1,
    intakeKcal: null,
    burnKcal: null,
    note: meal.note ?? null,
    parsedText: null,
    aiRunId: null,
    fieldVersion: null,
    score: null,
    isValid: false,
    payload: { module: 'diet', method: 'manual', mealType: meal.mealType, items: meal.items },
    verdict: meal.dishes
      ? {
          version: 1,
          isValid: false,
          settlement: 'pending',
          score: null,
          scoreMax: null,
          detail: '',
          checks: [],
          metrics: {},
          facts: { module: 'diet', dishes: [...meal.dishes] },
          citations: [],
          advice: [],
          refereeRunId: null,
          offline: false,
        }
      : null,
  } as Checkin
}

function prior(mealType: MealType, dishes: DietDishFact[] | null, names?: string[]): PriorDietMeal {
  return {
    mealType,
    items: (dishes?.map((d) => d.name) ?? names ?? []).map((name) => ({
      name,
      portion: '1 份',
      kcal: null,
    })),
    dishes,
  }
}

function dietSubject(mealType: MealType, names: string[], note?: string): CreateCheckinInput {
  return {
    module: 'diet',
    method: 'manual',
    mealType,
    items: names.map((name) => ({ name, portion: '1 份', kcal: null })),
    note,
  }
}

const breakfast = [
  dish('燕麦牛奶粥', 220, 9, 34, 5, 4, 90, 55, { carbQuality: 'complex' }),
  dish('水煮蛋', 140, 12, 1, 10, 0, 120, 0),
  dish('蓝莓', 45, 1, 11, 0, 2, 2, 40),
]
const lunch = [
  dish('糙米饭', 230, 5, 48, 2, 3, 5, 56, { carbQuality: 'complex' }),
  dish('香煎鸡胸肉', 260, 42, 2, 9, 0, 480, 0),
  dish('蒜蓉西兰花', 90, 5, 9, 4, 5, 320, 15),
  dish('番茄蛋花汤', 80, 5, 6, 4, 1, 560, 30),
]
const dinner = [
  dish('玉米杂粮饭', 240, 6, 50, 2, 4, 6, 58, { carbQuality: 'complex' }),
  dish('清蒸鲈鱼', 210, 36, 0, 7, 0, 380, 0, { fatQuality: 'healthy' }),
  dish('凉拌菠菜', 70, 4, 6, 3, 4, 300, 15),
]
const snack = [dish('无糖酸奶', 110, 8, 9, 4, 0, 80, 35), dish('原味坚果', 160, 5, 5, 14, 3, 2, 15)]

const habitFields: FieldDef[] = [
  { key: 'piece', label: '练习曲目', required: true, type: 'text', maxLength: 100 },
  { key: 'minutes', label: '练琴时长', required: true, type: 'duration', maxSeconds: 86_400 },
  { key: 'bars', label: '攻克小节', required: false, type: 'number', unit: '小节', integer: true },
  { key: 'mood', label: '手感评分', required: false, type: 'rating' },
  { key: 'metronome', label: '开节拍器', required: false, type: 'boolean' },
  {
    key: 'focus',
    label: '重点练习',
    required: false,
    type: 'multi-select',
    options: ['音阶', '琶音', '视奏', '背谱'],
  },
]

export const POSTER_CASES: PosterCase[] = [
  build({
    id: 'diet-settled',
    label: '饮食 · 三餐 + 加餐已结算',
    note: '全天口径：小票列四个餐次，餐盘显示全天总分',
    goal: goal('diet', '好好吃饭'),
    subject: dietSubject(
      'dinner',
      dinner.map((d) => d.name),
    ),
    facts: { module: 'diet', dishes: dinner },
    priorDietMeals: [prior('breakfast', breakfast), prior('lunch', lunch), prior('snack', snack)],
    advice: ['晚餐把汤里的盐再减一点，全天钠会更漂亮'],
  }),
  build({
    id: 'diet-pending',
    label: '饮食 · 只记了早餐（分餐中）',
    note: 'pending：不出总分，餐盘显示本餐热量，小票只有一餐',
    goal: goal('diet', '好好吃饭'),
    subject: dietSubject(
      'breakfast',
      breakfast.map((d) => d.name),
    ),
    facts: { module: 'diet', dishes: breakfast },
    period: { done: 3, total: 30 },
    character: 'dun',
    petName: '墩墩',
  }),
  build({
    id: 'diet-junk',
    label: '饮食 · 一票否决 + 菜很多',
    note: '未达标存档；午餐 8 道菜触发小票折叠',
    goal: goal('diet', '减脂期三餐打卡挑战'),
    tier: 'strict-fat-loss',
    subject: dietSubject('dinner', ['炸鸡桶', '可乐']),
    facts: {
      module: 'diet',
      dishes: [
        dish('炸鸡桶', 980, 52, 60, 58, 2, 2400, 70, { junk: true, fatQuality: 'unhealthy' }),
        dish('可乐', 210, 0, 53, 0, 0, 20, 63, { junk: true, sweet: true }),
      ],
    },
    priorDietMeals: [
      prior('breakfast', null, ['全麦面包', '黑咖啡']),
      prior('lunch', [
        ...lunch,
        dish('红烧排骨', 380, 22, 12, 28, 0, 900, 40),
        dish('麻婆豆腐', 240, 14, 10, 16, 2, 1100, 30),
        dish('酸辣土豆丝', 150, 3, 22, 6, 3, 520, 60),
        dish('米饭', 230, 4, 50, 1, 1, 3, 83, { carbQuality: 'refined' }),
      ]),
    ],
    period: { done: 47, total: 100 },
  }),
  build({
    id: 'diet-offline',
    label: '饮食 · 离线无营养事实 + 轻断食',
    note: '没有事实时餐盘是空环，小票用手填的菜名兜底',
    goal: goal('diet', '好好吃饭'),
    subject: dietSubject('dinner', ['牛肉面', '卤蛋']),
    priorDietMeals: [
      { mealType: 'breakfast', items: [{ name: '空腹', portion: '', kcal: null }], dishes: null },
      prior('lunch', null, ['食堂两荤一素', '紫菜汤']),
    ],
    character: 'mian',
    petName: '绵绵',
  }),
  build({
    id: 'exercise-multi',
    label: '运动 · 四项混合（一项未达标）',
    note: '距离制 + 组数制混排，未达标赛道用虚线',
    goal: goal('exercise', '动一动'),
    subject: {
      module: 'exercise',
      category: '综合训练',
      intensity: 'moderate',
      durationSeconds: 83 * 60,
      items: [
        { name: '晨跑', calc: 'distance', minutes: 32, km: 5.2 },
        { name: '哑铃推举', calc: 'count', minutes: 18, sets: 5 },
        { name: '平板支撑', calc: 'count', minutes: 8, sets: 3 },
        { name: '骑行通勤', calc: 'distance', minutes: 25, km: 6.5, kcal: 180, heartRate: 128 },
      ],
    },
    facts: {
      module: 'exercise',
      weightKg: 62,
      items: [
        {
          name: '晨跑',
          calc: 'distance',
          minutes: 32,
          km: 5.2,
          sets: null,
          met: 9.8,
          kcal: 324,
          fromDevice: false,
        },
        {
          name: '哑铃推举',
          calc: 'count',
          minutes: 18,
          km: null,
          sets: 5,
          met: 5,
          kcal: 93,
          fromDevice: false,
        },
        {
          name: '平板支撑',
          calc: 'count',
          minutes: 8,
          km: null,
          sets: 3,
          met: 3.8,
          kcal: 31,
          fromDevice: false,
        },
        {
          name: '骑行通勤',
          calc: 'distance',
          minutes: 25,
          km: 6.5,
          sets: null,
          met: 6.8,
          kcal: 180,
          fromDevice: true,
        },
      ],
    },
    character: 'you',
    petName: '柚柚',
  }),
  build({
    id: 'exercise-single',
    label: '运动 · 只有一项',
    note: '单项时跑道仍保留三条赛道的节奏',
    goal: goal('exercise', '每天慢跑'),
    subject: {
      module: 'exercise',
      category: '慢跑',
      intensity: 'easy',
      durationSeconds: 28 * 60,
      items: [{ name: '夜跑', calc: 'distance', minutes: 28, km: 4 }],
    },
    period: { done: 1, total: 7 },
  }),
  build({
    id: 'exercise-archived',
    label: '运动 · 未达标存档（老数据无明细）',
    note: '只有品类 + 时长，没有 items 与事实',
    goal: goal('exercise', '饭后散步'),
    subject: { module: 'exercise', category: '散步', intensity: 'easy', durationSeconds: 9 * 60 },
  }),
  build({
    id: 'sleep-valid',
    label: '睡眠 · 双门槛达标 + 手环分期',
    note: '月亮弧线在红线之前升起',
    goal: goal('sleep', '早点睡'),
    subject: {
      module: 'sleep',
      bedAt: '2026-11-18T14:52:00.000Z',
      wakeAt: '2026-11-18T22:40:00.000Z',
      quality: 4,
      advanced: { deepMin: 96, lightMin: 262, remPct: 22, hrvMs: 58 },
    },
    facts: { module: 'sleep', regularityMinutes: 18, recentNights: 6 },
  }),
  build({
    id: 'sleep-late',
    label: '睡眠 · 熬夜补觉（晚于红线）',
    note: '红线小旗变成警示色；没有手环数据、规律度待满两晚',
    goal: goal('sleep', '23 点前上床睡觉计划'),
    storedRules: { module: 'sleep', bedtimeBy: '23:00', minHours: 7 },
    subject: {
      module: 'sleep',
      bedAt: '2026-11-18T17:35:00.000Z',
      wakeAt: '2026-11-19T01:10:00.000Z',
      quality: 2,
    },
    character: 'mian',
    petName: '绵绵',
  }),
  build({
    id: 'study-rich',
    label: '学习 · 五条要点 + 碎片累加',
    note: '此前已学 50 分钟，本次 45 分钟',
    goal: goal('study', '学一点'),
    subject: {
      module: 'study',
      what: '线性代数：特征值与特征向量',
      durationSeconds: 45 * 60,
      points: ['特征方程', '对角化条件', '实对称矩阵'],
    },
    priorMinutesToday: 50,
    facts: {
      module: 'study',
      substantive: true,
      subject: '线性代数',
      summary: '梳理了特征值的几何意义，并用三道例题练习了相似对角化的完整流程。',
      keyPoints: [
        '特征向量是变换后方向不变的向量，特征值是它被拉伸的倍数',
        '求特征值：解特征方程 det(A − λE) = 0',
        '可对角化 ⇔ 有 n 个线性无关的特征向量',
        '实对称矩阵一定可以正交对角化',
        '相似矩阵有相同的特征值、迹和行列式',
      ],
      todayMinutesBefore: 50,
    },
  }),
  build({
    id: 'study-bare',
    label: '学习 · 没写要点、时长不够',
    note: '离线判定，笔记页只有主题与占位文案',
    goal: goal('study', '每天背单词'),
    subject: { module: 'study', what: '背单词', durationSeconds: 10 * 60 },
    period: { done: 5, total: 14 },
    character: 'dun',
    petName: '墩墩',
  }),
  build({
    id: 'custom-rich',
    label: '自定义 · 六个字段 + 条件 + AI 判卷',
    note: '票根两列排布，集章卡 21 天',
    goal: goal('custom', '每天练琴', habitFields),
    storedRules: {
      module: 'custom',
      conditions: [
        { key: 'minutes', op: 'gte', value: 30 },
        { key: 'piece', op: 'filled' },
      ],
      aiCriteria: '要写清练了哪首曲子的哪几个小节',
    },
    subject: {
      module: 'custom',
      fieldVersion: 1,
      values: {
        piece: '肖邦《夜曲》Op.9 No.2',
        minutes: 45 * 60,
        bars: 16,
        mood: 4,
        metronome: true,
        focus: ['琶音', '背谱'],
      },
      note: '第 9–24 小节的左手琶音终于顺了',
    },
    facts: {
      module: 'custom',
      aiPass: true,
      aiComment: '曲目与小节范围都写清楚了，练习有针对性。',
    },
    character: 'you',
    petName: '柚柚',
  }),
  build({
    id: 'custom-min',
    label: '自定义 · 只有一个字段、长周期',
    note: '没有条件；100 天周期的集章卡只展示包含今天的一段',
    goal: goal('custom', '喝够八杯水', [
      { key: 'cups', label: '今天喝了', required: true, type: 'number', unit: '杯', integer: true },
    ]),
    subject: { module: 'custom', fieldVersion: 1, values: { cups: 8 } },
    period: { done: 63, total: 100 },
  }),
  build({
    id: 'skip',
    label: '跳过打卡 · 请假条',
    note: '理由核验通过后，所有板块共用请假条版式',
    goal: goal('exercise', '动一动'),
    subject: {
      module: 'exercise',
      category: '休息',
      intensity: 'easy',
      durationSeconds: 60,
      skipReason: '昨晚发烧到 38.5℃，医生让卧床休息两天',
    },
    facts: {
      module: 'exercise',
      weightKg: null,
      items: [
        {
          name: '休息',
          calc: 'distance',
          minutes: 1,
          km: null,
          sets: null,
          met: 1,
          kcal: 0,
          fromDevice: false,
        },
      ],
      skipApproved: true,
      skipComment: '发烧需要卧床休息，理由充分，今天的运动打卡豁免通过。',
    },
  }),
]
