'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { dietDocs } from '@/features/checkin/modules/diet/docs'
import { buildDietReport } from '@/features/checkin/modules/diet/report'
import { DEFAULT_RULES } from '@/features/referee/defaults'
import type { PriorDietMeal } from '@/features/referee/rules/common'
import { judgeDiet } from '@/features/referee/rules/diet'
import type { DietDishFact, RefereeTier } from '@/features/referee/schemas'
import { cn } from '@/lib/cn'
import { FlowStage } from '../../_components/flow/flow-stage'
import type {
  FillSectionSpec,
  FlowScenario,
  PhoneFlowConfig,
  Verdict,
} from '../../_components/flow/flow-types'
import { PhoneFlow } from '../../_components/flow/phone-flow'
import { DietRefereeScenariosMatrix, DietConstitutionAndRuleSection } from './diet-demos'
import { TimePicker } from '../../_components/flow/time-picker'

/*
 * Playbook 饮食整页沙盒：
 * 严禁在此处复制独立算分函数！直接调用生产环境的 judgeDiet、dietDocs 与 buildDietReport，
 * 确保 Playbook 演示与正式版规则 100% 同源。
 */

type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'
const MEAL_LABEL: Record<Meal, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

const DISH_LIBRARY: DietDishFact[] = [
  {
    name: '水煮蛋',
    portion: '1颗（约60g）',
    kcal: 85,
    proteinG: 7,
    carbG: 0.6,
    fatG: 5.5,
    fiberG: 0,
    sodiumMg: 70,
    gi: 0,
    junk: false,
    sweet: false,
    carbQuality: 'none',
    fatQuality: 'normal',
    cooking: 'boiled',
    source: 'table',
  },
  {
    name: '纯牛奶',
    portion: '250ml',
    kcal: 135,
    proteinG: 8,
    carbG: 12,
    fatG: 8,
    fiberG: 0,
    sodiumMg: 100,
    gi: 28,
    junk: false,
    sweet: false,
    carbQuality: 'none',
    fatQuality: 'normal',
    cooking: 'other',
    source: 'table',
  },
  {
    name: '糙米杂粮饭',
    portion: '130g',
    kcal: 150,
    proteinG: 3.2,
    carbG: 31,
    fatG: 1.2,
    fiberG: 2.4,
    sodiumMg: 3,
    gi: 55,
    junk: false,
    sweet: false,
    carbQuality: 'complex',
    fatQuality: 'normal',
    cooking: 'steamed',
    source: 'table',
  },
  {
    name: '清蒸鲈鱼',
    portion: '160g',
    kcal: 140,
    proteinG: 27,
    carbG: 0,
    fatG: 3,
    fiberG: 0,
    sodiumMg: 180,
    gi: 0,
    junk: false,
    sweet: false,
    carbQuality: 'none',
    fatQuality: 'healthy',
    cooking: 'steamed',
    source: 'table',
  },
  {
    name: '蒜蓉西兰花',
    portion: '180g',
    kcal: 95,
    proteinG: 5,
    carbG: 10,
    fatG: 4,
    fiberG: 4.5,
    sodiumMg: 220,
    gi: 15,
    junk: false,
    sweet: false,
    carbQuality: 'none',
    fatQuality: 'normal',
    cooking: 'boiled',
    source: 'table',
  },
  {
    name: '番茄炒蛋',
    portion: '150g',
    kcal: 160,
    proteinG: 10,
    carbG: 6,
    fatG: 11,
    fiberG: 1,
    sodiumMg: 380,
    gi: 30,
    junk: false,
    sweet: false,
    carbQuality: 'none',
    fatQuality: 'normal',
    cooking: 'stir-fried',
    source: 'table',
  },
  {
    name: '甜玉米',
    portion: '1根',
    kcal: 190,
    proteinG: 5,
    carbG: 38,
    fatG: 2,
    fiberG: 4,
    sodiumMg: 15,
    gi: 55,
    junk: false,
    sweet: false,
    carbQuality: 'complex',
    fatQuality: 'normal',
    cooking: 'boiled',
    source: 'table',
  },
  {
    name: '香煎鸡胸肉',
    portion: '150g',
    kcal: 210,
    proteinG: 32,
    carbG: 1,
    fatG: 6,
    fiberG: 0,
    sodiumMg: 320,
    gi: 0,
    junk: false,
    sweet: false,
    carbQuality: 'none',
    fatQuality: 'normal',
    cooking: 'grilled',
    source: 'table',
  },
  {
    name: '炸鸡腿',
    portion: '120g',
    kcal: 330,
    proteinG: 20,
    carbG: 15,
    fatG: 21,
    fiberG: 0.5,
    sodiumMg: 620,
    gi: 70,
    junk: true,
    sweet: false,
    carbQuality: 'refined',
    fatQuality: 'unhealthy',
    cooking: 'fried',
    source: 'table',
  },
  {
    name: '冰镇含糖可乐',
    portion: '330ml',
    kcal: 140,
    proteinG: 0,
    carbG: 35,
    fatG: 0,
    fiberG: 0,
    sodiumMg: 10,
    gi: 63,
    junk: true,
    sweet: true,
    carbQuality: 'refined',
    fatQuality: 'normal',
    cooking: 'other',
    source: 'table',
  },
]

