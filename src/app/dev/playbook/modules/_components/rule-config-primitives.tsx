'use client'

import { useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon, type IconName } from '@/components/ui/icon'
import { ProgressBar } from '@/components/ui/progress'
import { toast } from '@/components/ui/toast'
import { moduleMeta, softToneClass, type ModuleTone, type Tone } from '@/components/ui/tone'
import { cn } from '@/lib/cn'

/*
 * 打卡板块共享原子组件：
 * 1. PersonalConstitutionTierPicker —— 个人体质与 AI 裁判严格度档位选择器（3 档）
 * 2. GoalVerificationRuleCard —— 个人目标自定义期限与有效打卡检验标准配置卡
 */

export type ConstitutionTierId = 'strict-fat-loss' | 'balanced-glycemic' | 'gentle-gain'

export interface ConstitutionTierMeta {
  id: ConstitutionTierId
  name: string
  badgeText: string
  audience: string
  tone: Tone
  icon: IconName
  summary: string
  carbRhythm: {
    morning: string
    noon: string
    evening: string
  }
  redlinePenalty: string
  proteinAndFatRule: string
  exerciseSynergy: string
}

export const CONSTITUTION_TIERS: ConstitutionTierMeta[] = [
  {
    id: 'strict-fat-loss',
    name: '减脂严管档',
    badgeText: '偏胖 / 大基数',
    audience: 'BMI ≥ 24 或处于减脂攻坚期，需严格控制胰岛素波动与热量盈余',
    tone: 'danger',
    icon: 'flame',
    summary:
      '油脂与精制糖双严管、晚餐严禁高 GI 碳水；含糖饮料与炸鸡汉堡直接触发 -5.0 分一票否决（0 分熔断，仅作记录不计有效打卡）。',
    carbRhythm: {
      morning: '早餐：低 GI 粗粮定量，禁油条/甜面包',
      noon: '午餐：拳头大小复合碳水，配足绿叶菜',
      evening: '晚餐：禁精制高碳水，仅限优质蛋白+蔬菜',
    },
    redlinePenalty: '炸鸡 / 汉堡 / 奶茶 / 含糖可乐 → 触发一级红线 -5.0 分（直接 0.0 分熔断）',
    proteinAndFatRule: '严控红油重盐与油炸烹调（扣 1.5–2.5 分），优先清蒸/白灼/少油快炒',
    exerciseSynergy: '快走需满 30 分钟且 ≥ 2.5 km 才算有效有氧，散步溜达不计入打卡',
  },
  {
    id: 'balanced-glycemic',
    name: '控糖均衡档',
    badgeText: '标准体型 / 控糖抗炎',
    audience: '对标《中国居民膳食指南 2022》，追求平稳血糖、精力充沛与长期健康习惯',
    tone: 'diet',
    icon: 'shield',
    summary:
      '按早中晚 GI 节律科学分配碳水，鼓励「谷薯+蔬果+优质蛋白」2:2:1 餐盘配比；垃圾食品与深夜高糖重扣，午间偶发小甜点适度扣分提醒。',
    carbRhythm: {
      morning: '早餐：全谷物+鸡蛋牛奶，忌空腹高糖拉升血糖',
      noon: '午餐：适量杂粮饭/米饭，控制餐后困倦',
      evening: '晚餐：碳水减半、选低 GI 食材，睡前 3h 禁食',
    },
    redlinePenalty: '正餐当垃圾食品吃扣 -3.5 至 -5.0 分；午后小份解馋扣 -1.2 分并锁死晚间额度',
    proteinAndFatRule: '每日钠摄入对标 < 5g 盐当量，重盐浓汤与加工肉制品触发黄牌扣分',
    exerciseSynergy: '快走 ≥ 25 分钟且 ≥ 2.0 km，或跑步 ≥ 15 分钟 / 2.0 km 即达有效门槛',
  },
  {
    id: 'gentle-gain',
    name: '增肌 / 偏瘦温和档',
    badgeText: '偏瘦体质 / 增肌塑形',
    audience: 'BMI < 18.5 或进行系统抗阻训练，需要充足干净碳水与高生物价蛋白质',
    tone: 'exercise',
    icon: 'bolt',
    summary:
      '放宽日间与练后复合碳水及总热量上限，重点考核每餐优质蛋白质达标率；对反式脂肪、深度油炸与空热量含糖饮料依然严厉扣分。',
    carbRhythm: {
      morning: '早餐：充足复合碳水+双份蛋白，开启合成代谢',
      noon: '午餐：正常米面主食+足量瘦肉/鱼虾',
      evening: '晚餐：训练日可保留适量慢碳，非训练日适度控精糖',
    },
    redlinePenalty: '反式脂肪/劣质油炸/代可可脂重扣 -3.0 分；不因吃饱干净米饭而误扣分',
    proteinAndFatRule: '若单餐缺乏优质蛋白质（鱼禽蛋瘦肉豆）扣 -1.0 分，鼓励加餐坚果/酸奶',
    exerciseSynergy: '力量训练 ≥ 15 分钟（或核心动作 4 组×15 次）即可判定为高价值有效运动',
  },
]

