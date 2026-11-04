'use client'

import { useState } from 'react'
import { TopBar } from '@/components/layout/top-bar'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { ProgressBar, ProgressRing } from '@/components/ui/progress'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Stamp } from '@/components/ui/stamp'
import { toast } from '@/components/ui/toast'
import { softToneClass, solidToneClass, type Tone } from '@/components/ui/tone'
import type { MealType } from '@/features/checkin/schemas'
import { cn } from '@/lib/cn'
import { PhoneFrame } from '../../../_components/device-frame'
import {
  CheckinModeTabs,
  SmartScannerLens,
  type CheckinInputMode,
  type ScanPhase,
  type SmartSamplePreset,
} from '../../../_components/smart-recognition-demos'
import {
  CONSTITUTION_TIERS,
  GoalVerificationRuleCard,
  PersonalConstitutionTierPicker,
  type ConstitutionTierId,
} from '../../_components/rule-config-primitives'

/*
 * 好好吃饭 · 饮食板块深度设计组件集
 * 包含：
 * 1. DietConstitutionAndRuleSection —— 个人体质档位 + 饮食目标检验标准组合展示
 * 2. DietRefereeScoreCard —— 6 维科学营养与升糖裁判体系（5 分制评分原子组件，3.0 分有效打卡门槛）
 * 3. DietRefereeScenariosMatrix —— 四大经典饮食判罚场景（4.4 分通过 / 0.0 分熔断 / 3.3 分及格边缘 / 2.4 分隐形高钠）
 * 4. DietFullPageSandbox —— <PhoneFrame> 手机端完整「好好吃饭」打卡页 + 右侧交互控制台
 */

export type TrafficLight = 'green' | 'yellow' | 'red'

export interface PlateDimensionBar {
  id: 'grain' | 'veg' | 'protein' | 'oil-salt'
  label: string
  ratioText: string
  detail: string
  light: TrafficLight
  percent: number
}

export interface DietDeductionItem {
  reason: string
  delta: string
  tone: 'success' | 'warning' | 'danger'
}

export interface DietRefereeScenario {
  id: 'clean-lunch' | 'junk-dinner' | 'icecream-lunch' | 'heavy-noodle-dinner'
  code: 'A' | 'B' | 'C' | 'D'
  title: string
  subtitle: string
  meal: MealType
  mealLabel: string
  score: number
  totalKcal: number
  giLevel: 'low' | 'medium' | 'high'
  giValueText: string
  rhythmWindow: 'morning' | 'noon' | 'evening'
  rhythmVerdict: string
  verdictBadge: string
  verdictDetail: string
  tuanAdvice: string
  items: { name: string; portion: string; kcal: number; tag: string; tagTone: Tone }[]
  deductions: DietDeductionItem[]
  plateBars: PlateDimensionBar[]
  deepseekCitation: {
    sourceTitle: string
    evidence: string
    sodiumMg: number
    addedSugarG: number
  }
  scannerPreset: SmartSamplePreset
}

const lightMeta: Record<
  TrafficLight,
  { label: string; dotClass: string; badgeTone: Tone; barTone: Tone }
> = {
  green: {
    label: '理想绿灯',
    dotClass: 'bg-success',
    badgeTone: 'success',
    barTone: 'success',
  },
  yellow: {
    label: '临界黄灯',
    dotClass: 'bg-warning',
    badgeTone: 'warning',
    barTone: 'warning',
  },
  red: {
    label: '超标红灯',
    dotClass: 'bg-danger',
    badgeTone: 'danger',
    barTone: 'danger',
  },
}

