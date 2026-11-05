'use client'

import { useRef, useState, useSyncExternalStore } from 'react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Input } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { FlowStage } from '../../_components/flow/flow-stage'
import type {
  FillSectionSpec,
  FlowMode,
  FlowScenario,
  FolderSpec,
  PhoneFlowConfig,
  ReportSpec,
  Verdict,
} from '../../_components/flow/flow-types'
import { PhoneFlow } from '../../_components/flow/phone-flow'
import { DietRefereeScenariosMatrix, DietConstitutionAndRuleSection } from './diet-demos'
import { TimePicker } from '../../_components/flow/time-picker'

type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'
const MEAL_LABEL: Record<Meal, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

interface Dish {
  id: string
  name: string
  portion: string
  kcal: number
  gi: number
  protein: number
  carb: number
  fat: number
  fiber: number
  /** mg */
  sodium: number
  /** 一票否决 */
  junk?: boolean
  /** 不在常见库里，由 Agent 联网检索估算 */
  web?: boolean
}

const DISHES: Dish[] = [
  {
    id: 'rice',
    name: '糙米杂粮饭',
    portion: '130g',
    kcal: 150,
    gi: 55,
    protein: 3.2,
    carb: 31,
    fat: 1.2,
    fiber: 2.4,
    sodium: 3,
  },
  {
    id: 'fish',
    name: '清蒸鲈鱼',
    portion: '160g',
    kcal: 140,
    gi: 0,
    protein: 27,
    carb: 0,
    fat: 3,
    fiber: 0,
    sodium: 180,
  },
  {
    id: 'broccoli',
    name: '蒜蓉西兰花',
    portion: '180g',
    kcal: 95,
    gi: 15,
    protein: 5,
    carb: 10,
    fat: 4,
    fiber: 4.5,
    sodium: 220,
  },
  {
    id: 'egg',
    name: '番茄炒蛋',
    portion: '150g',
    kcal: 160,
    gi: 30,
    protein: 10,
    carb: 6,
    fat: 11,
    fiber: 1,
    sodium: 380,
  },
  {
    id: 'icecream',
    name: '小冰淇淋',
    portion: '80g',
    kcal: 160,
    gi: 62,
    protein: 3,
    carb: 20,
    fat: 8,
    fiber: 0,
    sodium: 50,
  },
  {
    id: 'noodle',
    name: '红油牛肉面',
    portion: '600g',
    kcal: 640,
    gi: 80,
    protein: 26,
    carb: 92,
    fat: 20,
    fiber: 3,
    sodium: 2100,
  },
  {
    id: 'chicken',
    name: '炸鸡腿',
    portion: '120g',
    kcal: 330,
    gi: 70,
    protein: 20,
    carb: 15,
    fat: 21,
    fiber: 0.5,
    sodium: 620,
    junk: true,
  },
  {
    id: 'cola',
    name: '冰镇含糖可乐',
    portion: '330ml',
    kcal: 140,
    gi: 63,
    protein: 0,
    carb: 35,
    fat: 0,
    fiber: 0,
    sodium: 10,
    junk: true,
  },
]

interface Data {
  /** 输入框里的文字，用顿号分隔；Agent 按它解析 */
  text: string
  meal: Meal
  snackTime: string
  note: string
}

const DEFAULT_FAVS = ['糙米杂粮饭', '清蒸鲈鱼', '蒜蓉西兰花', '番茄炒蛋', '小冰淇淋', '红油牛肉面']

