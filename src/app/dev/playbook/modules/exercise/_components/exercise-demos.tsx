'use client'

import { useState } from 'react'
import { TopBar } from '@/components/layout/top-bar'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Icon, type IconName } from '@/components/ui/icon'
import { NumberField } from '@/components/ui/number-field'
import { ProgressBar, ProgressRing } from '@/components/ui/progress'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Stamp } from '@/components/ui/stamp'
import { toast } from '@/components/ui/toast'
import { softToneClass, type Tone } from '@/components/ui/tone'
import type { Intensity } from '@/features/checkin/schemas'
import { cn } from '@/lib/cn'
import { PhoneFrame } from '../../../_components/device-frame'
import {
  CheckinModeTabs,
  SmartScannerLens,
  type CheckinInputMode,
  type ScanPhase,
  type SmartSamplePreset,
} from '../../../_components/smart-recognition-demos'
import { GoalVerificationRuleCard } from '../../_components/rule-config-primitives'

/*
 * 动一动 · 运动板块深度设计组件集
 * 包含：
 * 1. ExerciseThresholdMatrix —— 运动品类分级有效阈值矩阵（快走 / 跑步 / 力量蹲起 / 球类骑行跳绳）
 * 2. ExerciseVerdictCard & ExerciseVerdictComparison —— 运动有效性判决反馈卡对比（有效达标 vs 伪运动拦截）
 * 3. ExerciseFullPageSandbox —— <PhoneFrame> 手机端完整「动一动」打卡页 + 右侧样本与实时阈值测试控制台
 */

export type ExerciseCategoryKey = 'walk' | 'run' | 'strength' | 'sport'

export interface ExerciseCategoryThresholdSpec {
  key: ExerciseCategoryKey
  name: string
  subtitle: string
  metRange: string
  icon: IconName
  tone: Tone
  logicBadge: string
  ruleFormula: string
  minMinutes: number
  minDistanceKm?: number
  minSetsReps?: string
  antiCheatNote: string
  scienceBasis: string
  subTypes: { label: string; threshold: string; met: string }[]
}

export const EXERCISE_THRESHOLD_SPECS: Record<ExerciseCategoryKey, ExerciseCategoryThresholdSpec> =
  {
    walk: {
      key: 'walk',
      name: '快走 / 健步走',
      subtitle: '低冲击基础有氧 · 必须「时长 + 里程」双达标',
      metRange: 'MET 3.8 – 4.5',
      icon: 'footprints',
      tone: 'exercise',
      logicBadge: 'AND 双条件严审',
      ruleFormula: '持续时长 ≥ 25 分钟 且 距离 ≥ 2.5 公里（配速快于 12\'00"/km）',
      minMinutes: 25,
      minDistanceKm: 2.5,
      antiCheatNote:
        '拒绝“出门拿快递、饭后慢悠悠溜达 10 分钟（0.6 公里）糊弄打卡”；配速过慢或里程不足仅归类为日常活动（NEAT）。',
      scienceBasis:
        '快走心率爬升较温和，需维持 20–30 分钟以上且步频 ≥ 100 步/分，才能跨过有氧脂肪动员阈值。',
      subTypes: [
        { label: '减脂严管档', threshold: '≥ 30 分钟 且 ≥ 2.5 km', met: 'MET 4.3' },
        { label: '标准均衡档', threshold: '≥ 25 分钟 且 ≥ 2.0 km', met: 'MET 3.8' },
        { label: '坡度跑步机爬坡', threshold: '≥ 20 分钟（坡度 ≥ 8%）', met: 'MET 6.0' },
      ],
    },
    run: {
      key: 'run',
      name: '跑步 / 户外慢跑',
      subtitle: '高 MET 心肺有氧 · 「时长 或 里程」任一达标即有效',
      metRange: 'MET 7.5 – 9.8',
      icon: 'exercise',
      tone: 'success',
      logicBadge: 'OR 高效折算',
      ruleFormula: '持续时长 ≥ 15 分钟 或 距离 ≥ 2.0 公里',
      minMinutes: 15,
      minDistanceKm: 2.0,
      antiCheatNote:
        '跑步代谢当量约为慢走的 2.2 倍，无需像快走一样强制要求 30 分钟；但跑 3 分钟（400 米）即停仍会被拦截。',
      scienceBasis:
        '依据《中国人群身体活动指南》，1 分钟高强度有氧（跑步）等效于 2 分钟中低强度活动，满 15 分钟或 2km 即达心肺刺激基线。',
      subTypes: [
        { label: '户外慢跑 / 操场跑', threshold: '≥ 15 分钟 或 ≥ 2.0 km', met: 'MET 8.0' },
        { label: '变速跑 / 间歇跑', threshold: '≥ 12 分钟 或 ≥ 1.8 km', met: 'MET 9.5' },
        { label: '室内跑步机', threshold: '≥ 15 分钟 或 ≥ 2.0 km', met: 'MET 7.8' },
      ],
    },
    strength: {
      key: 'strength',
      name: '力量训练 / 核心 / 蹲起',
      subtitle: '抗阻无氧代谢 · 按「有效时长 或 动作组数容量」核验',
      metRange: 'MET 5.0 – 6.0',
      icon: 'bolt',
      tone: 'primary',
      logicBadge: '容量 / 时长双轨',
      ruleFormula: '有效抗阻 ≥ 15 分钟 或 动作容量 ≥ 4 组 × 15 次（共 60 次）',
      minMinutes: 15,
      minSetsReps: '4 组 × 15 次',
      antiCheatNote:
        '无氧训练不产生位移公里数，Agent 自动切换为「净训练时长 / 组数×次数」判别器；随手蹲 5 下活动膝盖不计入打卡。',
      scienceBasis:
        '抗阻训练通过肌纤维微损伤与过量氧耗（EPOC）持续提升基础代谢，核心考核有效力竭组数与训练密度。',
      subTypes: [
        { label: '徒手深蹲 / 箭步蹲', threshold: '≥ 4 组×15 次（或 ≥ 15 分钟）', met: 'MET 5.0' },
        { label: '哑铃 / 器械抗阻', threshold: '净训练 ≥ 20 分钟（≥ 12 组）', met: 'MET 6.0' },
        { label: '核心平板 / 卷腹', threshold: '累计 ≥ 15 分钟', met: 'MET 4.5' },
      ],
    },
    sport: {
      key: 'sport',
      name: '球类 / 骑行 / 游泳 / 跳绳',
      subtitle: '全身综合运动 · 按专项 MET 与去除通勤水分核验',
      metRange: 'MET 6.0 – 11.0',
      icon: 'flame',
      tone: 'diet',
      logicBadge: '专项 MET 矩阵',
      ruleFormula: '跳绳 ≥ 10 分钟(800次) · 游泳 ≥ 15 分钟 · 骑行 ≥ 25 分钟且 ≥ 6km',
      minMinutes: 20,
      minDistanceKm: 6.0,
      antiCheatNote:
        '针对骑行专门设置 ≥ 6.0 公里门槛，精准过滤“骑共享单车去地铁站 5 分钟（1 公里）”的日常通勤水分。',
      scienceBasis:
        '跳绳（MET 10.5）与游泳（MET 8.0）全身肌群参与度极高，按等效千卡消耗折算专属最短有效时长。',
      subTypes: [
        { label: '燃脂跳绳', threshold: '≥ 10 分钟 或 ≥ 800 次', met: 'MET 10.5' },
        { label: '泳池游泳', threshold: '≥ 15 分钟 或 ≥ 400 米', met: 'MET 8.0' },
        { label: '户外有氧骑行', threshold: '≥ 25 分钟 且 ≥ 6.0 km', met: 'MET 6.5' },
        { label: '羽毛球 / 篮球 / 网球', threshold: '有效运动 ≥ 25 分钟', met: 'MET 7.0' },
      ],
    },
  }

