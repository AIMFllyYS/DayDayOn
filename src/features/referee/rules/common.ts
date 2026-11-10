import type {
  RefereeTier,
  Verdict,
  Citation,
  Check,
  Facts,
  DietDishFact,
  SettlementStage,
} from '../schemas'

/*
 * 各板块裁判函数共用的输入与结论拼装。纯函数：不读时间、不碰数据库。
 */

/** 餐次（与 features/checkin 的 MealTypeSchema 取值一致；这里不反向 import） */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/** 当日已入库的其余饮食记录快照（供饮食全天周期聚合结算） */
export interface PriorDietMeal {
  mealType: MealType
  items: { name: string; portion: string; kcal: number | null }[]
  note?: string | null
  /** 已解析的菜品营养事实；离线记录无事实时为 null */
  dishes: readonly DietDishFact[] | null
}

/** Agent 那一侧带来的、和判定无关的附加信息 */
export interface RefereeExtras {
  refereeRunId: string | null
  citations: Citation[]
  /** Agent 给的建议，排在规则建议之后，合计最多 3 条 */
  advice: string[]
}

export const NO_EXTRAS: RefereeExtras = { refereeRunId: null, citations: [], advice: [] }

export interface JudgeContext<R, F> {
  rules: R
  facts: F | null
  tier: RefereeTier
  extras?: RefereeExtras
  priorMinutesToday?: number
  /** 饮食模块当日已打卡的其他餐次（不含本次正在覆盖的同正餐） */
  priorDietMeals?: readonly PriorDietMeal[]
}

export function buildVerdict(input: {
  isValid: boolean
  settlement?: SettlementStage
  score?: number | null
  scoreMax?: number | null
  detail: string
  checks: Check[]
  metrics: Verdict['metrics']
  facts: Facts | null
  advice: string[]
  extras?: RefereeExtras
  offline?: boolean
}): Verdict {
  const extras = input.extras ?? NO_EXTRAS
  const advice = [...input.advice, ...extras.advice].filter(Boolean)
  return {
    version: 1,
    isValid: input.isValid,
    ...(input.settlement ? { settlement: input.settlement } : {}),
    score: input.score ?? null,
    scoreMax: input.scoreMax ?? null,
    detail: input.detail,
    checks: input.checks,
    metrics: input.metrics,
    facts: input.facts,
    citations: extras.citations.slice(0, 10),
    advice: [...new Set(advice)].slice(0, 3),
    refereeRunId: extras.refereeRunId,
    offline: input.offline ?? input.facts === null,
  }
}

/** 保留一位小数（分数、小时） */
export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** HH:mm → 当天分钟数；格式不对返回 null */
export function hhmmToMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}