interface Data {
  text: string
  meal: Meal
  snackTime: string
  note: string
  tier: RefereeTier
  priorMeals: PriorDietMeal[]
}

const DEFAULT_FAVS = ['空腹', '水煮蛋', '纯牛奶', '糙米杂粮饭', '清蒸鲈鱼', '蒜蓉西兰花', '甜玉米']

function splitNames(text: string): string[] {
  return text
    .split(/[、,，;；+＋\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function parseDishes(text: string): DietDishFact[] {
  const seen = new Set<string>()
  const out: DietDishFact[] = []
  for (const n of splitNames(text)) {
    if (/空腹|断食/.test(n)) {
      out.push({
        name: '空腹',
        portion: '',
        kcal: 0,
        proteinG: 0,
        carbG: 0,
        fatG: 0,
        fiberG: 0,
        sodiumMg: 0,
        gi: 0,
        junk: false,
        sweet: false,
        isFasting: true,
        carbQuality: 'none',
        fatQuality: 'normal',
        cooking: 'other',
        source: 'table',
      })
      continue
    }
    const hit = DISH_LIBRARY.find((d) => d.name === n || d.name.includes(n) || n.includes(d.name))
    const dish: DietDishFact = hit ?? {
      name: n,
      portion: '1 份',
      kcal: 220,
      proteinG: 12,
      carbG: 24,
      fatG: 8,
      fiberG: 2,
      sodiumMg: 380,
      gi: 52,
      junk: false,
      sweet: false,
      carbQuality: 'none',
      fatQuality: 'normal',
      cooking: 'other',
      source: 'web',
    }
    if (seen.has(dish.name)) continue
    seen.add(dish.name)
    out.push(dish)
  }
  return out
}

function mealOf(mealType: Meal, names: string[]): PriorDietMeal {
  const dishes = parseDishes(names.join('、'))
  return {
    mealType,
    items: dishes.map((d) => ({ name: d.name, portion: d.portion, kcal: d.kcal })),
    note: null,
    dishes,
  }
}

const SCENARIOS: (FlowScenario & { data: Data })[] = [
  {
    id: 'a',
    code: 'A',
    title: '减脂三餐集齐（含 85kcal 轻晚餐）',
    description: '早午已打卡，晚餐吃 1 颗水煮蛋控卡：不扣分反加分，弹出三餐庆祝总分卡。',
    passed: true,
    data: {
      text: '水煮蛋',
      meal: 'dinner',
      snackTime: '',
      note: '',
      tier: 'strict-fat-loss',
      priorMeals: [
        mealOf('breakfast', ['纯牛奶', '水煮蛋']),
        mealOf('lunch', ['糙米杂粮饭', '清蒸鲈鱼', '蒜蓉西兰花']),
      ],
    },
  },
  {
    id: 'b',
    code: 'B',
    title: '仅打第 1 餐（1/3 待汇总态）',
    description: '只记早餐纯牛奶：解析营养但不打单餐分、不判死刑、不提前弹盖章窗。',
    passed: true,
    data: {
      text: '纯牛奶',
      meal: 'breakfast',
      snackTime: '',
      note: '',
      tier: 'strict-fat-loss',
      priorMeals: [],
    },
  },
  {
    id: 'c',
    code: 'C',
    title: '零膳食纤维三餐（不扣纤维分）',
    description: '早牛奶鸡蛋、午鲈鱼、晚鸡胸肉（全天 0g 纤维）：缺纤维绝不扣分，稳稳高分达标。',
    passed: true,
    data: {
      text: '香煎鸡胸肉',
      meal: 'dinner',
      snackTime: '',
      note: '',
      tier: 'balanced-glycemic',
      priorMeals: [mealOf('breakfast', ['纯牛奶', '水煮蛋']), mealOf('lunch', ['清蒸鲈鱼'])],
    },
  },
  {
    id: 'd',
    code: 'D',
    title: '三餐达标后夜宵炸鸡可乐（硬覆盖）',
    description: '早午晚原本已达标，加餐吃炸鸡配可乐：触发一票否决，全天总分硬覆盖为 0.0 分。',
    passed: false,
    data: {
      text: '炸鸡腿、冰镇含糖可乐',
      meal: 'snack',
      snackTime: '22:30',
      note: '',
      tier: 'strict-fat-loss',
      priorMeals: [
        mealOf('breakfast', ['纯牛奶', '水煮蛋']),
        mealOf('lunch', ['糙米杂粮饭', '番茄炒蛋']),
        mealOf('dinner', ['甜玉米', '清蒸鲈鱼']),
      ],
    },
  },
]

const DOCS = dietDocs(DEFAULT_RULES.diet)

const CONFIG: PhoneFlowConfig = {
  tone: 'diet',
  title: '科学饮食打卡',
  progress: { done: 12, total: 30 },
  agentSteps: [
    '解析当前餐次的每一道菜',
    '查询营养表并核对备注上下文',
    '关联今日已打卡餐次进度',
    '按全天三餐统一规则生成结论',
  ],
  rulesDoc: DOCS.rulesDoc,
  basisDoc: DOCS.basisDoc,
}

export function DietFlowSandbox() {
  const [scenarioId, setScenarioId] = useState('a')
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!
  const [data, setData] = useState<Data>(SCENARIOS[0]!.data)
  const [favs, setFavs] = useState<string[]>(DEFAULT_FAVS)
  const [sheet, setSheet] = useState<null | 'favs'>(null)
  const enteredRef = useRef<string | null>(null)
  const clock = useSyncExternalStore(
    () => () => undefined,
    () => (enteredRef.current ??= nowHHMM()),
    () => '',
  )
  const snackAt = data.snackTime || clock || '12:00'
  const [draftFav, setDraftFav] = useState('')

  const dishes = parseDishes(data.text)
  const input = {
    module: 'diet' as const,
    method: 'manual' as const,
    mealType: data.meal,
    items: dishes.map((d) => ({ name: d.name, portion: d.portion, kcal: d.kcal })),
    ...(data.meal === 'snack' ? { snackTime: snackAt } : {}),
    note: data.note || null,
  }
  const realVerdict = judgeDiet(
    { mealType: data.meal, items: input.items, note: input.note },
    {
      rules: DEFAULT_RULES.diet,
      facts: dishes.length > 0 ? { module: 'diet', dishes } : null,
      tier: data.tier,
      priorDietMeals: data.priorMeals.filter((m) => m.mealType !== data.meal),
    },
  )
  const isPending = realVerdict.settlement === 'pending'
  const kcalText = (v: unknown) => (typeof v === 'number' ? (v === 0 ? '空腹' : `${v} kcal`) : '—')

  const verdict: Verdict = {
    passed: realVerdict.isValid,
    pending: isPending,
    score: isPending
      ? `${String(realVerdict.metrics.mealsLogged ?? 1)}/3`
      : realVerdict.score !== null
        ? realVerdict.score.toFixed(1)
        : undefined,
    scoreHint: isPending ? '三餐齐备算总分' : '/ 5.0 · 线 3.0',
    detail: realVerdict.detail,
    dailySummary:
      !isPending && realVerdict.score !== null
        ? {
            totalScore: realVerdict.score.toFixed(1),
            breakfastKcal: kcalText(realVerdict.metrics.breakfastKcal),
            lunchKcal: kcalText(realVerdict.metrics.lunchKcal),
            dinnerKcal: kcalText(realVerdict.metrics.dinnerKcal),
            footer: `全天共 ${String(realVerdict.metrics.dailyKcal ?? 0)} kcal · 蛋白 ${String(realVerdict.metrics.dailyProtein ?? 0)}g · 纤维 ${String(realVerdict.metrics.dailyFiber ?? 0)}g`,
          }
        : undefined,
  }

  function toggleTag(name: string) {
    setData((d) => {
      const names = splitNames(d.text)
      const next = names.includes(name) ? names.filter((x) => x !== name) : [...names, name]
      return { ...d, text: next.join('、') }
    })
  }

  const names = splitNames(data.text)
  const mealKcal = dishes.reduce((s, d) => s + d.kcal, 0)
  const sections: FillSectionSpec[] = [
    {
      id: 'dishes',
      label: '吃了什么',
      icon: 'diet',
      filled: dishes.length > 0,
      summary: dishes.length ? `${dishes.length} 道 · ${mealKcal} kcal` : '输入或点选你吃的东西',
      onLongPress: () => setSheet('favs'),
      content: (
        <>
          <div
            className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="常吃的食物"
          >
            {favs.map((name) => {
              const on = names.includes(name)
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTag(name)}
                  className={cn(
                    'text-tiny min-h-7 shrink-0 rounded-full border px-2.5 font-semibold whitespace-nowrap transition-colors',
                    on
                      ? 'border-diet bg-diet-soft text-diet-ink'
                      : 'border-border bg-surface-sunken text-muted hover:text-foreground',
                  )}
                >
                  {name}
                </button>
              )
            })}
          </div>
          <Input
            aria-label="吃了什么"
            value={data.text}
            placeholder="例如：糙米饭、清蒸鲈鱼"
            onChange={(e) => setData((d) => ({ ...d, text: e.target.value }))}
          />
        </>
      ),
    },
    {
      id: 'note',
      label: '备注',
      icon: 'pen',
      filled: data.note.length > 0,
      summary: data.note || '可选',
      content: (
        <Input
          aria-label="备注"
          value={data.note}
          placeholder="例如：晚上没吃饭只吃菜、空腹"
          onChange={(e) => setData((d) => ({ ...d, note: e.target.value }))}
        />
      ),
    },
  ]

  const leadSection: FillSectionSpec | null =
    data.meal === 'snack'
      ? {
          id: 'snack-time',
          label: '加餐时间',
          icon: 'clock',
          filled: true,
          summary: snackAt,
          content: (
            <TimePicker
              label="加餐时间"
              tone="diet"
              value={snackAt}
              onChange={(snackTime) => setData((d) => ({ ...d, snackTime }))}
            />
          ),
        }
      : null

  function onModeChange() {
    setData(scenario.data)
  }

  function selectScenario(id: string) {
    setScenarioId(id)
    setData(SCENARIOS.find((s) => s.id === id)?.data ?? SCENARIOS[0]!.data)
  }

  const checkedSet = new Set(data.priorMeals.map((m) => m.mealType))
  const selector = (
    <SegmentedControl
      size="sm"
      label="餐次"
      value={data.meal}
      onValueChange={(meal) => setData((d) => ({ ...d, meal }))}
      options={[
        { value: 'breakfast', label: checkedSet.has('breakfast') ? '早餐 ✓' : '早餐' },
        { value: 'lunch', label: checkedSet.has('lunch') ? '午餐 ✓' : '午餐' },
        { value: 'dinner', label: checkedSet.has('dinner') ? '晚餐 ✓' : '晚餐' },
        { value: 'snack', label: checkedSet.has('snack') ? '加餐 ✓' : '加餐' },
      ]}
    />
  )

  const overlay =
    sheet === 'favs' ? (
      <div
        className="bg-foreground/30 absolute inset-0 z-30 flex items-end"
        role="dialog"
        aria-label="自定义常吃的食物"
      >
        <div className="bg-surface animate-fade-up flex w-full flex-col gap-3 rounded-t-xl px-4 pt-4 pb-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-subhead font-bold">我常吃的食物</span>
            <span className="text-tiny text-muted">
              这些会作为快捷标签出现在「吃了什么」上方，不再用系统预设。
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {favs.map((name) => (
              <span
                key={name}
                className="text-tiny bg-diet-soft text-diet-ink inline-flex min-h-7 items-center gap-1 rounded-full pr-1.5 pl-2.5 font-semibold"
              >
                {name}
                <button
                  type="button"
                  aria-label={`移除${name}`}
                  onClick={() => setFavs((f) => f.filter((x) => x !== name))}
                  className="grid size-4 place-items-center rounded-full hover:bg-black/10"
                >
                  <Icon name="x" size={10} />
                </button>
              </span>
            ))}
            {favs.length === 0 && <span className="text-tiny text-subtle">还没有，添加一个吧</span>}
          </div>
          <div className="flex gap-2">
            <Input
              aria-label="添加常吃的食物"
              value={draftFav}
              placeholder="添加，如：燕麦粥"
              onChange={(e) => setDraftFav(e.target.value)}
            />
            <Button
              variant="soft"
              icon="plus"
              disabled={!draftFav.trim() || favs.includes(draftFav.trim())}
              onClick={() => {
                setFavs((f) => [...f, draftFav.trim()])
                setDraftFav('')
              }}
            >
              添加
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setFavs(DEFAULT_FAVS)}>
              恢复系统推荐
            </Button>
            <Button className="flex-1" onClick={() => setSheet(null)}>
              完成
            </Button>
          </div>
        </div>
      </div>
    ) : null

  return (
    <FlowStage
      ann="playbook.modules.diet.sandbox"
      phoneLabel="手机 · 科学饮食打卡"
      scenarios={SCENARIOS}
      activeId={scenarioId}
      onSelect={selectScenario}
      phone={
        <PhoneFlow
          key={scenarioId}
          config={CONFIG}
          rulesPage={<DietConstitutionAndRuleSection />}
          basisPage={<DietRefereeScenariosMatrix />}
          selector={selector}
          sections={sections}
          aiSummary={`${MEAL_LABEL[data.meal]}${data.meal === 'snack' ? ` ${snackAt}` : ''} · ${dishes.length} 道菜`}
          verdict={verdict}
          canSubmit={dishes.length > 0}
          report={buildDietReport(realVerdict, input)}
          onModeChange={onModeChange}
          overlay={overlay}
          leadSection={leadSection}
        />
      }
    />
  )
}

function nowHHMM(): string {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}