function splitNames(text: string): string[] {
  return text
    .split(/[、,，;；+＋\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

/** 输入文字 → 菜品：常见库里有就用，没有就当作「联网检索估算」 */
function parseDishes(text: string): Dish[] {
  const seen = new Set<string>()
  const out: Dish[] = []
  for (const n of splitNames(text)) {
    const hit = DISHES.find((d) => d.name === n || d.name.includes(n) || n.includes(d.name))
    const dish: Dish = hit ?? {
      id: `web-${n}`,
      name: n,
      portion: '1 份',
      kcal: 220,
      gi: 50,
      protein: 8,
      carb: 28,
      fat: 8,
      fiber: 2,
      sodium: 400,
      web: true,
    }
    if (seen.has(dish.id)) continue
    seen.add(dish.id)
    out.push(dish)
  }
  return out
}

const SCENARIOS: (FlowScenario & { data: Data })[] = [
  {
    id: 'a',
    code: 'A',
    title: '清洁午餐',
    description: '糙米饭 + 清蒸鲈鱼 + 蒜蓉西兰花：蛋白、纤维都够，综合 GI 低。',
    passed: true,
    data: { text: '糙米杂粮饭、清蒸鲈鱼、蒜蓉西兰花', meal: 'lunch', snackTime: '', note: '' },
  },
  {
    id: 'b',
    code: 'B',
    title: '炸鸡配可乐',
    description: '触发一票否决，本餐 0 分，只记热量不盖章。',
    passed: false,
    data: { text: '炸鸡腿、冰镇含糖可乐', meal: 'dinner', snackTime: '', note: '' },
  },
  {
    id: 'c',
    code: 'C',
    title: '饭后小冰淇淋',
    description: '正餐不错，加了一个冰淇淋，擦线及格。',
    passed: true,
    data: { text: '糙米杂粮饭、番茄炒蛋、小冰淇淋', meal: 'lunch', snackTime: '', note: '' },
  },
  {
    id: 'd',
    code: 'D',
    title: '红油牛肉面',
    description: '钠和碳水偏高，晚餐高 GI 再扣分，不及格。',
    passed: false,
    data: { text: '红油牛肉面、藤椒鸡胗', meal: 'dinner', snackTime: '', note: '' },
  },
]

function totals(ds: Dish[]) {
  const sum = (k: 'kcal' | 'protein' | 'carb' | 'fat' | 'fiber' | 'sodium') =>
    ds.reduce((a, d) => a + d[k], 0)
  const carb = sum('carb')
  const gi = carb > 0 ? Math.round(ds.reduce((a, d) => a + d.gi * d.carb, 0) / carb) : 0
  return {
    kcal: sum('kcal'),
    protein: sum('protein'),
    carb,
    fat: sum('fat'),
    fiber: sum('fiber'),
    sodium: sum('sodium'),
    gi,
  }
}

/** 单道菜的质量评价与一句分析 */
function dishQuality(d: Dish): {
  text: string
  tone: 'success' | 'warning' | 'danger'
  note: string
} {
  if (d.junk) {
    return {
      text: '不推荐',
      tone: 'danger',
      note: '一票否决项：油炸或含糖饮料，会让整餐直接 0 分。',
    }
  }
  if (d.sodium > 1500) {
    return {
      text: '偏咸',
      tone: 'warning',
      note: `钠含量很高（约 ${d.sodium} mg），建议少喝汤、少放红油。`,
    }
  }
  if (d.gi >= 70) {
    return { text: '升糖快', tone: 'warning', note: '升糖较快，晚间尤其要控制份量。' }
  }
  if (d.protein >= 20) {
    return { text: '优质', tone: 'success', note: '优质蛋白来源，有利于饱腹和肌肉维持。' }
  }
  if (d.fiber >= 4) {
    return { text: '优质', tone: 'success', note: '膳食纤维丰富，有助于延缓升糖。' }
  }
  return { text: '良好', tone: 'success', note: '营养均衡，适量即可。' }
}

function giLabel(gi: number): { text: string; tone: 'success' | 'warning' | 'danger' } {
  if (gi <= 55) return { text: '低 GI', tone: 'success' }
  if (gi < 70) return { text: '中 GI', tone: 'warning' }
  return { text: '高 GI', tone: 'danger' }
}

/** 5 分制：一票否决 → 0；否则基础 2.0 + 蛋白 + 纤维 + GI + 热量走廊 − 钠 − 晚间高 GI */
function score(ds: Dish[], meal: Meal): number {
  if (ds.length === 0 || ds.some((d) => d.junk)) return 0
  const t = totals(ds)
  let s = 2
  if (t.protein >= 15) s += 0.5
  if (t.protein >= 25) s += 0.5
  if (t.fiber >= 5) s += 0.8
  if (t.gi <= 55) s += 0.6
  if (t.kcal >= 350 && t.kcal <= 800) s += 0.4
  if (t.sodium > 1500) s -= 0.8
  if (meal === 'dinner' && t.gi >= 70) s -= 0.6
  return Math.max(0, Math.min(5, Math.round(s * 10) / 10))
}

const CONFIG: PhoneFlowConfig = {
  tone: 'diet',
  title: '科学饮食打卡',
  progress: { done: 12, total: 30 },
  agentSteps: [
    '解析你输入的每一道菜',
    '联网搜索每道菜的热量、升糖指数和营养成分',
    '估算份量并核对烹饪方式',
    '生成分析结果与评分',
  ],
  rulesDoc: {
    title: '达标规则',
    sections: [
      {
        heading: '有效打卡线',
        items: [
          'AI 评分 > 3.0 分才盖有效章',
          '5.0 分制，综合热量、蛋白质、膳食纤维、升糖指数、钠和烹饪方式',
          '未达标照常保存，只是不计入连击',
        ],
      },
      {
        heading: '一票否决',
        items: ['炸鸡、汉堡、薯条、含糖碳酸饮料：本餐直接 0 分', '热量仍会记入饮食账本'],
      },
      {
        heading: '按体质分档',
        items: [
          '减脂严管：晚间碳水与油脂扣分更重',
          '控糖均衡：对标膳食指南',
          '增肌温和：放宽干净复合碳水，重点看蛋白质',
        ],
      },
    ],
  },
  basisDoc: {
    title: '评判依据',
    sections: [
      {
        heading: '营养标准',
        items: [
          '《中国居民膳食指南（2022）》',
          '每餐蛋白质 ≥ 15g 加分，≥ 25g 再加分',
          '膳食纤维 ≥ 5g 加分；钠 > 1500mg 扣分',
        ],
      },
      {
        heading: '升糖节律',
        items: [
          '按碳水加权计算综合 GI：≤ 55 低，56–69 中，≥ 70 高',
          '晚餐高 GI 额外扣分，早餐防空腹高 GI',
        ],
      },
      {
        heading: '联网核验',
        items: [
          '联网检索权威资料，核对食物成分与烹饪方式',
          '识别结果会先让你确认，确认后才保存',
          '你的照片只用于识别，不会被保存',
        ],
      },
    ],
  },
}

function buildReport(ds: Dish[], meal: Meal): ReportSpec {
  const t = totals(ds)
  const sc = score(ds, meal)
  const gl = giLabel(t.gi)
  const hasJunk = ds.some((d) => d.junk)
  const nutrition: FolderSpec = {
    id: 'nutrition',
    title: '营养物质',
    icon: 'heart',
    tone: 'diet',
    headline: `蛋白质 ${t.protein.toFixed(0)}g · 碳水 ${t.carb.toFixed(0)}g · 脂肪 ${t.fat.toFixed(0)}g`,
    rows: [
      {
        label: '蛋白质',
        value: `${t.protein.toFixed(1)} g`,
        ratio: t.protein / 25,
        tone: 'success',
        sub: '本餐参考 25g',
      },
      {
        label: '碳水化合物',
        value: `${t.carb.toFixed(1)} g`,
        ratio: t.carb / 80,
        tone: t.carb > 100 ? 'warning' : 'primary',
      },
      {
        label: '脂肪',
        value: `${t.fat.toFixed(1)} g`,
        ratio: t.fat / 25,
        tone: t.fat > 25 ? 'warning' : 'primary',
      },
      {
        label: '膳食纤维',
        value: `${t.fiber.toFixed(1)} g`,
        ratio: t.fiber / 8,
        tone: 'success',
        sub: '本餐参考 8g',
      },
      {
        label: '钠',
        value: `${t.sodium} mg`,
        ratio: t.sodium / 800,
        tone: t.sodium > 1500 ? 'danger' : 'primary',
        sub: '本餐参考 800mg',
      },
    ],
  }
  const dishFolder: FolderSpec = {
    id: 'dishes',
    defaultOpen: true,
    title: '逐菜分析',
    icon: 'diet',
    tone: 'study',
    headline: `${ds.length} 道菜 · 综合 GI ${t.gi}`,
    badge: { text: gl.text, tone: gl.tone },
    children: ds.map((d) => {
      const l = giLabel(d.gi)
      const q = dishQuality(d)
      return {
        id: `dish-${d.id}`,
        title: d.name,
        icon: 'diet' as const,
        headline: `${d.portion} · GI ${d.gi} · ${d.kcal} kcal`,
        badge: { text: q.text, tone: q.tone },
        rows: [
          { label: '升糖指数', value: `GI ${d.gi} · ${l.text}`, ratio: d.gi / 100, tone: l.tone },
          {
            label: '热量',
            value: `${d.kcal} kcal`,
            ratio: d.kcal / 700,
            tone: 'exercise' as const,
          },
          { label: '蛋白质', value: `${d.protein} g` },
          { label: '碳水', value: `${d.carb} g` },
          { label: '脂肪', value: `${d.fat} g` },
          { label: '膳食纤维', value: `${d.fiber} g` },
          { label: '钠', value: `${d.sodium} mg` },
        ],
        note: d.web ? `联网检索估算，仅供参考；${q.note}` : q.note,
      }
    }),
    note: '点开每道菜看质量与各项指标；综合 GI 按各菜碳水克数加权。',
  }
  const energy: FolderSpec = {
    id: 'energy',
    title: '热量消耗',
    icon: 'flame',
    tone: 'exercise',
    headline: `${t.kcal} kcal · ${t.kcal >= 350 && t.kcal <= 800 ? '在本餐走廊内' : t.kcal < 350 ? '低于本餐走廊' : '高于本餐走廊'}`,
    rows: [
      {
        label: '本餐热量',
        value: `${t.kcal} kcal`,
        ratio: t.kcal / 800,
        tone: t.kcal > 800 ? 'warning' : 'exercise',
        sub: '本餐走廊 350–800 kcal',
      },
      {
        label: '占全天推荐',
        value: `${Math.round((t.kcal / 1800) * 100)}%`,
        ratio: t.kcal / 1800,
        tone: 'exercise',
        sub: '按身高体重估算，约 1800 kcal',
      },
    ],
  }
  const checks: FolderSpec = {
    id: 'checks',
    title: '校验清单',
    icon: 'shield',
    tone: 'primary',
    headline: '',
    checks: [
      { text: '没有一票否决食物', ok: !hasJunk },
      { text: '热量在本餐走廊内（350–800 kcal）', ok: t.kcal >= 350 && t.kcal <= 800 },
      { text: '优质蛋白 ≥ 15g', ok: t.protein >= 15 },
      { text: '膳食纤维 ≥ 5g', ok: t.fiber >= 5 },
      { text: '钠 ≤ 1500mg', ok: t.sodium <= 1500 },
      {
        text: '联网核验食物成分',
        ok: true,
        source: '《中国居民膳食指南（2022）》· 中国食物成分表',
      },
    ],
  }
  const okCount = checks.checks?.filter((c) => c.ok).length ?? 0
  checks.headline = `${okCount}/${checks.checks?.length ?? 0} 项通过`
  checks.badge = { text: sc > 3 ? '达标' : '未达标', tone: sc > 3 ? 'success' : 'warning' }
  return {
    title: `${MEAL_LABEL[meal]}分析 · ${sc.toFixed(1)} 分`,
    folders: [nutrition, energy, dishFolder, checks],
  }
}

export function DietFlowSandbox() {
  const [scenarioId, setScenarioId] = useState('a')
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!
  const [data, setData] = useState<Data>(SCENARIOS[0]!.data)
  const [favs, setFavs] = useState<string[]>(DEFAULT_FAVS)
  const [sheet, setSheet] = useState<null | 'favs'>(null)
  // 默认加餐时间 = 进入页面时的当前时间（服务端渲染时为空，客户端取一次后固定）
  const enteredRef = useRef<string | null>(null)
  const clock = useSyncExternalStore(
    () => () => undefined,
    () => (enteredRef.current ??= nowHHMM()),
    () => '',
  )
  const snackAt = data.snackTime || clock || '12:00'
  const [draftFav, setDraftFav] = useState('')

  const ds = parseDishes(data.text)
  const sc = score(ds, data.meal)
  const hasJunk = ds.some((d) => d.junk)
  const verdict: Verdict = {
    passed: sc > 3,
    score: sc.toFixed(1),
    scoreHint: '/ 5.0 · 线 3.0',
    detail:
      sc > 3
        ? `本餐 ${sc.toFixed(1)} 分，超过 3.0 分有效线`
        : hasJunk
          ? '含炸鸡或含糖饮料，一票否决，本餐 0 分'
          : `本餐 ${sc.toFixed(1)} 分，未达 3.0 分有效线`,
  }

  function toggleTag(name: string) {
    setData((d) => {
      const names = splitNames(d.text)
      const next = names.includes(name) ? names.filter((x) => x !== name) : [...names, name]
      return { ...d, text: next.join('、') }
    })
  }

  const names = splitNames(data.text)
  const sections: FillSectionSpec[] = [
    {
      id: 'dishes',
      label: '吃了什么',
      icon: 'diet',
      filled: ds.length > 0,
      summary: ds.length ? `${ds.length} 道 · ${totals(ds).kcal} kcal` : '输入或点选你吃的东西',
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
          placeholder="例如：外卖、少油"
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

  // 手动填写：输入框里默认就有字（假数据），提交时 Agent 直接解析它
  function onModeChange(_mode: FlowMode) {
    setData(scenario.data)
  }

  function selectScenario(id: string) {
    setScenarioId(id)
    setData(SCENARIOS.find((s) => s.id === id)?.data ?? SCENARIOS[0]!.data)
  }

  const selector = (
    <SegmentedControl
      size="sm"
      label="餐次"
      value={data.meal}
      onValueChange={(meal) => setData((d) => ({ ...d, meal }))}
      options={[
        { value: 'breakfast', label: '早餐' },
        { value: 'lunch', label: '午餐' },
        { value: 'dinner', label: '晚餐' },
        { value: 'snack', label: '加餐' },
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
          aiSummary={`${MEAL_LABEL[data.meal]}${data.meal === 'snack' ? ` ${snackAt}` : ''} · ${ds.length} 道菜`}
          verdict={verdict}
          canSubmit={ds.length > 0}
          report={buildReport(ds, data.meal)}
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
