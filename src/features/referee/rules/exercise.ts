import type { FactsOf, RulesOf, Verdict } from '../schemas'
import { buildVerdict, round1, type JudgeContext } from './common'

/*
 * 动一动：运动类型自填，每项按「怎么计量」各用各的阈值（Playbook exercise-flow）。
 *   distance = 按时间 + 距离（跑、走、骑、游泳…）：时长 ≥ distanceMinMinutes 或 距离 ≥ distanceMinKm
 *   count    = 按时间 + 组数（力量、核心…）：时长 ≥ countMinMinutes 或 组数 ≥ countMinSets
 * 一次打卡可以有多项，任一项达标就有效。强度只是备注，不参与判定。
 */

export type ExerciseCalc = 'distance' | 'count'

export interface ExerciseSubjectItem {
  name: string
  calc: ExerciseCalc
  minutes: number
  km: number | null
  sets: number | null
  /** 手表 / App 截图给的消耗；没有为 null */
  kcal: number | null
}

export interface ExerciseSubject {
  items: ExerciseSubjectItem[]
}

const COUNT_RE =
  /力量|深蹲|卧推|硬拉|俯卧撑|引体|平板|核心|哑铃|杠铃|仰卧|臀桥|撸铁|健身|拉伸|普拉提|瑜伽|跳绳/
const DISTANCE_RE = /跑|走|骑|游泳|徒步|爬山|登山|划船|滑雪|散步|远足|竞走/

/** 按运动名称猜计量方式；猜不出返回 null（界面按时间 + 距离兜底） */
export function detectCalc(name: string): ExerciseCalc | null {
  if (COUNT_RE.test(name)) return 'count'
  if (DISTANCE_RE.test(name)) return 'distance'
  return null
}

/** 常见运动的代谢当量（《身体活动纲要》Compendium of Physical Activities 2011 取整） */
export const MET_TABLE: readonly { re: RegExp; met: number; label: string }[] = [
  { re: /冲刺|间歇跑/, met: 10, label: '间歇跑' },
  { re: /跑/, met: 8, label: '跑步' },
  { re: /跳绳/, met: 11, label: '跳绳' },
  { re: /游泳/, met: 7, label: '游泳' },
  { re: /骑/, met: 6.8, label: '骑行' },
  { re: /爬山|登山|徒步/, met: 6.5, label: '登山徒步' },
  { re: /篮球|足球|羽毛球|网球|排球|乒乓/, met: 6.5, label: '球类' },
  { re: /快走|健步/, met: 4.3, label: '快走' },
  { re: /散步|慢走|走/, met: 3, label: '步行' },
  { re: /瑜伽|拉伸|普拉提/, met: 2.8, label: '瑜伽拉伸' },
  { re: /深蹲|卧推|硬拉|力量|哑铃|杠铃|撸铁|健身|引体|俯卧撑/, met: 5, label: '力量训练' },
  { re: /平板|核心|仰卧|臀桥/, met: 3.8, label: '核心训练' },
]

export function metOf(name: string, calc: ExerciseCalc): { met: number; label: string } {
  const hit = MET_TABLE.find((r) => r.re.test(name))
  if (hit) return { met: hit.met, label: hit.label }
  return { met: calc === 'count' ? 5 : 4.5, label: '其他运动' }
}

/** 消耗 ≈ MET × 体重(kg) × 小时 */
export function estimateKcal(met: number, minutes: number, weightKg: number | null): number {
  return Math.round(met * (weightKg ?? 60) * (minutes / 60))
}

function itemPassed(it: ExerciseSubjectItem, rules: RulesOf<'exercise'>): boolean {
  if (it.calc === 'count') {
    return it.minutes >= rules.countMinMinutes || (it.sets ?? 0) >= rules.countMinSets
  }
  return it.minutes >= rules.distanceMinMinutes || (it.km ?? 0) >= rules.distanceMinKm
}

export function itemRuleText(calc: ExerciseCalc, rules: RulesOf<'exercise'>): string {
  return calc === 'count'
    ? `时长 ≥ ${rules.countMinMinutes} 分钟 或 组数 ≥ ${rules.countMinSets} 组`
    : `时长 ≥ ${rules.distanceMinMinutes} 分钟 或 距离 ≥ ${rules.distanceMinKm} 公里`
}

export function judgeExercise(
  subject: ExerciseSubject,
  ctx: JudgeContext<RulesOf<'exercise'>, FactsOf<'exercise'>>,
): Verdict {
  const { rules, facts, extras } = ctx
  const items = subject.items.filter((i) => i.name.trim() && i.minutes > 0)
  const weightKg = facts?.weightKg ?? null
  const rows = items.map((it, i) => {
    const fact = facts?.items[i]
    const met = fact?.met ?? metOf(it.name, it.calc).met
    const kcal = it.kcal ?? fact?.kcal ?? estimateKcal(met, it.minutes, weightKg)
    return { it, met, kcal, passed: itemPassed(it, rules) }
  })
  const passedRows = rows.filter((r) => r.passed)
  const isValid = passedRows.length > 0
  const kcal = rows.reduce((a, r) => a + r.kcal, 0)
  const minutes = rows.reduce((a, r) => a + r.it.minutes, 0)
  const load = kcal / 400

  const advice: string[] = []
  if (!isValid && rows[0]) {
    const it = rows[0].it
    advice.push(
      it.calc === 'count'
        ? `再做 ${Math.max(1, rules.countMinSets - (it.sets ?? 0))} 组就能盖章`
        : `再走 / 跑 ${Math.max(1, rules.distanceMinMinutes - it.minutes)} 分钟就能盖章`,
    )
  }
  if (load >= 0.7) advice.push('强度不低，今晚早点休息，补充蛋白质')

  return buildVerdict({
    isValid,
    detail: isValid
      ? `「${passedRows.map((r) => r.it.name).join('、')}」达到有效运动门槛`
      : rows.length === 0
        ? '还没有填运动内容'
        : '未达有效运动门槛，记为日常活动',
    checks: rows.map((r, i) => ({
      id: `item-${i}`,
      text: `${r.it.name}：${itemRuleText(r.it.calc, rules)}`,
      ok: r.passed,
    })),
    metrics: {
      kcal,
      minutes: round1(minutes),
      items: rows.length,
      passedItems: passedRows.length,
      load: round1(load),
      weightKg,
    },
    facts,
    advice,
    extras,
  })
}