export const DIET_REFEREE_SCENARIOS: Record<DietRefereeScenario['id'], DietRefereeScenario> = {
  'clean-lunch': {
    id: 'clean-lunch',
    code: 'A',
    title: '场景 A · 4.4 / 5.0 分（有效打卡通过）',
    subtitle: '午餐：糙米杂粮饭 + 清蒸鲈鱼 + 蒜蓉西兰花',
    meal: 'lunch',
    mealLabel: '午餐 · 12:30',
    score: 4.4,
    totalKcal: 485,
    giLevel: 'low',
    giValueText: '综合 GI ≈ 48（低升糖）',
    rhythmWindow: 'noon',
    rhythmVerdict: '🌤️ 午间复合碳水窗口：糙米杂粮慢消化供能，下午不犯困',
    verdictBadge: '4.4 分 · 有效打卡通过',
    verdictDetail: '高于 3.0 分有效线，符合《中国居民膳食指南》餐盘配比，可盖章计入今日有效打卡。',
    tuanAdvice: '清蒸鲈鱼配杂粮饭太棒啦！优质蛋白和膳食纤维双满分，继续保持～',
    items: [
      {
        name: '糙米杂粮饭',
        portion: '1 碗（约 130g）',
        kcal: 155,
        tag: '低 GI 复合碳水',
        tagTone: 'success',
      },
      {
        name: '清蒸海鲈鱼',
        portion: '1 份（约 160g）',
        kcal: 175,
        tag: '优质蛋白 28g',
        tagTone: 'exercise',
      },
      {
        name: '蒜蓉白灼西兰花',
        portion: '1 盘（约 180g）',
        kcal: 75,
        tag: '高膳食纤维',
        tagTone: 'success',
      },
      {
        name: '紫菜蛋花清汤',
        portion: '1 小碗（200ml）',
        kcal: 80,
        tag: '少油低钠',
        tagTone: 'diet',
      },
    ],
    deductions: [
      { reason: '膳食宝塔 2:2:1 黄金餐盘配比达标', delta: '基础 5.0', tone: 'success' },
      { reason: '蒜蓉浇汁含少量烹调植物油（约 8g）', delta: '-0.6 分', tone: 'warning' },
    ],
    plateBars: [
      {
        id: 'grain',
        label: '谷薯碳水',
        ratioText: '28% · 粗细搭配',
        detail: '糙米燕麦混蒸，升糖平缓',
        light: 'green',
        percent: 88,
      },
      {
        id: 'veg',
        label: '深色蔬果',
        ratioText: '38% · 富含维 C',
        detail: '十字花科西兰花足量',
        light: 'green',
        percent: 94,
      },
      {
        id: 'protein',
        label: '优质蛋白',
        ratioText: '34% · 白肉鱼类',
        detail: '富含不饱和脂肪酸 DHA',
        light: 'green',
        percent: 92,
      },
      {
        id: 'oil-salt',
        label: '油脂与钠盐',
        ratioText: '钠 ≈ 580mg · 清淡',
        detail: '清蒸白灼工艺，无隐形糖',
        light: 'green',
        percent: 26,
      },
    ],
    deepseekCitation: {
      sourceTitle: '《中国居民膳食指南 2022》准则一 & 《中国食物成分表（第6版）》',
      evidence:
        '核验通过：糙米 GI=50（低 GI < 55），清蒸鲈鱼每 100g 含蛋白质 18.6g、脂肪仅 3.4g；单餐钠摄入 580mg（占全天 2000mg 限额 29%）。',
      sodiumMg: 580,
      addedSugarG: 1.5,
    },
    scannerPreset: {
      id: 'diet-scene-a',
      module: 'diet',
      goalTitle: '好好吃饭',
      sourceKind: 'image',
      visualTitle: '午餐餐盘实拍 · 清蒸鲈鱼杂粮餐',
      visualLines: [
        '糙米杂粮饭 130g · 清蒸鲈鱼 160g',
        '蒜蓉西兰花 180g · 紫菜蛋花汤',
        'DeepSeek 联网核验：低 GI 清洁烹调（4.4 / 5.0 分）',
      ],
      scanSteps: [
        '正在识别餐盘分区与烹饪油光特征…',
        '联网检索《中国食物成分表》核验 GI 与钠含量',
        '6 维营养裁判打分完成：4.4 / 5.0 分（有效通过）',
      ],
    },
  },
  'junk-dinner': {
    id: 'junk-dinner',
    code: 'B',
    title: '场景 B · 0.0 / 5.0 分（熔断无效打卡）',
    subtitle: '晚餐：脆皮炸鸡腿堡 + 炸薯条 + 冰镇含糖可乐',
    meal: 'dinner',
    mealLabel: '晚餐 · 20:15',
    score: 0.0,
    totalKcal: 1120,
    giLevel: 'high',
    giValueText: '综合 GI ≈ 89（重度飙糖）',
    rhythmWindow: 'evening',
    rhythmVerdict: '🌙 晚间严控碳水时段：高糖可乐 + 精制面包触发胰岛素暴击',
    verdictBadge: '0.0 分 · 触发红线熔断',
    verdictDetail: '未达 3.0 分有效线 · 仅作饮食记录存档，不计入今日有效打卡。',
    tuanAdvice:
      '抓包！晚餐吃炸鸡汉堡配含糖可乐触发了一票否决红线（-5.0 分），这次只能记入饮食账本反省，不能算有效打卡哦！',
    items: [
      {
        name: '双层脆皮炸鸡腿堡',
        portion: '1 个（约 240g）',
        kcal: 590,
        tag: '深度油炸 · 反式脂肪风险',
        tagTone: 'danger',
      },
      {
        name: '中份炸薯条',
        portion: '1 盒（约 110g）',
        kcal: 330,
        tag: '高温油炸淀粉',
        tagTone: 'danger',
      },
      {
        name: '冰镇含糖可乐',
        portion: '1 杯（400ml）',
        kcal: 200,
        tag: '添加糖 42g 超标',
        tagTone: 'danger',
      },
    ],
    deductions: [
      { reason: '触发一级垃圾食品红线（炸鸡汉堡+含糖碳酸饮料）', delta: '-5.0 分', tone: 'danger' },
      { reason: '晚间 20:00 后摄入高 GI 液态糖与高温煎炸油脂', delta: '-1.5 分', tone: 'danger' },
    ],
    plateBars: [
      {
        id: 'grain',
        label: '谷薯碳水',
        ratioText: '精制白面包+油炸薯条',
        detail: '高升糖精制碳水叠加游离糖',
        light: 'red',
        percent: 96,
      },
      {
        id: 'veg',
        label: '深色蔬果',
        ratioText: '3% · 严重匮乏',
        detail: '仅有汉堡夹层少量生菜丝',
        light: 'red',
        percent: 8,
      },
      {
        id: 'protein',
        label: '优质蛋白',
        ratioText: '裹粉油炸劣质化',
        detail: '高温煎炸破坏蛋白质并吸饱油脂',
        light: 'red',
        percent: 25,
      },
      {
        id: 'oil-salt',
        label: '油脂与钠盐',
        ratioText: '钠 ≈ 1860mg · 糖 42g',
        detail: '单餐添加糖突破全天 25g 红线 168%',
        light: 'red',
        percent: 98,
      },
    ],
    deepseekCitation: {
      sourceTitle: '《中国居民膳食指南 2022》准则五「少盐少油，控糖限酒」',
      evidence:
        '红线拦截：每日添加糖应控制在 25g 以下，400ml 含糖可乐含果葡糖浆约 42g；油炸快餐富含饱和脂肪与丙烯酰胺，触发减脂严管档 -5.0 分熔断。',
      sodiumMg: 1860,
      addedSugarG: 42,
    },
    scannerPreset: {
      id: 'diet-scene-b',
      module: 'diet',
      goalTitle: '好好吃饭',
      sourceKind: 'image',
      visualTitle: '晚餐快餐实拍 · 炸鸡汉堡可乐套餐',
      visualLines: [
        '脆皮炸鸡堡 590 kcal · 炸薯条 330 kcal',
        '含糖可乐 400ml（添加糖 42g）',
        'DeepSeek 裁判：触发垃圾食品红线 -5.0 分（0.0 分熔断）',
      ],
      scanSteps: [
        '识别出裹粉油炸快餐与含糖碳酸饮料…',
        '对照《中国居民膳食指南》添加糖与反式脂肪红线',
        '判定结果：0.0 / 5.0 分（未满 3.0 分，拦截有效打卡）',
      ],
    },
  },
  'icecream-lunch': {
    id: 'icecream-lunch',
    code: 'C',
    title: '场景 C · 3.3 / 5.0 分（勉强及格边缘）',
    subtitle: '午餐正常吃（番茄牛腩饭+青菜），但饭后吃了一个小冰淇淋',
    meal: 'lunch',
    mealLabel: '午餐 · 13:05',
    score: 3.3,
    totalKcal: 680,
    giLevel: 'medium',
    giValueText: '综合 GI ≈ 66（中偏高）',
    rhythmWindow: 'noon',
    rhythmVerdict: '🌤️ 午间解馋缓冲期：中午代谢尚可，扣 -1.2 分后险守 3.3 分及格线',
    verdictBadge: '3.3 分 · 擦线勉强通过',
    verdictDetail: '刚过 3.0 分有效线（3.3 > 3.0），允许打卡，但已锁定今晚甜食与精制碳水额度。',
    tuanAdvice:
      '看在正餐乖乖吃了牛肉和青菜的份上，中午吃小冰淇淋扣 1.2 分勉强放行！晚上千万别再碰甜食和碳水啦！',
    items: [
      {
        name: '番茄炖牛腩',
        portion: '1 份（约 150g）',
        kcal: 240,
        tag: '优质铁与蛋白',
        tagTone: 'exercise',
      },
      {
        name: '清炒上海青',
        portion: '1 份（约 160g）',
        kcal: 70,
        tag: '绿叶蔬菜达标',
        tagTone: 'success',
      },
      {
        name: '白米饭',
        portion: '1 小碗（130g）',
        kcal: 150,
        tag: '精制碳水 GI 83',
        tagTone: 'warning',
      },
      {
        name: '香草奶油小冰淇淋',
        portion: '1 球（约 85g）',
        kcal: 220,
        tag: '餐后甜品 · 扣 -1.2 分',
        tagTone: 'danger',
      },
    ],
    deductions: [
      { reason: '正餐含优质瘦牛腩与足量绿叶菜', delta: '基础 5.0', tone: 'success' },
      { reason: '精制白米饭未搭配粗粮（GI 偏高）', delta: '-0.5 分', tone: 'warning' },
      { reason: '午饭后叠加奶油冰淇淋（游离糖+乳脂）', delta: '-1.2 分', tone: 'danger' },
    ],
    plateBars: [
      {
        id: 'grain',
        label: '谷薯碳水',
        ratioText: '白米饭+甜品糖分',
        detail: '午间碳水总量处于临界上限',
        light: 'yellow',
        percent: 76,
      },
      {
        id: 'veg',
        label: '深色蔬果',
        ratioText: '32% · 番茄+上海青',
        detail: '番茄红素与叶绿素充足',
        light: 'green',
        percent: 85,
      },
      {
        id: 'protein',
        label: '优质蛋白',
        ratioText: '26% · 炖牛腩',
        detail: '氨基酸组成完整',
        light: 'green',
        percent: 82,
      },
      {
        id: 'oil-salt',
        label: '油脂与钠盐',
        ratioText: '添加糖 ≈ 18g · 临界',
        detail: '冰淇淋占去全天 72% 控糖额度',
        light: 'yellow',
        percent: 68,
      },
    ],
    deepseekCitation: {
      sourceTitle: '《中国居民膳食指南 2022》控糖建议 & 餐后血糖负荷（GL）模型',
      evidence:
        '擦线预警：单球冰淇淋含添加糖约 18g（接近每日 25g 建议上限）；因在午餐正餐后进食，蔬菜膳食纤维延缓了部分糖吸收，综合评定 3.3 分。',
      sodiumMg: 920,
      addedSugarG: 18,
    },
    scannerPreset: {
      id: 'diet-scene-c',
      module: 'diet',
      goalTitle: '好好吃饭',
      sourceKind: 'image',
      visualTitle: '午餐实拍 · 番茄牛腩饭 + 饭后小冰淇淋',
      visualLines: [
        '番茄牛腩 + 上海青 + 白米饭（460 kcal）',
        '饭后甜点：香草小冰淇淋 1 球（220 kcal）',
        'DeepSeek 裁判：午间解馋扣 -1.2 分 → 3.3 分擦线及格',
      ],
      scanSteps: [
        '识别正餐餐盘与饭后冰淇淋甜品…',
        '核算午间血糖负荷（GL）与剩余添加糖裕度',
        '判定结果：3.3 / 5.0 分（勉强通过，锁定晚间控糖警告）',
      ],
    },
  },
  'heavy-noodle-dinner': {
    id: 'heavy-noodle-dinner',
    code: 'D',
    title: '场景 D · 2.4 / 5.0 分（隐形超标与晚间碳水不及格）',
    subtitle: '晚餐：一大碗红油重盐牛肉面（高钠 + 重油 + 晚间精制高碳水）',
    meal: 'dinner',
    mealLabel: '晚餐 · 19:40',
    score: 2.4,
    totalKcal: 790,
    giLevel: 'high',
    giValueText: '综合 GI ≈ 82（高升糖面食）',
    rhythmWindow: 'evening',
    rhythmVerdict: '🌙 晚间严控碳水红线：夜间摄入大碗精制小麦面，极易囤积内脏脂肪',
    verdictBadge: '2.4 分 · 未达标不计打卡',
    verdictDetail:
      '未达 3.0 分有效线（2.4 ≤ 3.0）· 隐形高钠重油+晚间高碳水，仅存记录不计有效打卡。',
    tuanAdvice:
      '虽然面条看着不是炸鸡，但晚上吃一大碗红油重盐白面条，钠含量直接爆表、夜间血糖也会飙升！下次换成半份荞麦面+清汤+加倍青菜就能及格啦～',
    items: [
      {
        name: '精制小麦机制面条',
        portion: '大碗（熟重约 300g）',
        kcal: 420,
        tag: '晚间高 GI 碳水过量',
        tagTone: 'danger',
      },
      {
        name: '红油牛油浓汤底',
        portion: '连汤带油（约 350ml）',
        kcal: 250,
        tag: '高钠 2280mg · 重油',
        tagTone: 'danger',
      },
      {
        name: '卤牛肉片 + 2 片菜叶',
        portion: '牛肉约 45g · 青菜 20g',
        kcal: 120,
        tag: '蔬菜严重不足',
        tagTone: 'warning',
      },
    ],
    deductions: [
      { reason: '晚餐时段摄入大份高 GI 精制面条（>250g）', delta: '-1.2 分', tone: 'danger' },
      { reason: '红油重盐汤底单餐钠含量突破全天 2000mg 上限', delta: '-1.0 分', tone: 'danger' },
      {
        reason: '深色蔬菜仅 2 片（远低于每餐 150–200g 建议值）',
        delta: '-0.4 分',
        tone: 'warning',
      },
    ],
    plateBars: [
      {
        id: 'grain',
        label: '谷薯碳水',
        ratioText: '72% · 单一精制面食',
        detail: '晚间碳水占比畸高，缺乏粗粮',
        light: 'red',
        percent: 92,
      },
      {
        id: 'veg',
        label: '深色蔬果',
        ratioText: '6% · 象征性两片菜叶',
        detail: '无法形成膳食纤维血糖缓冲网',
        light: 'yellow',
        percent: 18,
      },
      {
        id: 'protein',
        label: '优质蛋白',
        ratioText: '22% · 卤牛肉偏少',
        detail: '蛋白质大约仅 12g，不够一餐所需',
        light: 'yellow',
        percent: 45,
      },
      {
        id: 'oil-salt',
        label: '油脂与钠盐',
        ratioText: '钠 ≈ 2280mg · 爆表',
        detail: '单碗红油汤面钠超全天限额 114%',
        light: 'red',
        percent: 95,
      },
    ],
    deepseekCitation: {
      sourceTitle: '《中国居民膳食指南 2022》减盐专项 & 晚间碳水代谢共识',
      evidence:
        '隐形超标预警：成人每日食盐应 < 5g（钠 < 2000mg），一碗红油牛肉面含钠约 2280mg；且小麦面条 GI=81.6，晚间胰岛素敏感度下降，综合评定 2.4 分（不及格）。',
      sodiumMg: 2280,
      addedSugarG: 4,
    },
    scannerPreset: {
      id: 'diet-scene-d',
      module: 'diet',
      goalTitle: '好好吃饭',
      sourceKind: 'image',
      visualTitle: '晚餐实拍 · 大碗红油牛肉面',
      visualLines: [
        '精制白面条 300g · 红油浓汤底 350ml',
        '卤牛肉 45g · 青菜仅 2 片',
        'DeepSeek 裁判：晚间高 GI 碳水+高钠爆表 → 2.4 分不及格',
      ],
      scanSteps: [
        '识别面碗容量、红油汤面浮油层与配菜比例…',
        '联网核算川味红油面汤钠当量（≈2280mg）与面条 GI',
        '判定结果：2.4 / 5.0 分（未达 3.0 有效线，拦截打卡）',
      ],
    },
  },
}

