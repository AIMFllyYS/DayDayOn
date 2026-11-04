'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Input } from '@/components/ui/field'
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
  dishIds: string[]
  meal: Meal
  note: string
}

const EMPTY: Data = { dishIds: [], meal: 'lunch', note: '' }

const SCENARIOS: (FlowScenario & { data: Data })[] = [
  {
    id: 'a',
    code: 'A',
    title: '清洁午餐',
    description: '糙米饭 + 清蒸鲈鱼 + 蒜蓉西兰花：蛋白、纤维都够，综合 GI 低。',
    passed: true,
    data: { dishIds: ['rice', 'fish', 'broccoli'], meal: 'lunch', note: '' },
  },
  {
    id: 'b',
    code: 'B',
    title: '炸鸡配可乐',
    description: '触发一票否决，本餐 0 分，只记热量不盖章。',
    passed: false,
    data: { dishIds: ['chicken', 'cola'], meal: 'dinner', note: '' },
  },
  {
    id: 'c',
    code: 'C',
    title: '饭后小冰淇淋',
    description: '正餐不错，加了一个冰淇淋，擦线及格。',
    passed: true,
    data: { dishIds: ['rice', 'egg', 'icecream'], meal: 'lunch', note: '' },
  },
  {
    id: 'd',
    code: 'D',
    title: '红油牛肉面',
    description: '钠和碳水偏高，晚餐高 GI 再扣分，不及格。',
    passed: false,
    data: { dishIds: ['noodle'], meal: 'dinner', note: '' },
  },
]

function dishesOf(ids: string[]): Dish[] {
  return DISHES.filter((d) => ids.includes(d.id))
}

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
          'DeepSeek 联网检索权威资料，核对食物成分与烹饪方式',
          '识别结果先以草稿呈现，确认后才入库',
          '照片只在内存压缩，不落盘',
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
  const glycemic: FolderSpec = {
    id: 'gi',
    title: '每道菜升糖指数',
    icon: 'chart',
    tone: 'study',
    headline: `综合 GI ${t.gi}`,
    badge: { text: gl.text, tone: gl.tone },
    children: ds.map((d) => {
      const l = giLabel(d.gi)
      return {
        id: `dish-${d.id}`,
        title: d.name,
        icon: 'diet',
        headline: `${d.portion} · GI ${d.gi} · ${d.kcal} kcal`,
        badge: { text: l.text, tone: l.tone },
        rows: [
          { label: '蛋白质', value: `${d.protein} g` },
          { label: '碳水', value: `${d.carb} g` },
          { label: '脂肪', value: `${d.fat} g` },
          { label: '膳食纤维', value: `${d.fiber} g` },
          { label: '钠', value: `${d.sodium} mg` },
        ],
      }
    }),
    note: '综合 GI 按各菜碳水克数加权。',
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
        sub: '按身高体重动态 BMR 估算，约 1800 kcal',
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
        text: 'DeepSeek 联网核验食物成分',
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
    folders: [nutrition, glycemic, energy, checks],
  }
}

export function DietFlowSandbox() {
  const [scenarioId, setScenarioId] = useState('a')
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!
  const [data, setData] = useState<Data>(SCENARIOS[0]!.data)

  const ds = dishesOf(data.dishIds)
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

  function toggle(id: string) {
    setData((d) => ({
      ...d,
      dishIds: d.dishIds.includes(id) ? d.dishIds.filter((x) => x !== id) : [...d.dishIds, id],
    }))
  }

  const sections: FillSectionSpec[] = [
    {
      id: 'dishes',
      label: '吃了什么',
      icon: 'diet',
      filled: ds.length > 0,
      summary: ds.length ? `${ds.length} 道 · ${totals(ds).kcal} kcal` : '点选你吃的菜',
      content: (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="菜品">
          {DISHES.map((d) => {
            const on = data.dishIds.includes(d.id)
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(d.id)}
                className={cn(
                  'text-tiny min-h-9 rounded-full border px-3 font-semibold transition-colors',
                  on
                    ? 'border-diet bg-diet-soft text-diet-ink'
                    : 'border-border bg-surface-sunken text-muted hover:text-foreground',
                )}
              >
                {d.name}
              </button>
            )
          })}
        </div>
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

  function onModeChange(mode: FlowMode) {
    setData(mode === 'manual' ? EMPTY : scenario.data)
  }

  function selectScenario(id: string) {
    setScenarioId(id)
    setData(SCENARIOS.find((s) => s.id === id)?.data ?? EMPTY)
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
          selector={selector}
          sections={sections}
          aiSummary={`${MEAL_LABEL[data.meal]} · ${ds.length} 道菜`}
          verdict={verdict}
          canSubmit={ds.length > 0}
          report={buildReport(ds, data.meal)}
          onModeChange={onModeChange}
        />
      }
    />
  )
}