// ============================================================================
// Section 01：运动品类分级有效阈值矩阵（ExerciseThresholdMatrix）
// ============================================================================

export function ExerciseThresholdMatrix() {
  const [strictness, setStrictness] = useState<'standard' | 'strict' | 'custom'>('standard')

  return (
    <div className="flex flex-col gap-4">
      {/* 顶部控制条：展示当前运动目标检验标准切换 */}
      <div className="border-border bg-surface flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3">
        <div className="flex items-center gap-2">
          <IconTile icon="exercise" tone="exercise" size="sm" />
          <div>
            <p className="text-caption font-bold">Agent 运动有效性分级阈值基线（支持用户覆盖）</p>
            <p className="text-tiny text-muted">
              不同运动品类的代谢当量（MET）差异巨大，不能用单一时长一刀切
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'standard', label: '标准科学基线（默认）' },
            { id: 'strict', label: '减脂冲刺强化档（+20%）' },
            { id: 'custom', label: '新手恢复温和档（自定义）' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setStrictness(mode.id as typeof strictness)}
              className={cn(
                'text-tiny rounded-full px-3 py-1 font-semibold transition-all',
                strictness === mode.id
                  ? 'bg-exercise-soft text-exercise-ink shadow-soft font-bold'
                  : 'bg-surface-sunken text-muted hover:text-foreground',
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* 每行 2 卡（md:grid-cols-2）展示 4 大品类分级有效阈值 */}
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.values(EXERCISE_THRESHOLD_SPECS) as ExerciseCategoryThresholdSpec[]).map(
          (spec) => {
            const minMinAdjusted =
              strictness === 'strict'
                ? Math.round(spec.minMinutes * 1.2)
                : strictness === 'custom'
                  ? Math.max(10, spec.minMinutes - 5)
                  : spec.minMinutes

            return (
              <Card
                key={spec.key}
                data-ann={`playbook.modules.exercise.threshold.${spec.key}`}
                className="flex min-w-0 flex-col justify-between gap-3.5"
              >
                <div className="flex flex-col gap-3">
                  {/* 卡片头部 */}
                  <div className="border-border flex items-start justify-between gap-2 border-b pb-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <IconTile icon={spec.icon} tone={spec.tone} size="md" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-subhead truncate font-bold">{spec.name}</h3>
                          <Badge tone={spec.tone}>{spec.metRange}</Badge>
                        </div>
                        <p className="text-tiny text-muted mt-0.5 truncate">{spec.subtitle}</p>
                      </div>
                    </div>
                    <Badge tone="neutral">{spec.logicBadge}</Badge>
                  </div>

                  {/* 核心判定公式横幅 */}
                  <div className="bg-surface-sunken/80 border-border flex flex-col gap-1 rounded-2xl border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-tiny text-muted font-bold">最低有效打卡门槛</span>
                      <span className="font-display text-tiny text-exercise-ink font-bold">
                        当前要求：≥ {minMinAdjusted} 分钟
                        {spec.minDistanceKm ? ` · ${spec.minDistanceKm} km` : ''}
                      </span>
                    </div>
                    <p className="text-caption text-foreground font-bold">{spec.ruleFormula}</p>
                  </div>

                  {/* 子项分级列表 */}
                  <div className="border-border divide-border bg-surface divide-y rounded-xl border px-3">
                    {spec.subTypes.map((sub) => (
                      <div
                        key={sub.label}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <span className="text-tiny font-semibold">{sub.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-tiny text-exercise-ink bg-exercise-soft rounded-full px-2 py-0.5 font-semibold">
                            {sub.threshold}
                          </span>
                          <span className="text-tiny text-muted font-mono">{sub.met}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 防糊弄拦截说明 */}
                <div className="bg-warning-soft/65 text-warning-ink flex items-start gap-2 rounded-xl p-2.5">
                  <Icon name="shield" size={15} className="mt-0.5 shrink-0" />
                  <p className="text-tiny leading-relaxed">
                    <strong>防伪运动拦截：</strong>
                    {spec.antiCheatNote}
                  </p>
                </div>
              </Card>
            )
          },
        )}
      </div>

      {/* 目标周期检验标准配置卡（运动板块实例） */}
      <GoalVerificationRuleCard
        module="exercise"
        annPrefix="playbook.modules.exercise.goal-rule-card"
      />
    </div>
  )
}

// ============================================================================
// Section 02：运动有效性判决反馈卡对比（ExerciseVerdictCard，每行 2 卡 md:grid-cols-2）
// ============================================================================

export interface ExerciseVerdictScenario {
  id: 'run-valid' | 'walk-invalid' | 'squat-valid' | 'bike-commute-invalid'
  code: 'A' | 'B' | 'C' | 'D'
  categoryKey: ExerciseCategoryKey
  categoryName: string
  title: string
  subtitle: string
  passed: boolean
  minutes: number
  requiredMinutes: number
  distanceKm?: number
  requiredDistanceKm?: number
  setsRepsText?: string
  requiredSetsRepsText?: string
  paceOrSpeed: string
  kcal: number
  heartRateBpm: number
  intensity: Intensity
  verdictBadge: string
  tuanBanner: string
  tuanExplanation: string
  scannerPreset: SmartSamplePreset
}

export const EXERCISE_VERDICT_SCENARIOS: Record<
  ExerciseVerdictScenario['id'],
  ExerciseVerdictScenario
> = {
  'run-valid': {
    id: 'run-valid',
    code: 'A',
    categoryKey: 'run',
    categoryName: '户外跑步',
    title: '场景 A · 有效运动达标（高 MET 有氧通过）',
    subtitle: '户外跑步 25 分钟 · 4.2 公里 · 配速 5\'57" · 消耗 210 kcal',
    passed: true,
    minutes: 25,
    requiredMinutes: 15,
    distanceKm: 4.2,
    requiredDistanceKm: 2.0,
    paceOrSpeed: '配速 5\'57"/km',
    kcal: 210,
    heartRateBpm: 148,
    intensity: 'moderate',
    verdictBadge: '达到有效有氧阈值 · 可计入有效打卡',
    tuanBanner: '达到有效有氧阈值 · 可计入有效打卡',
    tuanExplanation:
      '太棒啦！跑步时长 25 分钟（超过 15 分钟基线）、里程 4.2 公里（超过 2 公里基线），平均心率 148 bpm 处于黄金燃脂区间，立即盖有效运动章！',
    scannerPreset: {
      id: 'ex-scene-a',
      module: 'exercise',
      goalTitle: '动一动',
      sourceKind: 'image',
      visualTitle: '运动手表截图 · 户外跑步 4.20 km',
      visualLines: [
        '时长 25:00 · 配速 5\'57"/km · 心率 148 bpm',
        '主动消耗：210 kcal（中高强度有氧）',
        'Agent 判决：时长与里程双双远超跑步有效阈值（通过）',
      ],
      scanSteps: [
        '正在读取跑步轨迹图与配速表盘…',
        '对照「跑步」有效阈值（≥15分钟 或 ≥2.0公里）',
        '核验通过：达到有效有氧阈值，允许有效打卡',
      ],
    },
  },
  'walk-invalid': {
    id: 'walk-invalid',
    code: 'B',
    categoryKey: 'walk',
    categoryName: '快走 / 散步',
    title: '场景 B · 伪运动拦截（慢走 10 分钟不予打卡）',
    subtitle: '饭后慢走 10 分钟 · 0.6 公里 · 配速 16\'40" · 消耗 28 kcal',
    passed: false,
    minutes: 10,
    requiredMinutes: 25,
    distanceKm: 0.6,
    requiredDistanceKm: 2.5,
    paceOrSpeed: '配速 16\'40"/km（慢速溜达）',
    kcal: 28,
    heartRateBpm: 94,
    intensity: 'easy',
    verdictBadge: '未达有效运动门槛 · 仅记日常活动备忘',
    tuanBanner:
      '快走需满 20–30 分钟且达 2 公里以上才算有效运动哦，本次仅可记为日常活动备忘，不计入有效打卡',
    tuanExplanation:
      '团团温柔但坚定地拦下啦：10 分钟走 0.6 公里属于饭后溜达散步（心率仅 94 bpm），还没有达到快走燃脂的心肺唤醒门槛。再快走 15 分钟凑够 2.5 公里再来盖章吧！',
    scannerPreset: {
      id: 'ex-scene-b',
      module: 'exercise',
      goalTitle: '动一动',
      sourceKind: 'image',
      visualTitle: '计步截图 · 晚饭后慢走 0.60 km',
      visualLines: [
        '时长 10:00 · 距离 0.60 km · 配速 16\'40"/km',
        '估算消耗：28 kcal（心率 94 bpm）',
        'Agent 判决：未满足快走「≥25分钟 且 ≥2.5km」双门槛（拦截）',
      ],
      scanSteps: [
        '提取步数截图：10 分钟 · 0.6 公里…',
        '对照「快走」有效阈值（≥25分钟 且 ≥2.5公里）',
        '判定未达标：属于日常活动备忘，拦截有效打卡',
      ],
    },
  },
  'squat-valid': {
    id: 'squat-valid',
    code: 'C',
    categoryKey: 'strength',
    categoryName: '力量训练 / 蹲起',
    title: '场景 C · 抗阻容量达标（无里程但组数达标通过）',
    subtitle: '负重深蹲 + 箭步蹲 18 分钟 · 5 组×15 次（共 75 次）· 消耗 135 kcal',
    passed: true,
    minutes: 18,
    requiredMinutes: 15,
    setsRepsText: '5 组 × 15 次（75 次）',
    requiredSetsRepsText: '4 组 × 15 次（60 次）',
    paceOrSpeed: '组间歇 60 秒 · 抗阻达标',
    kcal: 135,
    heartRateBpm: 132,
    intensity: 'hard',
    verdictBadge: '达到抗阻训练容量阈值 · 可计入有效打卡',
    tuanBanner: '达到抗阻训练容量阈值 · 可计入有效打卡',
    tuanExplanation:
      '虽然力量训练没有跑步里程，但你完成了 5 组×15 次深蹲（共 75 次）且净训练满 18 分钟，远超 4 组×15 次抗阻容量基线，算作超扎实的有效运动！',
    scannerPreset: {
      id: 'ex-scene-c',
      module: 'exercise',
      goalTitle: '动一动',
      sourceKind: 'text',
      visualTitle: '训练日志 · 下肢深蹲与核心训练 18 分钟',
      visualLines: [
        '徒手深蹲 3 组×15 次 + 哑铃箭步蹲 2 组×15 次',
        '净抗阻时长：18 分钟 · 消耗约 135 kcal',
        'Agent 判决：抗阻容量 75 次 ≥ 60 次基线（有效通过）',
      ],
      scanSteps: [
        '解析力量训练笔记中的动作组数与次数…',
        '切换至「力量/蹲起」无里程容量核验模型',
        '核验通过：18 分钟 / 5 组×15 次达标，允许有效打卡',
      ],
    },
  },
  'bike-commute-invalid': {
    id: 'bike-commute-invalid',
    code: 'D',
    categoryKey: 'sport',
    categoryName: '户外骑行',
    title: '场景 D · 短途通勤拦截（骑单车 7 分钟去地铁站）',
    subtitle: '共享单车骑行 7 分钟 · 1.2 公里 · 消耗 32 kcal',
    passed: false,
    minutes: 7,
    requiredMinutes: 25,
    distanceKm: 1.2,
    requiredDistanceKm: 6.0,
    paceOrSpeed: '均速 10.2 km/h（通勤代步）',
    kcal: 32,
    heartRateBpm: 98,
    intensity: 'easy',
    verdictBadge: '短途通勤代步 · 未达有氧骑行门槛',
    tuanBanner: '户外有氧骑行需满 25 分钟且 ≥ 6.0 公里才算有效运动哦，短途代步仅作日常备忘',
    tuanExplanation:
      '骑共享单车去地铁站 7 分钟（1.2 公里）很环保，但运动量和时长还不够有氧骑行门槛（25 分钟 + 6 公里），不能算作完成了今天的运动目标哦～',
    scannerPreset: {
      id: 'ex-scene-d',
      module: 'exercise',
      goalTitle: '动一动',
      sourceKind: 'image',
      visualTitle: '单车行程单 · 地铁接驳骑行 1.2 km',
      visualLines: [
        '骑行时长 07:12 · 里程 1.2 km',
        '估算消耗：32 kcal（轻松代步）',
        'Agent 判决：低于骑行「≥25分钟 且 ≥6.0km」门槛（拦截）',
      ],
      scanSteps: [
        '识别单车行程记录：7 分钟 · 1.2 公里…',
        '对照「有氧骑行」阈值（过滤短途通勤代步）',
        '判定未达标：属于日常通勤，不计入有效运动打卡',
      ],
    },
  },
}

export interface ExerciseVerdictCardProps {
  scenario: ExerciseVerdictScenario
  compact?: boolean
  ann?: string
}

export function ExerciseVerdictCard({ scenario, compact = false, ann }: ExerciseVerdictCardProps) {
  const passed = scenario.passed
  const tone: Tone = passed ? 'exercise' : 'warning'
  const minRatio = Math.min(100, Math.round((scenario.minutes / scenario.requiredMinutes) * 100))
  const distRatio =
    scenario.distanceKm !== undefined && scenario.requiredDistanceKm
      ? Math.min(100, Math.round((scenario.distanceKm / scenario.requiredDistanceKm) * 100))
      : 100

  return (
    <Card
      data-ann={ann ?? `playbook.modules.exercise.verdict.${scenario.id}`}
      className={cn('flex min-w-0 flex-col gap-3.5', compact && 'p-3.5')}
    >
      {/* 顶部标题与结论徽章 */}
      <div className="border-border flex flex-wrap items-start justify-between gap-2 border-b pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={passed ? 'success' : 'danger'} dot>
              {scenario.verdictBadge}
            </Badge>
            <Badge tone="exercise">{scenario.categoryName}</Badge>
          </div>
          <h3 className="text-subhead mt-1.5 font-bold">{scenario.title}</h3>
          <p className="text-tiny text-muted mt-0.5">{scenario.subtitle}</p>
        </div>

        <ProgressRing
          value={passed ? 100 : Math.round((minRatio + distRatio) / 2)}
          max={100}
          tone={passed ? 'exercise' : 'warning'}
          size={60}
          thickness={6}
          label={`${scenario.title} 达标度`}
        >
          <span
            className={cn('text-tiny font-bold', passed ? 'text-exercise-ink' : 'text-warning-ink')}
          >
            {passed ? '达标' : '拦截'}
          </span>
        </ProgressRing>
      </div>

      {/* 双维阈值核验进度条（时长 + 里程/容量） */}
      <div className="bg-surface-sunken/70 border-border grid gap-2.5 rounded-2xl border p-3">
        {/* 维度 1：时长 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-tiny font-bold">
              1. 有效持续时长核验（门槛 ≥ {scenario.requiredMinutes} 分钟）
            </span>
            <span
              className={cn(
                'font-display text-tiny font-bold tabular-nums',
                scenario.minutes >= scenario.requiredMinutes
                  ? 'text-success-ink'
                  : 'text-danger-ink',
              )}
            >
              实测 {scenario.minutes} 分钟{' '}
              {scenario.minutes >= scenario.requiredMinutes ? '✓' : '✕'}
            </span>
          </div>
          <ProgressBar
            value={scenario.minutes}
            max={scenario.requiredMinutes}
            tone={scenario.minutes >= scenario.requiredMinutes ? 'exercise' : 'danger'}
            size="sm"
            label="运动时长达标度"
          />
        </div>

        {/* 维度 2：里程 或 动作组数容量 */}
        {scenario.distanceKm !== undefined && scenario.requiredDistanceKm !== undefined ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-tiny font-bold">
                2. 有效运动距离核验（门槛 ≥ {scenario.requiredDistanceKm.toFixed(1)} 公里）
              </span>
              <span
                className={cn(
                  'font-display text-tiny font-bold tabular-nums',
                  scenario.distanceKm >= scenario.requiredDistanceKm
                    ? 'text-success-ink'
                    : 'text-danger-ink',
                )}
              >
                实测 {scenario.distanceKm.toFixed(1)} 公里{' '}
                {scenario.distanceKm >= scenario.requiredDistanceKm ? '✓' : '✕'}
              </span>
            </div>
            <ProgressBar
              value={scenario.distanceKm}
              max={scenario.requiredDistanceKm}
              tone={scenario.distanceKm >= scenario.requiredDistanceKm ? 'exercise' : 'danger'}
              size="sm"
              label="运动距离达标度"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-tiny font-bold">
              2. 抗阻动作容量核验（门槛 ≥ {scenario.requiredSetsRepsText}）
            </span>
            <span className="font-display text-tiny text-success-ink font-bold">
              实测 {scenario.setsRepsText} ✓
            </span>
          </div>
        )}

        {/* 运动生理指标摘要行 */}
        <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t pt-2">
          <span className="text-tiny text-muted">{scenario.paceOrSpeed}</span>
          <div className="flex items-center gap-1.5">
            <span className="bg-surface text-muted text-tiny rounded-full px-2 py-0.5 font-mono">
              心率 {scenario.heartRateBpm} bpm
            </span>
            <span
              className={cn(
                'font-display text-tiny rounded-full px-2.5 py-0.5 font-semibold tabular-nums',
                softToneClass[tone],
              )}
            >
              {scenario.kcal} kcal
            </span>
          </div>
        </div>
      </div>

      {/* 团团举牌 / 温柔拦截反馈区 */}
      <div
        className={cn(
          'flex items-start gap-3 rounded-2xl border p-3',
          passed
            ? 'bg-exercise-soft/65 border-exercise/40 text-exercise-ink'
            : 'bg-warning-soft/75 border-warning/40 text-warning-ink',
        )}
      >
        <Mascot mood={passed ? 'cheer' : 'thinking'} size={48} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-bold">
            {passed ? '🎉 团团举牌放行：' : '🛑 团团温柔拦截：'}
            {scenario.tuanBanner}
          </p>
          {!compact && (
            <p className="text-tiny text-foreground/85 mt-1 leading-relaxed">
              {scenario.tuanExplanation}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

export function ExerciseVerdictComparisonMatrix() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ExerciseVerdictCard
        scenario={EXERCISE_VERDICT_SCENARIOS['run-valid']}
        ann="playbook.modules.exercise.verdict-a-pass"
      />
      <ExerciseVerdictCard
        scenario={EXERCISE_VERDICT_SCENARIOS['walk-invalid']}
        ann="playbook.modules.exercise.verdict-b-intercept"
      />
      <ExerciseVerdictCard
        scenario={EXERCISE_VERDICT_SCENARIOS['squat-valid']}
        ann="playbook.modules.exercise.verdict-c-squat"
      />
      <ExerciseVerdictCard
        scenario={EXERCISE_VERDICT_SCENARIOS['bike-commute-invalid']}
        ann="playbook.modules.exercise.verdict-d-bike"
      />
    </div>
  )
}

// ============================================================================
// Section 03：运动板块完整页面沙盒（<PhoneFrame> 手机框 + 右侧样本与实时阈值测试控制台）
// ============================================================================

export function ExerciseFullPageSandbox() {
  const [scenarioId, setScenarioId] = useState<ExerciseVerdictScenario['id']>('run-valid')
  const [inputMode, setInputMode] = useState<CheckinInputMode>('smart-capture')
  const [scanPhase, setScanPhase] = useState<ScanPhase>('done')

  // 支持在手机框内实时修改品类、时长、公里数，动态计算是否达到有效运动门槛！
  const [categoryKey, setCategoryKey] = useState<ExerciseCategoryKey>('run')
  const [minutes, setMinutes] = useState<number | null>(25)
  const [distanceKm, setDistanceKm] = useState<number | null>(4.2)
  const [setsCount, setSetsCount] = useState<number | null>(5)
  const [intensity, setIntensity] = useState<Intensity>('moderate')
  const [stamped, setStamped] = useState(false)

  const baseScenario = EXERCISE_VERDICT_SCENARIOS[scenarioId]

  function applyScenario(id: ExerciseVerdictScenario['id']) {
    const next = EXERCISE_VERDICT_SCENARIOS[id]
    setScenarioId(id)
    setCategoryKey(next.categoryKey)
    setMinutes(next.minutes)
    setDistanceKm(next.distanceKm ?? 0)
    setSetsCount(5)
    setIntensity(next.intensity)
    setStamped(false)
  }

  // 根据当前表单的运动品类 + 时长 + 距离/组数，实时执行 Agent 运动有效性判定
  const curMin = minutes ?? 0
  const curDist = distanceKm ?? 0
  const curSets = setsCount ?? 0

  let isEffective = false
  let reqMin = 25
  let reqDist = 2.5
  let dynamicBanner = ''

  if (categoryKey === 'walk') {
    reqMin = 25
    reqDist = 2.5
    isEffective = curMin >= reqMin && curDist >= reqDist
    dynamicBanner = isEffective
      ? '快走时长与里程双双达标 · 可计入有效打卡'
      : '快走需满 25 分钟且达 2.5 公里以上才算有效运动哦，本次仅可记为日常活动备忘，不计入有效打卡'
  } else if (categoryKey === 'run') {
    reqMin = 15
    reqDist = 2.0
    isEffective = curMin >= reqMin || curDist >= reqDist
    dynamicBanner = isEffective
      ? '达到跑步有效有氧阈值（≥15分钟 或 ≥2.0公里）· 可计入有效打卡'
      : '跑步需满 15 分钟或达 2.0 公里才算有效有氧哦，再跑几步就能激活有效打卡啦'
  } else if (categoryKey === 'strength') {
    reqMin = 15
    isEffective = curMin >= reqMin || curSets >= 4
    dynamicBanner = isEffective
      ? `达到抗阻力量阈值（${curMin}分钟 / ${curSets}组×15次）· 可计入有效打卡`
      : '力量训练需满 15 分钟或完成 4 组×15 次标准动作才算有效运动哦'
  } else {
    reqMin = 25
    reqDist = 6.0
    isEffective = curMin >= reqMin && curDist >= reqDist
    dynamicBanner = isEffective
      ? '达到有氧骑行/球类有效阈值 · 可计入有效打卡'
      : '户外骑行需满 25 分钟且 ≥ 6.0 公里（过滤短途通勤代步）才算有效运动哦'
  }

  const liveKcal = Math.round(
    curMin * (categoryKey === 'run' ? 8.4 : categoryKey === 'walk' ? 3.2 : 6.5),
  )

  const liveScenario: ExerciseVerdictScenario = {
    ...baseScenario,
    categoryKey,
    categoryName: EXERCISE_THRESHOLD_SPECS[categoryKey].name,
    title: isEffective ? '实时核验：达到有效运动门槛' : '实时核验：尚未达到有效运动门槛',
    subtitle:
      categoryKey === 'strength'
        ? `${EXERCISE_THRESHOLD_SPECS[categoryKey].name} ${curMin} 分钟 · ${curSets} 组×15 次 · 约 ${liveKcal} kcal`
        : `${EXERCISE_THRESHOLD_SPECS[categoryKey].name} ${curMin} 分钟 · ${curDist.toFixed(1)} 公里 · 约 ${liveKcal} kcal`,
    passed: isEffective,
    minutes: curMin,
    requiredMinutes: reqMin,
    distanceKm: categoryKey === 'strength' ? undefined : curDist,
    requiredDistanceKm: categoryKey === 'strength' ? undefined : reqDist,
    setsRepsText: categoryKey === 'strength' ? `${curSets} 组 × 15 次` : undefined,
    requiredSetsRepsText: categoryKey === 'strength' ? '4 组 × 15 次' : undefined,
    kcal: liveKcal,
    verdictBadge: isEffective ? '达到有效运动阈值 · 允许打卡' : '未达有效门槛 · 拦截伪运动',
    tuanBanner: dynamicBanner,
  }

  return (
    <div
      data-ann="playbook.modules.exercise.sandbox"
      className="grid items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)]"
    >
      {/* 左侧：360px 手机外框完整「动一动」打卡页 */}
      <div className="flex justify-center">
        <PhoneFrame
          label="手机 · /goals/exercise/checkin（动一动完整打卡页）"
          className="h-[780px]"
        >
          <div className="flex h-full flex-col overflow-hidden">
            <TopBar
              sticky={false}
              title="动一动"
              leading={<IconButton icon="chevron-left" label="返回" className="-ml-2" />}
              actions={<Badge tone="exercise">运动裁判</Badge>}
              className="shrink-0 pt-10"
            />

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 pt-2 pb-6">
              {/* 顶部目标检验规则提示条 + 全板块统一三态 Tab */}
              <Card className="flex flex-col gap-2.5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <IconTile icon="exercise" tone="exercise" size="sm" />
                    <div className="min-w-0">
                      <p className="text-caption truncate font-bold">21 天有效有氧与核心唤醒</p>
                      <p className="text-tiny text-muted truncate">
                        快走≥25分+2.5km | 跑步≥15分/2km | 力量≥15分
                      </p>
                    </div>
                  </div>
                  <Badge tone="exercise">12/21天</Badge>
                </div>
                <CheckinModeTabs
                  value={inputMode}
                  onValueChange={(next) => {
                    setInputMode(next)
                    setStamped(false)
                  }}
                />
              </Card>

              {/* 智能拍照 / 上传模式下显示极简扫描镜 */}
              {inputMode !== 'manual' && (
                <SmartScannerLens
                  preset={baseScenario.scannerPreset}
                  phase={scanPhase}
                  tone="exercise"
                  onRescan={() =>
                    setScanPhase((prev) => (prev === 'scanning' ? 'done' : 'scanning'))
                  }
                />
              )}

              {/* 运动表单（全单列垂直排布，NumberField 独占一行，0 横向溢出） */}
              <Card className="flex flex-col gap-3 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption font-bold">运动记录表单（实时联动下方判决）</span>
                  <span className="font-display text-tiny text-exercise-ink font-semibold">
                    约 {liveKcal} kcal
                  </span>
                </div>

                {/* 品类四选一胶囊 */}
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { key: 'run', label: '跑步 (≥15m/2km)' },
                      { key: 'walk', label: '快走 (≥25m且2.5km)' },
                      { key: 'strength', label: '力量/蹲起 (≥15m/4组)' },
                      { key: 'sport', label: '骑行/球类 (≥25m且6km)' },
                    ] as const
                  ).map((item) => {
                    const active = categoryKey === item.key
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setCategoryKey(item.key)
                          setStamped(false)
                        }}
                        className={cn(
                          'text-tiny flex h-9 items-center justify-center rounded-xl border px-2 font-semibold transition-all',
                          active
                            ? 'bg-exercise-soft text-exercise-ink border-exercise font-bold'
                            : 'bg-surface-sunken/60 border-border text-muted hover:text-foreground',
                        )}
                      >
                        <span className="truncate">{item.label}</span>
                      </button>
                    )
                  })}
                </div>

                <Field
                  label="运动持续时长"
                  htmlFor="sandbox-ex-minutes"
                  aside={`当前品类门槛 ≥ ${reqMin} 分钟`}
                >
                  <NumberField
                    id="sandbox-ex-minutes"
                    value={minutes}
                    onValueChange={(v) => {
                      setMinutes(v)
                      setStamped(false)
                    }}
                    min={1}
                    max={300}
                    step={5}
                    unit="分钟"
                  />
                </Field>

                {categoryKey === 'strength' ? (
                  <Field
                    label="完成标准动作组数（每组 15 次）"
                    htmlFor="sandbox-ex-sets"
                    aside="门槛 ≥ 4 组"
                  >
                    <NumberField
                      id="sandbox-ex-sets"
                      value={setsCount}
                      onValueChange={(v) => {
                        setSetsCount(v)
                        setStamped(false)
                      }}
                      min={1}
                      max={20}
                      step={1}
                      unit="组"
                    />
                  </Field>
                ) : (
                  <Field
                    label="运动距离 / 里程"
                    htmlFor="sandbox-ex-dist"
                    aside={`当前品类门槛 ≥ ${reqDist.toFixed(1)} 公里`}
                  >
                    <NumberField
                      id="sandbox-ex-dist"
                      value={distanceKm}
                      onValueChange={(v) => {
                        setDistanceKm(v)
                        setStamped(false)
                      }}
                      min={0}
                      max={100}
                      step={0.5}
                      unit="公里"
                    />
                  </Field>
                )}

                <div className="flex flex-col gap-1.5">
                  <span className="text-caption font-semibold">体感强度</span>
                  <SegmentedControl
                    size="sm"
                    label="运动体感强度"
                    value={intensity}
                    onValueChange={setIntensity}
                    options={[
                      { value: 'easy', label: '轻松溜达' },
                      { value: 'moderate', label: '微汗有氧' },
                      { value: 'hard', label: '酣畅燃脂' },
                    ]}
                  />
                </div>
              </Card>

              {/* Agent 有效性实时判决卡 */}
              <ExerciseVerdictCard
                scenario={liveScenario}
                compact
                ann="playbook.modules.exercise.sandbox.verdict"
              />

              {/* 底部动态提交按钮 */}
              <Card className="flex flex-col gap-2.5 p-3.5">
                {stamped ? (
                  <div className="flex flex-col items-center gap-2 py-3 text-center">
                    <div className="relative">
                      <Mascot mood="cheer" size={76} />
                      <Stamp
                        caption="有效运动"
                        tone="exercise"
                        animate
                        size={56}
                        className="absolute -top-2 -right-9"
                      />
                    </div>
                    <p className="text-caption font-bold">
                      已盖章！{liveScenario.categoryName} {curMin} 分钟计入今日有效打卡
                    </p>
                    <Button size="sm" variant="soft" onClick={() => setStamped(false)}>
                      继续调试阈值
                    </Button>
                  </div>
                ) : isEffective ? (
                  <>
                    <Button
                      variant="primary"
                      icon="check"
                      className="w-full"
                      onClick={() => {
                        setStamped(true)
                        toast.success(
                          `有效运动打卡成功！${liveScenario.categoryName} ${curMin} 分钟已盖章`,
                        )
                      }}
                    >
                      确认有效打卡（{liveKcal} kcal）
                    </Button>
                    <p className="text-tiny text-muted text-center">
                      已达到 {liveScenario.categoryName} 有效阈值，点击立即盖章并计入连击
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
                          '已仅作为「日常活动备忘」保存，未计入今日有效运动打卡。再动一会儿就能达标啦！',
                        )
                      }
                    >
                      未达有效运动门槛 · 再动一会儿吧
                    </Button>
                    <p className="text-tiny text-warning-ink text-center font-semibold">
                      当前数值未达 {liveScenario.categoryName}{' '}
                      有效线，仅可记为日常活动备忘，不触发有效打卡章
                    </p>
                  </>
                )}
              </Card>
            </div>
          </div>
        </PhoneFrame>
      </div>

      {/* 右侧：样本控制台与实时阈值调试指南 */}
      <div className="flex min-w-0 flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-subhead font-bold">
              切换运动样本（测试有效达标 vs 伪运动拦截）
            </span>
            <Badge tone="exercise" icon="sparkles">
              实时阈值沙盒
            </Badge>
          </div>
          <p className="text-caption text-muted">
            点击下方 4 个预设样本，或者直接在左侧手机框内增减「时长」「公里数」步进按钮，观察下方的
            **Agent 有效性判决卡** 与 **底部主按钮** 如何实时响应：
          </p>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {(Object.values(EXERCISE_VERDICT_SCENARIOS) as ExerciseVerdictScenario[]).map(
              (item) => {
                const active = item.id === scenarioId
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => applyScenario(item.id)}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all active:scale-[0.98]',
                      active
                        ? 'border-exercise bg-exercise-soft/45 shadow-soft'
                        : 'border-border bg-surface-sunken/60 hover:bg-surface-sunken',
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-caption font-bold">
                        场景 {item.code} · {item.categoryName}
                      </span>
                      <Badge tone={item.passed ? 'success' : 'warning'}>
                        {item.passed ? '有效达标' : '拦截不打卡'}
                      </Badge>
                    </div>
                    <p className="text-tiny text-muted line-clamp-2">{item.subtitle}</p>
                  </button>
                )
              },
            )}
          </div>

          <div className="border-border bg-surface-sunken/70 flex flex-col gap-2 rounded-2xl border p-3.5">
            <span className="text-tiny text-muted font-bold">
              动手试试：一键把「场景 B 慢走 10 分钟」补足到快走有效线
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="soft"
                icon="footprints"
                onClick={() => {
                  setScenarioId('walk-invalid')
                  setCategoryKey('walk')
                  setMinutes(30)
                  setDistanceKm(2.8)
                  setIntensity('moderate')
                  setStamped(false)
                  toast.success('已将快走补足至 30 分钟 · 2.8 公里，已自动解锁有效打卡！')
                }}
              >
                模拟继续快走至 30 分钟 / 2.8 km（解锁打卡）
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon="exercise"
                onClick={() => applyScenario('walk-invalid')}
              >
                重置为慢走 10 分钟 / 0.6 km（触发拦截）
              </Button>
            </div>
          </div>
        </Card>

        <Card variant="sunken" className="flex flex-col gap-2.5">
          <h4 className="text-caption font-bold">为什么运动板块要按品类分级拦截「伪运动」？</h4>
          <ul className="text-tiny text-muted space-y-1.5 leading-relaxed">
            <li className="flex items-start gap-2">
              <Icon name="check" size={14} className="text-success mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">快走与散步严格区分</strong>：下楼散步 10
                分钟（0.6 公里）心率不升、未能动员有氧供能，因此快走必须同时满足 `≥ 20–30 分钟`
                **且** `≥ 2.0–3.0 公里` 才算有效运动打卡。
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Icon name="check" size={14} className="text-success mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">跑步高 MET 合理优待</strong>：跑步代谢当量（MET
                ≈ 8.0）高、心肺刺激强，只要跑满 `10–15 分钟` **或** 满 `2.0 公里`
                即认定为高质量有效有氧，不拿快走的 30 分钟死卡跑步新手。
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Icon name="check" size={14} className="text-success mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground">无氧抗阻看组数容量、骑行过滤短途通勤</strong>
                ：蹲起与力量训练按净时长（`≥ 15 分钟`）或动作容量（`4 组×15 次`）核验；骑行要求 `≥
                25 分钟且 ≥ 6 公里`，防止把骑共享单车去地铁站当成健身打卡。
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