// ============================================================================
// Section 01 组件：个人体质档位 + 饮食目标检验规则并排展示
// ============================================================================

export function DietConstitutionAndRuleSection() {
  const [tier, setTier] = useState<ConstitutionTierId>('strict-fat-loss')

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PersonalConstitutionTierPicker
        value={tier}
        onValueChange={setTier}
        annPrefix="playbook.modules.diet.constitution-picker"
      />
      <GoalVerificationRuleCard module="diet" annPrefix="playbook.modules.diet.goal-verification" />
    </div>
  )
}

// ============================================================================
// 原子组件：5 分制饮食 AI 裁判成绩单（DietRefereeScoreCard）
// ============================================================================

export interface DietRefereeScoreCardProps {
  scenario: DietRefereeScenario
  constitutionTier?: ConstitutionTierId
  compact?: boolean
  ann?: string
}

export function DietRefereeScoreCard({
  scenario,
  constitutionTier = 'strict-fat-loss',
  compact = false,
  ann,
}: DietRefereeScoreCardProps) {
  const passed = scenario.score > 3.0
  const isZeroMelt = scenario.score === 0
  const scoreTone: Tone = isZeroMelt
    ? 'danger'
    : passed
      ? scenario.score >= 4.0
        ? 'success'
        : 'diet'
      : 'warning'

  const tierMeta =
    CONSTITUTION_TIERS.find((t) => t.id === constitutionTier) ?? CONSTITUTION_TIERS[0]!
  const scorePercent = Math.round((scenario.score / 5.0) * 100)

  return (
    <Card
      data-ann={ann ?? `playbook.modules.diet.referee.${scenario.id}`}
      className={cn('flex min-w-0 flex-col gap-3.5', compact && 'p-3.5')}
    >
      {/* 1. 顶部：场景标题 + 餐次与体质标签 */}
      <div className="border-border flex flex-wrap items-start justify-between gap-2 border-b pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={scoreTone} dot>
              {scenario.verdictBadge}
            </Badge>
            <Badge tone="neutral">{scenario.mealLabel}</Badge>
          </div>
          <h3 className="text-subhead mt-1.5 font-bold">{scenario.title}</h3>
          <p className="text-tiny text-muted mt-0.5">{scenario.subtitle}</p>
        </div>

        {/* 5.0 分仪表环 */}
        <ProgressRing
          value={scenario.score}
          max={5}
          tone={scoreTone}
          size={64}
          thickness={7}
          label={`${scenario.title} 饮食评分`}
        >
          <div className="flex flex-col items-center leading-none">
            <span className="font-display text-subhead font-bold tabular-nums">
              {scenario.score.toFixed(1)}
            </span>
            <span className="text-tiny text-muted">/ 5.0</span>
          </div>
        </ProgressRing>
      </div>

      {/* 2. 5.0 分制标尺与 3.0 分有效打卡门槛线 */}
      <div className="bg-surface-sunken/80 border-border flex flex-col gap-1.5 rounded-2xl border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-tiny font-bold">5.0 分制裁判标尺（执裁档位：{tierMeta.name}）</span>
          <span
            className={cn('text-tiny font-bold', passed ? 'text-success-ink' : 'text-danger-ink')}
          >
            {passed ? '✓ 已过 3.0 有效线' : '✕ 未达 3.0 有效线'}
          </span>
        </div>

        {/* 带 3.0 分（60% 位置）刻度线的水平标尺 */}
        <div className="relative pt-1 pb-4">
          <div className="bg-surface border-border h-3 w-full overflow-hidden rounded-full border">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-(--dur-slow)',
                solidToneClass[scoreTone],
              )}
              style={{ width: `${Math.max(4, scorePercent)}%` }}
            />
          </div>
          {/* 3.0 分有效门槛标记（60% 处） */}
          <div
            className="pointer-events-none absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: '60%' }}
          >
            <span className="bg-foreground h-5 w-0.5 rounded-full" />
            <span className="text-tiny text-foreground mt-0.5 font-mono font-bold whitespace-nowrap">
              3.0 有效线
            </span>
          </div>
          <span className="text-tiny text-muted absolute bottom-0 left-0 font-mono">0.0</span>
          <span className="text-tiny text-muted absolute right-0 bottom-0 font-mono">5.0 满分</span>
        </div>

        {/* 有效 / 无效分流结论横幅 */}
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl px-3 py-2',
            passed ? 'bg-success-soft/75 text-success-ink' : 'bg-danger-soft/80 text-danger-ink',
          )}
        >
          <Icon name={passed ? 'check' : 'alert'} size={16} className="shrink-0" />
          <p className="text-tiny font-semibold">{scenario.verdictDetail}</p>
        </div>
      </div>

      {/* 3. 早·中·晚碳水与 GI 升糖节律指示器 */}
      <div className="border-border bg-surface flex flex-col gap-2 rounded-2xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-caption font-bold">早·中·晚碳水与 GI 升糖节律</span>
          <Badge
            tone={
              scenario.giLevel === 'low'
                ? 'success'
                : scenario.giLevel === 'medium'
                  ? 'warning'
                  : 'danger'
            }
          >
            {scenario.giValueText}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'morning', label: '☀️ 早：控高GI', rule: '忌空腹精糖' },
            { id: 'noon', label: '🌤️ 中：适量碳水', rule: '配复合粗粮' },
            { id: 'evening', label: '🌙 晚：严控碳水', rule: '防夜间囤脂' },
          ].map((slot) => {
            const active = slot.id === scenario.rhythmWindow
            return (
              <div
                key={slot.id}
                className={cn(
                  'flex flex-col rounded-xl border px-2.5 py-1.5',
                  active
                    ? slot.id === 'evening' && scenario.giLevel === 'high'
                      ? 'bg-danger-soft/70 border-danger text-danger-ink font-bold'
                      : 'bg-diet-soft/80 border-diet text-diet-ink font-bold'
                    : 'bg-surface-sunken/50 border-border text-muted',
                )}
              >
                <span className="text-tiny truncate font-bold">{slot.label}</span>
                <span className="text-tiny truncate opacity-85">{slot.rule}</span>
              </div>
            )
          })}
        </div>
        <p className="text-tiny text-muted">{scenario.rhythmVerdict}</p>
      </div>

      {/* 4. 《中国居民膳食指南》四大餐盘均衡条（红绿灯） */}
      <div className="border-border bg-surface flex flex-col gap-2.5 rounded-2xl border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption font-bold">《中国居民膳食指南》四大餐盘均衡条</span>
          <span className="text-tiny text-muted font-mono">约 {scenario.totalKcal} kcal</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {scenario.plateBars.map((bar) => {
            const meta = lightMeta[bar.light]
            return (
              <div
                key={bar.id}
                className="bg-surface-sunken/60 border-border flex flex-col gap-1.5 rounded-xl border p-2.5"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('size-2 shrink-0 rounded-full', meta.dotClass)} />
                    <span className="text-tiny font-bold">{bar.label}</span>
                  </div>
                  <span className="text-tiny text-muted truncate font-semibold">
                    {bar.ratioText}
                  </span>
                </div>
                <ProgressBar
                  value={bar.percent}
                  max={100}
                  tone={meta.barTone}
                  size="sm"
                  label={`${bar.label}配比指标`}
                />
                <span className="text-tiny text-muted truncate">{bar.detail}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 5. 加减分明细与团团点评 */}
      {!compact && (
        <div className="bg-surface-sunken/60 border-border flex flex-col gap-2 rounded-2xl border p-3">
          <span className="text-tiny text-muted font-bold">AI 裁判扣分与加权明细</span>
          <ul className="space-y-1">
            {scenario.deductions.map((d) => (
              <li key={d.reason} className="flex items-center justify-between gap-2">
                <span className="text-tiny text-foreground truncate">{d.reason}</span>
                <span
                  className={cn(
                    'font-display text-tiny shrink-0 rounded-full px-2 py-0.5 font-bold tabular-nums',
                    softToneClass[d.tone],
                  )}
                >
                  {d.delta}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-border mt-1 flex items-start gap-2.5 border-t pt-2.5">
            <Mascot
              mood={isZeroMelt ? 'surprised' : passed ? 'happy' : 'thinking'}
              size={42}
              className="shrink-0"
            />
            <p className="text-tiny text-foreground leading-relaxed">{scenario.tuanAdvice}</p>
          </div>
        </div>
      )}

      {/* 6. DeepSeek 联网权威核验来源条 */}
      <div className="bg-primary-soft/45 border-border flex flex-col gap-1 rounded-2xl border px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <Icon name="globe" size={14} className="text-primary-ink shrink-0" />
            <span className="text-tiny text-primary-ink font-bold">
              DeepSeek 联网权威核验：{scenario.deepseekCitation.sourceTitle}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="bg-surface text-muted text-tiny rounded-full px-2 py-0.5 font-mono">
              钠 {scenario.deepseekCitation.sodiumMg}mg
            </span>
            <span className="bg-surface text-muted text-tiny rounded-full px-2 py-0.5 font-mono">
              添加糖 {scenario.deepseekCitation.addedSugarG}g
            </span>
          </div>
        </div>
        <p className="text-tiny text-muted leading-relaxed">{scenario.deepseekCitation.evidence}</p>
      </div>
    </Card>
  )
}

// ============================================================================
// Section 02 矩阵：每行 2 卡（md:grid-cols-2）对比展示 A/B/C/D 四大经典判罚场景
// ============================================================================

export function DietRefereeScenariosMatrix() {
  const [tier, setTier] = useState<ConstitutionTierId>('strict-fat-loss')

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部快速切换体质档位，观察 4 张成绩单的执裁基准联动 */}
      <div className="border-border bg-surface flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Icon name="sliders" size={16} className="text-diet-ink" />
          <span className="text-caption font-bold">切换当前用户的体质执裁档位：</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CONSTITUTION_TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTier(t.id)}
              className={cn(
                'text-tiny rounded-full px-3 py-1 font-semibold transition-all',
                tier === t.id
                  ? cn(softToneClass[t.tone], 'shadow-soft font-bold')
                  : 'bg-surface-sunken text-muted hover:text-foreground',
              )}
            >
              {t.name}（{t.badgeText.split(' ')[0]}）
            </button>
          ))}
        </div>
      </div>

      {/* 严格 md:grid-cols-2 每行 2 卡 */}
      <div className="grid gap-4 md:grid-cols-2">
        <DietRefereeScoreCard
          scenario={DIET_REFEREE_SCENARIOS['clean-lunch']}
          constitutionTier={tier}
          ann="playbook.modules.diet.scenario-a"
        />
        <DietRefereeScoreCard
          scenario={DIET_REFEREE_SCENARIOS['junk-dinner']}
          constitutionTier={tier}
          ann="playbook.modules.diet.scenario-b"
        />
        <DietRefereeScoreCard
          scenario={DIET_REFEREE_SCENARIOS['icecream-lunch']}
          constitutionTier={tier}
          ann="playbook.modules.diet.scenario-c"
        />
        <DietRefereeScoreCard
          scenario={DIET_REFEREE_SCENARIOS['heavy-noodle-dinner']}
          constitutionTier={tier}
          ann="playbook.modules.diet.scenario-d"
        />
      </div>
    </div>
  )
}