export interface PersonalConstitutionTierPickerProps {
  value?: ConstitutionTierId
  defaultValue?: ConstitutionTierId
  onValueChange?: (next: ConstitutionTierId) => void
  annPrefix?: string
  className?: string
}

export function PersonalConstitutionTierPicker({
  value,
  defaultValue = 'strict-fat-loss',
  onValueChange,
  annPrefix = 'playbook.modules.shared.constitution',
  className,
}: PersonalConstitutionTierPickerProps) {
  const [internalTier, setInternalTier] = useState<ConstitutionTierId>(defaultValue)
  const activeTierId = value ?? internalTier
  const activeTier = CONSTITUTION_TIERS.find((t) => t.id === activeTierId) ?? CONSTITUTION_TIERS[0]!

  function handleSelect(next: ConstitutionTierId) {
    setInternalTier(next)
    onValueChange?.(next)
  }

  return (
    <Card data-ann={annPrefix} className={cn('flex min-w-0 flex-col gap-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTile icon={activeTier.icon} tone={activeTier.tone} size="md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-subhead font-bold">个人体质与 AI 裁判严格度档位</h3>
              <Badge tone={activeTier.tone}>{activeTier.badgeText}</Badge>
            </div>
            <p className="text-tiny text-muted mt-0.5 truncate">{activeTier.audience}</p>
          </div>
        </div>
        <Badge tone="primary" icon="sliders">
          3 档体质可切
        </Badge>
      </div>

      {/* 3 档切换胶囊 */}
      <div
        role="radiogroup"
        aria-label="个人体质档位选择"
        className="bg-surface-sunken grid grid-cols-1 gap-1.5 rounded-2xl p-1.5 sm:grid-cols-3"
      >
        {CONSTITUTION_TIERS.map((tier) => {
          const active = tier.id === activeTierId
          return (
            <button
              key={tier.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleSelect(tier.id)}
              className={cn(
                'text-caption flex min-w-0 flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-all duration-(--dur-fast) select-none active:scale-[0.98]',
                active
                  ? 'bg-surface text-foreground shadow-soft border-border border'
                  : 'text-muted hover:text-foreground',
              )}
            >
              <div className="flex w-full items-center justify-between gap-1.5">
                <span className="truncate font-bold">{tier.name}</span>
                <span
                  className={cn(
                    'text-tiny shrink-0 rounded-full px-2 py-0.5 font-semibold',
                    softToneClass[tier.tone],
                  )}
                >
                  {tier.badgeText.split(' ')[0]}
                </span>
              </div>
              <span className="text-tiny text-muted truncate">
                {tier.id === 'strict-fat-loss'
                  ? '垃圾食品 -5 分一票否决'
                  : tier.id === 'balanced-glycemic'
                    ? '膳食指南 + 早中晚 GI 节律'
                    : '放宽干净碳水 · 严抓优质蛋白'}
              </span>
            </button>
          )
        })}
      </div>

      {/* 当前档位判罚准则详情 */}
      <div className="bg-surface-sunken/70 border-border flex flex-col gap-3 rounded-2xl border p-3.5">
        <div className="flex items-start gap-2.5">
          <Mascot
            mood={
              activeTier.id === 'strict-fat-loss'
                ? 'thinking'
                : activeTier.id === 'balanced-glycemic'
                  ? 'happy'
                  : 'cheer'
            }
            size={48}
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-caption font-bold">
              团团执裁基准：{activeTier.name}（{activeTier.badgeText}）
            </p>
            <p className="text-tiny text-muted mt-0.5 leading-relaxed">{activeTier.summary}</p>
          </div>
        </div>

        {/* 早中晚碳水节律三格 */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="bg-surface border-border rounded-xl border px-3 py-2">
            <span className="text-tiny text-diet-ink font-bold">☀️ 早餐节律</span>
            <p className="text-tiny text-muted mt-0.5">{activeTier.carbRhythm.morning}</p>
          </div>
          <div className="bg-surface border-border rounded-xl border px-3 py-2">
            <span className="text-tiny text-success-ink font-bold">🌤️ 午餐节律</span>
            <p className="text-tiny text-muted mt-0.5">{activeTier.carbRhythm.noon}</p>
          </div>
          <div className="bg-surface border-border rounded-xl border px-3 py-2">
            <span className="text-tiny text-danger-ink font-bold">🌙 晚餐红线</span>
            <p className="text-tiny text-muted mt-0.5">{activeTier.carbRhythm.evening}</p>
          </div>
        </div>

        {/* 红线与协同规则 */}
        <div className="border-border divide-border bg-surface divide-y rounded-xl border px-3">
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-tiny text-muted font-semibold">高危红线扣分</span>
            <span className="text-tiny text-danger-ink font-bold">{activeTier.redlinePenalty}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-tiny text-muted font-semibold">油脂钠盐与蛋白</span>
            <span className="text-tiny text-foreground font-semibold">
              {activeTier.proteinAndFatRule}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="text-tiny text-muted font-semibold">运动有效性联动</span>
            <span className="text-tiny text-exercise-ink font-semibold">
              {activeTier.exerciseSynergy}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ============================================================================
// 2. GoalVerificationRuleCard（个人目标自定义期限与检验标准配置卡）
// ============================================================================

export interface VerificationRuleItem {
  id: string
  label: string
  threshold: string
  detail: string
  strict?: boolean
}

export interface GoalRulePreset {
  module: ModuleTone
  goalTitle: string
  durationBadge: string
  progressDays: number
  totalDays: number
  passFormula: string
  failConsequence: string
  rules: VerificationRuleItem[]
}

export const GOAL_RULE_PRESETS: Record<ModuleTone, GoalRulePreset> = {
  diet: {
    module: 'diet',
    goalTitle: '好好吃饭 · 30 天干净饮食控糖冲刺',
    durationBadge: '30 天减脂冲刺 · 剩余 18 天',
    progressDays: 12,
    totalDays: 30,
    passFormula: '单餐 / 当日饮食 AI 评分 > 3.0 分（满分 5.0）且未触发垃圾食品一票否决',
    failConsequence: '评分 ≤ 3.0 分时仅作为日常饮食账本存档，不盖有效打卡章、不计入连击天数',
    rules: [
      {
        id: 'diet-score',
        label: '最低有效打卡分数线',
        threshold: '> 3.0 / 5.0 分',
        detail: '综合《中国居民膳食指南》餐盘配比、烹饪油盐与全天营养协同打分',
        strict: true,
      },
      {
        id: 'diet-redline',
        label: '一级垃圾食品熔断红线',
        threshold: '零炸鸡汉堡 / 零含糖饮料',
        detail: '检出重度油炸快餐或高糖碳酸饮料直接扣 -5.0 分，当日总分归零',
        strict: true,
      },
      {
        id: 'diet-evening-gi',
        label: '晚间高碳水与高 GI 管控',
        threshold: '晚餐精制碳水 ≤ 半拳',
        detail: '早上严控高 GI 空腹飙糖，中午可适量复合碳水，晚上吃大碗面/甜食重扣',
      },
    ],
  },
  exercise: {
    module: 'exercise',
    goalTitle: '动一动 · 21 天有效有氧与核心唤醒',
    durationBadge: '21 天运动习惯 · 剩余 9 天',
    progressDays: 12,
    totalDays: 21,
    passFormula: '满足对应运动品类的「最低有效时长 × 距离/容量」双维门槛',
    failConsequence: '低于有效阈值（如慢走 10 分钟 0.6km）判定为日常活动备忘，拦截伪运动打卡',
    rules: [
      {
        id: 'ex-walk',
        label: '快走 / 健步走有效门槛',
        threshold: '≥ 30 分钟 且 ≥ 2.5 公里',
        detail: '拒绝“下楼散步 10 分钟糊弄打卡”，需达到微汗快走配速与里程',
        strict: true,
      },
      {
        id: 'ex-run',
        label: '跑步高 MET 折算门槛',
        threshold: '≥ 15 分钟 或 ≥ 2.0 公里',
        detail: '跑步代谢当量（MET ≈ 8.0）较高，满 15 分钟或满 2 公里即认定有效',
        strict: true,
      },
      {
        id: 'ex-strength',
        label: '力量训练 / 蹲起 / 核心',
        threshold: '≥ 15 分钟 或 4 组×15 次',
        detail: '按有效抗阻时长或动作总容量（如深蹲 60 次）核验',
      },
    ],
  },
  sleep: {
    module: 'sleep',
    goalTitle: '早点睡 · 14 天 23:30 前入睡挑战',
    durationBadge: '14 天作息校准 · 剩余 5 天',
    progressDays: 9,
    totalDays: 14,
    passFormula: '23:30 前入睡 且 夜间连续睡眠时长 ≥ 6.5 小时',
    failConsequence: '凌晨 01:00 后熬夜入睡或总时长 < 5 小时仅记入睡眠监测，不计有效早睡打卡',
    rules: [
      {
        id: 'sl-bedtime',
        label: '最晚入睡红线时刻',
        threshold: '≤ 23:30 入睡',
        detail: '跨午夜熬夜会破坏褪黑素节律，超过 00:00 触发熬夜黄牌',
        strict: true,
      },
      {
        id: 'sl-duration',
        label: '最低有效睡眠时长',
        threshold: '6.5 – 9.0 小时',
        detail: '保证充足深睡修复，排除白天碎片补觉伪造整夜睡眠',
      },
    ],
  },
  study: {
    module: 'study',
    goalTitle: '学一点 · 30 天算法与阅读深度专注',
    durationBadge: '30 天深度学习 · 剩余 14 天',
    progressDays: 16,
    totalDays: 30,
    passFormula: '单次专注 ≥ 25 分钟（1 个完整番茄钟）且附带有效内容产出/笔记摘录',
    failConsequence: '无实质学习主题或时长 < 15 分钟仅存为灵感便签，不计入有效学习打卡',
    rules: [
      {
        id: 'st-minutes',
        label: '最低深度专注时长',
        threshold: '≥ 25 分钟',
        detail: '至少完成一个标准番茄钟，拒绝走马观花式翻书 3 分钟',
        strict: true,
      },
      {
        id: 'st-output',
        label: '实质学习内容核验',
        threshold: '明确主题 + 要点摘录',
        detail: '支持上传 HTML/TXT 笔记或拍照识别书页，AI 自动提纯核验知识点',
      },
    ],
  },
  custom: {
    module: 'custom',
    goalTitle: '我的小目标 · 28 天无糖饮水 2000ml',
    durationBadge: '28 天习惯养成 · 剩余 10 天',
    progressDays: 18,
    totalDays: 28,
    passFormula: '完成用户自定义数值阈值（如饮水 ≥ 6 杯 / 1500ml）且符合纯净度约束',
    failConsequence: '未达自定义下限或用含糖奶茶替代温水时，仅更新当日进度条，不触发通关印章',
    rules: [
      {
        id: 'cu-target',
        label: '每日自定义达标下限',
        threshold: '≥ 6 杯（约 1500 ml）',
        detail: '支持按杯数、毫升、次数或布尔开关自定义每日合格线',
        strict: true,
      },
      {
        id: 'cu-purity',
        label: '习惯纯净度附加条款',
        threshold: '仅计白水 / 淡茶 / 柠檬水',
        detail: '含糖饮料不折算饮水杯数，帮助真正养成健康饮水习惯',
      },
    ],
  },
}

export interface GoalVerificationRuleCardProps {
  module?: ModuleTone
  allowSwitchModule?: boolean
  annPrefix?: string
  className?: string
}

export function GoalVerificationRuleCard({
  module = 'diet',
  allowSwitchModule = false,
  annPrefix = 'playbook.modules.shared.goal-rule',
  className,
}: GoalVerificationRuleCardProps) {
  const [selectedModule, setSelectedModule] = useState<ModuleTone>(module)
  const [strictMode, setStrictMode] = useState(true)

  const activeModule = allowSwitchModule ? selectedModule : module
  const preset = GOAL_RULE_PRESETS[activeModule]

  return (
    <Card data-ann={annPrefix} className={cn('flex min-w-0 flex-col gap-3.5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTile icon={moduleMeta[activeModule].icon} tone={activeModule} size="md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-subhead truncate font-bold">{preset.goalTitle}</h3>
            </div>
            <p className="text-tiny text-muted mt-0.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <Icon name="calendar" size={12} />
                {preset.durationBadge}
              </span>
            </p>
          </div>
        </div>
        <Badge tone={activeModule} icon="flag">
          目标检验标准
        </Badge>
      </div>

      {allowSwitchModule && (
        <div className="bg-surface-sunken flex flex-wrap gap-1 rounded-full p-1">
          {(['diet', 'exercise', 'sleep', 'study', 'custom'] as ModuleTone[]).map((m) => {
            const active = m === activeModule
            return (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedModule(m)}
                className={cn(
                  'text-tiny flex h-8 flex-1 items-center justify-center gap-1 rounded-full px-2 font-semibold whitespace-nowrap transition-all',
                  active
                    ? cn(softToneClass[m], 'shadow-soft font-bold')
                    : 'text-muted hover:text-foreground',
                )}
              >
                <Icon name={moduleMeta[m].icon} size={12} />
                <span>{moduleMeta[m].label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* 目标周期进度条 */}
      <div className="bg-surface-sunken/70 border-border flex flex-col gap-2 rounded-2xl border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption font-bold">目标周期进度 · {preset.durationBadge}</span>
          <span className="font-display text-caption text-foreground font-bold tabular-nums">
            {preset.progressDays} / {preset.totalDays} 天
          </span>
        </div>
        <ProgressBar
          value={preset.progressDays}
          max={preset.totalDays}
          tone={activeModule}
          size="sm"
          label="目标周期完成天数"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <span className="text-tiny text-muted">
            只有通过下方「达标检验标准」的打卡才计入有效天数
          </span>
          <button
            type="button"
            onClick={() => {
              setStrictMode((v) => !v)
              toast.info(
                !strictMode ? '已开启团团严格核验模式' : '已切换为温和提醒模式（仍展示评分）',
              )
            }}
            className={cn(
              'text-tiny inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold transition-colors',
              strictMode
                ? 'bg-primary-soft text-primary-ink'
                : 'bg-surface text-muted border-border border',
            )}
          >
            <Icon name="shield" size={12} />
            <span>{strictMode ? '严格拦截未达标打卡：开启' : '严格拦截：温和提醒'}</span>
          </button>
        </div>
      </div>

      {/* 检验条款列表 */}
      <div className="flex flex-col gap-2">
        {preset.rules.map((rule) => (
          <div
            key={rule.id}
            className="border-border bg-surface flex flex-col gap-1 rounded-xl border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Icon
                  name={rule.strict ? 'shield' : 'check'}
                  size={15}
                  className={rule.strict ? 'text-primary-ink shrink-0' : 'text-success shrink-0'}
                />
                <span className="text-caption font-bold">{rule.label}</span>
              </div>
              <Badge tone={rule.strict ? activeModule : 'neutral'}>{rule.threshold}</Badge>
            </div>
            <p className="text-tiny text-muted leading-relaxed">{rule.detail}</p>
          </div>
        ))}
      </div>

      {/* 达标与未达标分流说明 */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="bg-success-soft/60 text-success-ink rounded-xl p-2.5">
          <p className="text-tiny font-bold">✓ 达标通过（计入有效打卡）</p>
          <p className="text-tiny mt-0.5 opacity-90">{preset.passFormula}</p>
        </div>
        <div className="bg-warning-soft/70 text-warning-ink rounded-xl p-2.5">
          <p className="text-tiny font-bold">! 未达标分流（仅存记录不盖章）</p>
          <p className="text-tiny mt-0.5 opacity-90">{preset.failConsequence}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="text-tiny text-muted">目标创建后可随时微调期限与单项门槛</span>
        <Button
          size="sm"
          variant="soft"
          icon="sliders"
          onClick={() => toast.info('已打开目标检验标准自定义抽屉')}
        >
          自定义检验阈值
        </Button>
      </div>
    </Card>
  )
}