// ============================================================================
// Section 03：饮食板块完整页面沙盒（<PhoneFrame> 手机端完整页 + 右侧场景切换器）
// ============================================================================

export function DietFullPageSandbox() {
  const [scenarioId, setScenarioId] = useState<DietRefereeScenario['id']>('clean-lunch')
  const [inputMode, setInputMode] = useState<CheckinInputMode>('smart-capture')
  const [scanPhase, setScanPhase] = useState<ScanPhase>('done')
  const [tier, setTier] = useState<ConstitutionTierId>('strict-fat-loss')
  const [mealOverride, setMealOverride] = useState<MealType | null>(null)
  const [stamped, setStamped] = useState(false)

  const scenario = DIET_REFEREE_SCENARIOS[scenarioId]
  const activeMeal = mealOverride ?? scenario.meal
  const passed = scenario.score > 3.0

  function selectScenario(nextId: DietRefereeScenario['id']) {
    setScenarioId(nextId)
    setMealOverride(null)
    setStamped(false)
  }

  return (
    <div
      data-ann="playbook.modules.diet.sandbox"
      className="grid items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)]"
    >
      {/* 左侧：360px 手机外框完整「好好吃饭」打卡页 */}
      <div className="flex justify-center">
        <PhoneFrame label="手机 · /goals/diet/checkin（好好吃饭完整打卡页）" className="h-[780px]">
          <div className="flex h-full flex-col overflow-hidden">
            <TopBar
              sticky={false}
              title="好好吃饭"
              leading={<IconButton icon="chevron-left" label="返回" className="-ml-2" />}
              actions={<Badge tone="diet">饮食裁判</Badge>}
              className="shrink-0 pt-10"
            />

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 pt-2 pb-6">
              {/* 顶部目标检验提示 + 全板块统一三态 Tab */}
              <Card className="flex flex-col gap-2.5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <IconTile icon="diet" tone="diet" size="sm" />
                    <div className="min-w-0">
                      <p className="text-caption truncate font-bold">30 天干净饮食控糖冲刺</p>
                      <p className="text-tiny text-muted truncate">
                        达标规则：AI 评分 &gt; 3.0 分 · 零炸鸡可乐
                      </p>
                    </div>
                  </div>
                  <Badge tone="diet">12/30天</Badge>
                </div>
                <CheckinModeTabs
                  value={inputMode}
                  onValueChange={(next) => {
                    setInputMode(next)
                    setStamped(false)
                  }}
                />
              </Card>

              {/* 餐次选择（早/中/晚/加餐） */}
              <Card className="flex flex-col gap-2.5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-bold">当前餐次与碳水节律</span>
                  <span className="text-tiny text-diet-ink font-semibold">
                    {activeMeal === 'breakfast'
                      ? '☀️ 早：控高GI'
                      : activeMeal === 'lunch'
                        ? '🌤️ 中：适量复合碳水'
                        : activeMeal === 'dinner'
                          ? '🌙 晚：严控精制碳水'
                          : '🍵 加餐：控游离糖'}
                  </span>
                </div>
                <SegmentedControl
                  size="sm"
                  label="餐次选择"
                  value={activeMeal}
                  onValueChange={setMealOverride}
                  options={[
                    { value: 'breakfast', label: '早餐' },
                    { value: 'lunch', label: '午餐' },
                    { value: 'dinner', label: '晚餐' },
                    { value: 'snack', label: '加餐' },
                  ]}
                />
              </Card>

              {/* 智能拍照 / 上传模式下显示极简扫描镜（单板块内已知是饮食，跳过一行识别方向条） */}
              {inputMode !== 'manual' && (
                <SmartScannerLens
                  preset={scenario.scannerPreset}
                  phase={scanPhase}
                  tone="diet"
                  onRescan={() =>
                    setScanPhase((prev) => (prev === 'scanning' ? 'done' : 'scanning'))
                  }
                />
              )}

              {/* 食物清单编辑区（单列垂直排布，0 横向溢出） */}
              <Card className="flex flex-col gap-2.5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-bold">识别食物清单（可微调份量）</span>
                  <span className="font-display text-tiny text-muted tabular-nums">
                    共 {scenario.totalKcal} kcal
                  </span>
                </div>
                <div className="bg-surface-sunken divide-border divide-y rounded-2xl px-3 py-1">
                  {scenario.items.map((item) => (
                    <div
                      key={item.name}
                      className="flex min-w-0 items-center justify-between gap-2 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-caption truncate font-bold">{item.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-tiny text-muted">{item.portion}</span>
                          <Badge tone={item.tagTone}>{item.tag}</Badge>
                        </div>
                      </div>
                      <span className="font-display text-diet-ink bg-diet-soft text-tiny shrink-0 rounded-full px-2.5 py-0.5 font-semibold tabular-nums">
                        {item.kcal} kcal
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 5 分制 AI 裁判成绩单（手机内紧凑视图） */}
              <DietRefereeScoreCard
                scenario={scenario}
                constitutionTier={tier}
                compact
                ann="playbook.modules.diet.sandbox.scorecard"
              />

              {/* 底部主操作区：根据 > 3.0 分或 ≤ 3.0 分自动切换按钮状态与盖章反馈 */}
              <Card className="flex flex-col gap-2.5 p-3.5">
                {stamped ? (
                  <div className="flex flex-col items-center gap-2 py-3 text-center">
                    <div className="relative">
                      <Mascot mood="cheer" size={76} />
                      <Stamp
                        caption="有效打卡"
                        tone="diet"
                        animate
                        size={56}
                        className="absolute -top-2 -right-9"
                      />
                    </div>
                    <p className="text-caption font-bold">
                      已盖章！{scenario.score.toFixed(1)} 分计入今日「好好吃饭」有效打卡
                    </p>
                    <Button size="sm" variant="soft" onClick={() => setStamped(false)}>
                      返回继续体验
                    </Button>
                  </div>
                ) : passed ? (
                  <>
                    <Button
                      variant="primary"
                      icon="check"
                      className="w-full"
                      onClick={() => {
                        setStamped(true)
                        toast.success(
                          `有效打卡成功！得分 ${scenario.score.toFixed(1)} / 5.0 分，已计入连击`,
                        )
                      }}
                    >
                      确认有效打卡（{scenario.score.toFixed(1)}分）
                    </Button>
                    <p className="text-tiny text-muted text-center">
                      已超过 3.0 分有效线，点击后立即盖章并同步给打卡搭子
                    </p>
                  </>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      icon="alert"
                      className="w-full"
                      onClick={() =>
                        toast.info(
                          `当前得分 ${scenario.score.toFixed(1)} 分（未满 3.0 分），已仅作为日常饮食记录存档，不计入有效打卡`,
                        )
                      }
                    >
                      分数未满 3.0 · 仅保存记录（不计有效打卡）
                    </Button>
                    <p className="text-tiny text-danger-ink text-center font-semibold">
                      团团拦截：本餐未达 3.0 分有效线，仅记入饮食热量账本，不触发今日通关印章
                    </p>
                  </>
                )}
              </Card>
            </div>
          </div>
        </PhoneFrame>
      </div>

      {/* 右侧：沙盒场景切换与设计说明控制台 */}
      <div className="flex min-w-0 flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-subhead font-bold">
              切换 4 大典型饮食裁判场景（实时联动手机）
            </span>
            <Badge tone="diet" icon="sparkles">
              5 分制 AI 裁判沙盒
            </Badge>
          </div>
          <p className="text-caption text-muted">
            点击下方 4 个场景按钮，观察左侧手机框内的食物清单、5.0 分仪表环、3.0
            分有效线标尺、四大餐盘红绿灯以及**底部主按钮文案与状态**如何实时切换：
          </p>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {(Object.values(DIET_REFEREE_SCENARIOS) as DietRefereeScenario[]).map((item) => {
              const active = item.id === scenarioId
              const isPass = item.score > 3.0
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectScenario(item.id)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all active:scale-[0.98]',
                    active
                      ? 'border-primary bg-primary-soft/45 shadow-soft'
                      : 'border-border bg-surface-sunken/60 hover:bg-surface-sunken',
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-caption font-bold">
                      场景 {item.code} · {item.score.toFixed(1)} 分
                    </span>
                    <Badge tone={item.score === 0 ? 'danger' : isPass ? 'success' : 'warning'}>
                      {isPass ? '有效打卡' : '拦截不打卡'}
                    </Badge>
                  </div>
                  <p className="text-tiny text-muted line-clamp-2">{item.subtitle}</p>
                </button>
              )
            })}
          </div>

          {/* 快捷切换体质档位与顶部 Tab */}
          <div className="border-border bg-surface-sunken/70 flex flex-col gap-2.5 rounded-2xl border p-3.5">
            <span className="text-tiny text-muted font-bold">
              1. 切换个人体质档位（影响晚间碳水与油盐扣分权重）：
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CONSTITUTION_TIERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTier(t.id)}
                  className={cn(
                    'text-tiny rounded-full px-3 py-1 font-semibold transition-all',
                    tier === t.id
                      ? cn(softToneClass[t.tone], 'shadow-soft font-bold')
                      : 'bg-surface text-muted hover:text-foreground',
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>

            <span className="text-tiny text-muted mt-1 font-bold">
              2. 切换打卡页顶部记录方式 Tab：
            </span>
            <CheckinModeTabs value={inputMode} onValueChange={setInputMode} />
          </div>
        </Card>

        <Card variant="sunken" className="flex flex-col gap-2.5">
          <h4 className="text-caption font-bold">为什么饮食打卡采用「5 分制 + 3.0 分有效线」？</h4>
          <ul className="text-tiny text-muted space-y-1.5 leading-relaxed">
            <li className="flex items-start gap-2">
              <Icon name="check" size={14} className="text-success mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">拒绝拍炸鸡可乐混连击</strong>
                ：传统打卡应用只要传张照片就算完成，用户拍顿夜宵炸鸡也能拿连击徽章。引入 5 分制 AI
                裁判后，垃圾食品触发 `-5.0` 分一票否决（0 分熔断），彻底杜绝虚假健康打卡。
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Icon name="check" size={14} className="text-success mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">未满 3.0 分温柔分流「仅作记录」</strong>：得分为
                0.0 或 2.4
                分时不粗暴报错丢弃数据，而是将主按钮切换为「仅保存记录（不计有效打卡）」，既诚实记录热量账本，又守护有效打卡印章的含金量。
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Icon name="check" size={14} className="text-success mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">早中晚碳水 GI 节律科学引导</strong>
                ：早上防高糖空腹飙升胰岛素、中午允许适量复合碳水供能、晚上严控高 GI
                精制面食与甜品，配合 DeepSeek 联网检索《中国居民膳食指南
                2022》给出有据可查的改良建议。
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
