'use client'

import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/top-bar'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Button, IconButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { Icon } from '@/components/ui/icon'
import { ProgressBar } from '@/components/ui/progress'
import { Rating, type RatingValue } from '@/components/ui/rating'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Stamp } from '@/components/ui/stamp'
import { formatSpanMinutes, TimeRangeField, timeRangeSpan } from '@/components/ui/time-range-field'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { PhoneFrame } from '../../../_components/device-frame'
import {
  CheckinModeTabs,
  SmartScannerLens,
  type CheckinInputMode,
  type ScanPhase,
  type SmartSamplePreset,
} from '../../../_components/smart-recognition-demos'

// ============================================================================
// 睡眠双门槛科学裁判纯函数：
// 门槛 1：入睡时刻不晚于设定红线（如 23:30，允许 18:00 至红线之间入睡；00:00–12:00 均属跨零点熬夜）
// 门槛 2：有效睡眠时长在 6.5 小时（390 分钟）至 9.5 小时（570 分钟）之间
// ============================================================================

export type CurfewOption = '22:30' | '23:00' | '23:30'

const MIN_VALID_SLEEP_MINUTES = 390 // 6.5 小时
const MAX_VALID_SLEEP_MINUTES = 570 // 9.5 小时

/**
 * 将入睡时刻归一化到「傍晚 18:00 起算的分钟轴」以便比较是否超过熬夜红线：
 * 例如 22:30 -> 270，23:30 -> 330，00:15 -> 375，02:15 -> 495
 */
function normalizeBedtimeAxis(hhmm: string): number | null {
  const parts = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
  if (!parts) return null
  const rawMinutes = Number(parts[1]) * 60 + Number(parts[2])
  // 18:00 (1080) 之后算当天傍晚/夜间；18:00 之前算次日凌晨/白昼
  return rawMinutes >= 18 * 60 ? rawMinutes - 18 * 60 : rawMinutes + 6 * 60
}

export interface SleepRefereeEvaluation {
  bedtimePassed: boolean
  durationPassed: boolean
  isValidCheckin: boolean
  lateByMinutes: number
  durationMinutes: number
  verdictTitle: string
  verdictDetail: string
}

export function evaluateSleepCheckin(
  bed: string,
  wake: string,
  curfew: CurfewOption = '23:30',
): SleepRefereeEvaluation {
  const bedAxis = normalizeBedtimeAxis(bed)
  const curfewAxis = normalizeBedtimeAxis(curfew) ?? 330
  const span = timeRangeSpan(bed, wake)
  const durationMinutes = span?.minutes ?? 0

  const lateByMinutes = bedAxis !== null ? Math.max(0, bedAxis - curfewAxis) : 0
  const bedtimePassed = bedAxis !== null && bedAxis <= curfewAxis
  const durationPassed =
    durationMinutes >= MIN_VALID_SLEEP_MINUTES && durationMinutes <= MAX_VALID_SLEEP_MINUTES
  const isValidCheckin = bedtimePassed && durationPassed

  if (isValidCheckin) {
    return {
      bedtimePassed,
      durationPassed,
      isValidCheckin: true,
      lateByMinutes: 0,
      durationMinutes,
      verdictTitle: '双门槛达标 · 有效早睡打卡',
      verdictDetail: `入睡时刻 ${bed} 早于 ${curfew} 红线，总时长 ${formatSpanMinutes(durationMinutes)} 位于黄金修复区间，计入早点睡有效连击！`,
    }
  }

  if (!bedtimePassed && durationPassed) {
    return {
      bedtimePassed: false,
      durationPassed: true,
      isValidCheckin: false,
      lateByMinutes,
      durationMinutes,
      verdictTitle: '熬夜补觉拦截 · 仅存档不盖章',
      verdictDetail: `虽然睡够了 ${formatSpanMinutes(durationMinutes)}，但凌晨/深夜 ${bed} 才睡（晚于 ${curfew} 红线 ${formatSpanMinutes(lateByMinutes)}）属于熬夜补觉哦，仅记录睡眠数据，不计入早点睡有效打卡。`,
    }
  }

  if (bedtimePassed && !durationPassed) {
    const reason =
      durationMinutes < MIN_VALID_SLEEP_MINUTES
        ? `睡眠时长仅 ${formatSpanMinutes(durationMinutes)}（不足 6.5 小时最低修复门槛）`
        : `睡眠时长达 ${formatSpanMinutes(durationMinutes)}（超过 9.5 小时，过度赖床易引发节律惰性）`
    return {
      bedtimePassed: true,
      durationPassed: false,
      isValidCheckin: false,
      lateByMinutes: 0,
      durationMinutes,
      verdictTitle: '时长未在有效区间 · 仅存档不盖章',
      verdictDetail: `你在 ${bed} 按时入睡很棒！但${reason}，本次仅归档睡眠记录，不计有效打卡。`,
    }
  }

  return {
    bedtimePassed: false,
    durationPassed: false,
    isValidCheckin: false,
    lateByMinutes,
    durationMinutes,
    verdictTitle: '入睡过晚且时长异常 · 仅记录数据',
    verdictDetail: `入睡时刻 ${bed} 晚于 ${curfew} 红线，且时长 ${formatSpanMinutes(durationMinutes)} 未达 6.5–9.5 小时区间，已为你诚实归档睡眠曲线。`,
  }
}

// ============================================================================
// Section 01 组件：睡眠双门槛科学裁判规则演示（入睡红线 + 有效时长）
// ============================================================================

export function SleepDualThresholdRulesDemo() {
  const [curfew, setCurfew] = useState<CurfewOption>('23:30')

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 左卡：双门槛配置与科学依据 */}
      <Card
        data-ann="playbook.modules.sleep.threshold.config"
        className="flex min-w-0 flex-col justify-between gap-4"
      >
        <div className="flex flex-col gap-3">
          <div className="border-border flex items-start justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <IconTile icon="sleep" tone="sleep" size="md" />
              <div className="min-w-0">
                <h3 className="text-subhead truncate font-bold">双门槛同时满足 = 有效早睡卡</h3>
                <p className="text-tiny text-muted truncate">
                  防止「凌晨 2:30 睡、10:30 起」用睡眠时长混充早睡
                </p>
              </div>
            </div>
            <Badge tone="sleep" icon="shield">
              节律裁判
            </Badge>
          </div>

          {/* 门槛 1：入睡时刻红线切换 */}
          <div className="bg-surface-sunken flex flex-col gap-2 rounded-2xl p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption font-bold">门槛 01 · 入睡时刻红线（Curfew）</span>
              <Badge tone="sleep">核心红线</Badge>
            </div>
            <p className="text-tiny text-muted leading-relaxed">
              褪黑素在 22:00–23:30 进入分泌高峰，慢波深睡主要集中在前半夜。必须在设定红线前入睡：
            </p>
            <SegmentedControl
              size="sm"
              label="入睡红线时刻"
              value={curfew}
              onValueChange={setCurfew}
              options={[
                { value: '22:30', label: '22:30 严苛' },
                { value: '23:00', label: '23:00 标准' },
                { value: '23:30', label: '23:30 温和' },
              ]}
            />
          </div>

          {/* 门槛 2：有效睡眠时长走廊 */}
          <div className="bg-surface-sunken flex flex-col gap-2 rounded-2xl p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption font-bold">门槛 02 · 有效睡眠时长区间</span>
              <span className="font-display text-sleep-ink bg-sleep-soft text-tiny rounded-full px-2.5 py-0.5 font-bold tabular-nums">
                6.5h – 9.5h
              </span>
            </div>
            <p className="text-tiny text-muted leading-relaxed">
              成人完整经历 4–5 个 90 分钟睡眠周期需 6.5–9.5 小时。少于 6.5 小时修复不足，多于 9.5
              小时易导致昼夜节律迟滞。
            </p>
            <div className="bg-surface border-border flex items-center justify-between rounded-xl border px-3 py-2">
              <span className="text-tiny text-muted">判定公式</span>
              <span className="text-tiny text-sleep-ink font-mono font-bold">
                入睡 ≤ {curfew} AND 6.5h ≤ 时长 ≤ 9.5h
              </span>
            </div>
          </div>
        </div>

        <p className="text-tiny text-muted border-border border-t pt-2.5">
          注：估算结果与节律建议仅供日常手账习惯督促，非医疗诊断建议。
        </p>
      </Card>

      {/* 右卡：昼夜节律时间轴可视化对比（为什么熬夜睡满 8 小时不算早睡） */}
      <Card
        data-ann="playbook.modules.sleep.threshold.circadian"
        className="flex min-w-0 flex-col justify-between gap-4"
      >
        <div className="flex flex-col gap-3">
          <div className="border-border flex items-start justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <IconTile icon="clock" tone="warning" size="md" />
              <div className="min-w-0">
                <h3 className="text-subhead truncate font-bold">
                  为什么「02:30 睡 → 10:30 起」不算早点睡？
                </h3>
                <p className="text-tiny text-muted truncate">
                  同样睡满 8 小时，昼夜节律与深睡修复窗口完全不同
                </p>
              </div>
            </div>
            <Badge tone="warning">原理对照</Badge>
          </div>

          {/* 21:00 — 11:00 节律时间轴对比 */}
          <div className="bg-surface-sunken flex flex-col gap-3 rounded-2xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-tiny text-muted font-mono">21:00</span>
              <span className="text-tiny text-sleep-ink bg-sleep-soft rounded-full px-2 py-0.5 font-semibold">
                褪黑素高峰 23:00–02:00
              </span>
              <span className="text-tiny text-muted font-mono">11:00</span>
            </div>

            {/* 轨迹 1：规律早睡 */}
            <div className="bg-surface border-border flex flex-col gap-1.5 rounded-xl border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-caption font-bold">规律早睡：23:15 → 07:10（7h55m）</span>
                <Badge tone="success" dot>
                  有效打卡
                </Badge>
              </div>
              <div className="bg-surface-sunken relative h-3 w-full overflow-hidden rounded-full">
                {/* 23:15 约在 16% 处，长约 56% */}
                <div
                  className="bg-sleep h-full rounded-full"
                  style={{ marginLeft: '16%', width: '56%' }}
                />
              </div>
              <p className="text-tiny text-muted">
                完整覆盖前半夜慢波深睡黄金期，晨起皮质醇自然唤醒，精力充沛。
              </p>
            </div>

            {/* 轨迹 2：熬夜补觉 */}
            <div className="bg-surface border-warning/40 flex flex-col gap-1.5 rounded-xl border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-caption font-bold">熬夜补觉：02:30 → 10:30（8h00m）</span>
                <Badge tone="warning" icon="alert">
                  拦截 · 仅存档
                </Badge>
              </div>
              <div className="bg-surface-sunken relative h-3 w-full overflow-hidden rounded-full">
                {/* 02:30 约在 40% 处，长约 56% */}
                <div
                  className="bg-warning h-full rounded-full"
                  style={{ marginLeft: '40%', width: '56%' }}
                />
              </div>
              <p className="text-tiny text-warning-ink">
                错过前半夜深睡窗口，浅睡与做梦占比偏高，醒来仍易昏沉，不盖「早点睡」印章。
              </p>
            </div>
          </div>

          <div className="bg-sleep-soft/55 text-sleep-ink flex items-start gap-2.5 rounded-xl p-3">
            <Icon name="bulb" size={18} className="mt-0.5 shrink-0" />
            <p className="text-tiny leading-relaxed">
              <strong>温柔双轨制设计：</strong>
              拦截不等于丢弃数据！熬夜补觉的数据依然会诚实记入用户的「睡眠周趋势柱状图」中（标为浅色未达标柱），帮助用户复盘作息，但不会触发早睡连击印章。
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ============================================================================
// Section 02 组件：睡眠裁判反馈卡正反对比（每行 2 卡 md:grid-cols-2）
// ============================================================================

export function SleepRefereeComparisonMatrix() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 场景 A：23:15 入睡 → 07:10 起床 · 有效打卡 */}
      <Card
        data-ann="playbook.modules.sleep.verdict.valid"
        className="flex min-w-0 flex-col justify-between gap-4"
      >
        <div className="flex flex-col gap-3">
          <div className="border-border flex items-center justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2">
              <IconTile icon="sleep" tone="sleep" size="sm" />
              <div className="min-w-0">
                <p className="text-caption truncate font-bold">场景 A · 23:15 入睡 → 07:10 起床</p>
                <p className="text-tiny text-muted truncate">
                  早于 23:30 红线 + 睡满 7h55m + 深睡 24%
                </p>
              </div>
            </div>
            <Badge tone="success" dot>
              有效打卡
            </Badge>
          </div>

          {/* 双门槛核验明细 */}
          <div className="bg-surface-sunken grid gap-2 rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-success-soft text-success-ink text-tiny flex size-5 shrink-0 items-center justify-center rounded-full font-bold">
                  ✓
                </span>
                <span className="text-caption font-semibold">入睡红线核验（≤ 23:30）</span>
              </div>
              <span className="font-display text-success-ink text-caption font-bold tabular-nums">
                23:15（提前 15m）
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-success-soft text-success-ink text-tiny flex size-5 shrink-0 items-center justify-center rounded-full font-bold">
                  ✓
                </span>
                <span className="text-caption font-semibold">有效时长核验（6.5–9.5h）</span>
              </div>
              <span className="font-display text-sleep-ink text-caption font-bold tabular-nums">
                7小时55分 · 深睡 24%
              </span>
            </div>
          </div>

          {/* 团团正向裁判评语 */}
          <div className="bg-sleep-soft/50 border-sleep/30 relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3.5">
            <Mascot mood="cheer" size={56} />
            <div className="min-w-0 flex-1 pr-14">
              <p className="text-caption text-sleep-ink font-bold">
                团团裁判：节律超稳，盖下早睡章！
              </p>
              <p className="text-tiny text-muted mt-1 leading-relaxed">
                11 点一刻就乖乖入睡，总时长 7 小时 55 分且深睡占比 24%，早点睡连击 +1～
              </p>
            </div>
            <Stamp
              text="早点睡"
              caption="23:15"
              tone="sleep"
              size={60}
              className="absolute top-2.5 right-2.5"
            />
          </div>
        </div>

        <div className="border-border flex items-center justify-between border-t pt-2.5">
          <span className="text-tiny text-muted">判定结果：计入今日「早点睡」有效连击</span>
          <Badge tone="sleep" icon="check">
            已盖章
          </Badge>
        </div>
      </Card>

      {/* 场景 B：02:15 入睡 → 10:30 起床 · 熬夜补觉拦截 */}
      <Card
        data-ann="playbook.modules.sleep.verdict.late-intercept"
        className="flex min-w-0 flex-col justify-between gap-4"
      >
        <div className="flex flex-col gap-3">
          <div className="border-border flex items-center justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2">
              <IconTile icon="alert" tone="warning" size="sm" />
              <div className="min-w-0">
                <p className="text-caption truncate font-bold">场景 B · 02:15 入睡 → 10:30 起床</p>
                <p className="text-tiny text-muted truncate">
                  虽睡满 8h15m，但超过 23:30 入睡红线近 3 小时
                </p>
              </div>
            </div>
            <Badge tone="warning" icon="alert">
              熬夜补觉拦截
            </Badge>
          </div>

          {/* 双门槛核验明细 */}
          <div className="bg-surface-sunken grid gap-2 rounded-2xl p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-danger-soft text-danger-ink text-tiny flex size-5 shrink-0 items-center justify-center rounded-full font-bold">
                  ✕
                </span>
                <span className="text-caption font-semibold">入睡红线核验（≤ 23:30）</span>
              </div>
              <span className="font-display text-danger-ink text-caption font-bold tabular-nums">
                02:15（超时 2h45m）
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-success-soft text-success-ink text-tiny flex size-5 shrink-0 items-center justify-center rounded-full font-bold">
                  ✓
                </span>
                <span className="text-caption font-semibold">睡眠总时长（6.5–9.5h）</span>
              </div>
              <span className="font-display text-foreground text-caption font-bold tabular-nums">
                8小时15分（时长达标）
              </span>
            </div>
          </div>

          {/* 团团温和拦截评语 */}
          <div className="bg-warning-soft/55 border-warning/35 flex items-center gap-3 rounded-2xl border p-3.5">
            <Mascot mood="sleepy" size={56} />
            <div className="min-w-0 flex-1">
              <p className="text-caption text-warning-ink font-bold">
                团团裁判：属于熬夜补觉，今日不盖早睡章哦
              </p>
              <p className="text-tiny text-muted mt-1 leading-relaxed">
                「虽然睡够了时长，但凌晨两点半才睡属于熬夜补觉哦，仅记录睡眠数据，不计入早点睡有效打卡。」
              </p>
            </div>
          </div>
        </div>

        <div className="border-border flex items-center justify-between border-t pt-2.5">
          <span className="text-tiny text-muted">判定结果：数据已归档至睡眠趋势，不触发连击</span>
          <Badge tone="neutral" icon="clock">
            仅存档不盖章
          </Badge>
        </div>
      </Card>
    </div>
  )
}

// ============================================================================
// Section 03 组件：睡眠板块完整页面沙盒（PhoneFrame + 右侧场景切换器）
// ============================================================================

type SleepScenarioId = 'valid-early' | 'late-recovery' | 'short-duration'

interface SleepScenarioPreset {
  id: SleepScenarioId
  title: string
  subtitle: string
  badge: string
  badgeTone: 'success' | 'warning' | 'danger'
  bed: string
  wake: string
  quality: RatingValue
  deepHours: string
  note: string
  scannerPreset: SmartSamplePreset
}

const SLEEP_SCENARIOS: Record<SleepScenarioId, SleepScenarioPreset> = {
  'valid-early': {
    id: 'valid-early',
    title: '场景 A · 23:15 早睡达标（有效打卡）',
    subtitle: '23:15 入睡 → 07:10 起床 · 7h55m · 深睡 24%',
    badge: '双门槛通过',
    badgeTone: 'success',
    bed: '23:15',
    wake: '07:10',
    quality: 4,
    deepHours: '1 小时 54 分（24%）',
    note: '11 点前放下手机看纸质书，入睡很快',
    scannerPreset: {
      id: 'sleep-scan-valid',
      module: 'sleep',
      goalTitle: '早点睡',
      sourceKind: 'image',
      visualTitle: '手环睡眠监测 · 7 小时 55 分',
      visualLines: [
        '入睡时刻：23:15 · 起床时刻：07:10',
        '深睡比例：24%（1 小时 54 分）',
        '睡眠节律：早于 23:30 红线入睡',
      ],
      scanSteps: [
        '正在扫描手环睡眠阶段图与起止时间戳…',
        '提取跨午夜时段 23:15 → 次日 07:10（深睡 24%）',
        'AI 节律裁判：早于 23:30 红线，符合早点睡门槛',
      ],
    },
  },
  'late-recovery': {
    id: 'late-recovery',
    title: '场景 B · 02:15 熬夜补觉拦截（仅记录数据）',
    subtitle: '02:15 入睡 → 10:30 起床 · 8h15m · 超红线 2h45m',
    badge: '熬夜补觉拦截',
    badgeTone: 'warning',
    bed: '02:15',
    wake: '10:30',
    quality: 3,
    deepHours: '1 小时 05 分（13%）',
    note: '赶项目到凌晨两点才睡，上午十点半起',
    scannerPreset: {
      id: 'sleep-scan-late',
      module: 'sleep',
      goalTitle: '早点睡',
      sourceKind: 'image',
      visualTitle: '手环睡眠监测 · 8 小时 15 分（晚睡）',
      visualLines: [
        '入睡时刻：02:15 · 起床时刻：10:30',
        '深睡比例：13%（前半夜深睡窗口缺失）',
        '节律预警：入睡晚于 23:30 红线 2 小时 45 分',
      ],
      scanSteps: [
        '正在扫描手环睡眠阶段图与起止时间戳…',
        '提取凌晨时段 02:15 → 10:30（共 8 小时 15 分）',
        'AI 节律裁判：虽睡满 8 小时但属熬夜补觉，转入仅存档模式',
      ],
    },
  },
  'short-duration': {
    id: 'short-duration',
    title: '场景 C · 23:05 按时睡但时长不足（4h25m）',
    subtitle: '23:05 入睡 → 03:30 早醒 · 未满 6.5h 最低门槛',
    badge: '时长不足拦截',
    badgeTone: 'danger',
    bed: '23:05',
    wake: '03:30',
    quality: 2,
    deepHours: '50 分钟',
    note: '半夜醒来后没再睡着，总时长不够',
    scannerPreset: {
      id: 'sleep-scan-short',
      module: 'sleep',
      goalTitle: '早点睡',
      sourceKind: 'image',
      visualTitle: '睡眠记录 · 4 小时 25 分（时长偏短）',
      visualLines: [
        '入睡时刻：23:05 · 醒来时刻：03:30',
        '总睡眠时长：4 小时 25 分（低于 6.5h 门槛）',
        '节律提示：入睡准时，但修复时长不足',
      ],
      scanSteps: [
        '正在解析睡眠监测截图中的起止时刻…',
        '提取时段 23:05 → 次日 03:30（4 小时 25 分）',
        'AI 节律裁判：时长低于 6.5 小时门槛，建议午休补眠并仅作存档',
      ],
    },
  },
}

export function SleepModulePhoneSandbox() {
  const [scenarioId, setScenarioId] = useState<SleepScenarioId>('valid-early')
  const [inputMode, setInputMode] = useState<CheckinInputMode>('smart-capture')
  const [curfew, setCurfew] = useState<CurfewOption>('23:30')
  const [phase, setPhase] = useState<ScanPhase>('done')

  const [bed, setBed] = useState(SLEEP_SCENARIOS['valid-early'].bed)
  const [wake, setWake] = useState(SLEEP_SCENARIOS['valid-early'].wake)
  const [quality, setQuality] = useState<RatingValue | null>(SLEEP_SCENARIOS['valid-early'].quality)
  const [note, setNote] = useState(SLEEP_SCENARIOS['valid-early'].note)
  const [submitResult, setSubmitResult] = useState<'stamped' | 'archived' | null>(null)

  const currentScenario = SLEEP_SCENARIOS[scenarioId]
  const evaluation = evaluateSleepCheckin(bed, wake, curfew)

  function applyScenario(nextId: SleepScenarioId) {
    const preset = SLEEP_SCENARIOS[nextId]
    setScenarioId(nextId)
    setBed(preset.bed)
    setWake(preset.wake)
    setQuality(preset.quality)
    setNote(preset.note)
    setSubmitResult(null)
    if (inputMode !== 'manual') {
      setPhase('scanning')
    }
  }

  useEffect(() => {
    if (phase !== 'scanning') return
    const timer = setTimeout(() => setPhase('done'), 900)
    return () => clearTimeout(timer)
  }, [phase])

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
      {/* 左侧：360px 真实手机外框 */}
      <div className="flex justify-center" data-ann="playbook.modules.sleep.sandbox.phone">
        <PhoneFrame label="手机 · /goals/sleep/checkin（早点睡专页）" className="h-[760px]">
          <div className="flex h-full flex-col overflow-hidden">
            <TopBar
              sticky={false}
              title="早点睡"
              leading={<IconButton icon="chevron-left" label="返回" className="-ml-2" />}
              actions={<Badge tone="sleep">睡眠</Badge>}
              className="shrink-0 pt-10"
            />

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 pt-2 pb-6">
              {/* 1. 顶部目标红线卡片 + 三态输入 Tab */}
              <Card className="flex flex-col gap-2.5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <IconTile icon="sleep" tone="sleep" size="sm" />
                    <div className="min-w-0">
                      <p className="text-caption truncate font-bold">
                        入睡红线：{curfew} 前 · 睡满 6.5–9.5h
                      </p>
                      <p className="text-tiny text-muted truncate">本周已达成 5 / 7 晚规律早睡</p>
                    </div>
                  </div>
                  <span className="font-display text-sleep-ink bg-sleep-soft text-tiny shrink-0 rounded-full px-2 py-0.5 font-bold">
                    5 连击
                  </span>
                </div>
                <ProgressBar value={5} max={7} tone="sleep" size="sm" label="本周早睡进度" />
                <CheckinModeTabs
                  value={inputMode}
                  onValueChange={(next) => {
                    setInputMode(next)
                    setSubmitResult(null)
                    if (next !== 'manual') setPhase('scanning')
                  }}
                />
              </Card>

              {/* 2. 智能拍照/上传模式下挂载扫描镜（直接跳过全局识别方向条） */}
              {inputMode !== 'manual' && (
                <SmartScannerLens
                  preset={currentScenario.scannerPreset}
                  phase={phase}
                  tone="sleep"
                  onRescan={() => setPhase('scanning')}
                />
              )}

              {/* 3. 睡眠表单与 AI 节律裁判反馈卡 */}
              <Card className="flex flex-col gap-3 p-3.5">
                {submitResult ? (
                  <div className="flex flex-col items-center gap-2.5 py-4 text-center">
                    <div className="relative">
                      <Mascot mood={submitResult === 'stamped' ? 'cheer' : 'sleepy'} size={76} />
                      {submitResult === 'stamped' && (
                        <Stamp
                          text="早点睡"
                          caption={bed}
                          tone="sleep"
                          animate
                          size={58}
                          className="absolute -top-2 -right-9"
                        />
                      )}
                    </div>
                    <Badge tone={submitResult === 'stamped' ? 'success' : 'warning'} dot>
                      {submitResult === 'stamped'
                        ? '已盖下早睡有效章 · 连击 +1'
                        : '已诚实归档睡眠数据（未计有效早睡卡）'}
                    </Badge>
                    <p className="text-caption font-bold">
                      {bed} 入睡 → {wake} 起床（{formatSpanMinutes(evaluation.durationMinutes)}）
                    </p>
                    <p className="text-tiny text-muted max-w-xs leading-relaxed">
                      {evaluation.verdictDetail}
                    </p>
                    <Button variant="soft" size="sm" onClick={() => setSubmitResult(null)}>
                      返回修改时间
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-caption font-bold">
                        {inputMode === 'manual' ? '手动填写睡眠时段' : 'AI 识别睡眠草稿（可微调）'}
                      </span>
                      <Badge tone="sleep">深睡 {currentScenario.deepHours}</Badge>
                    </div>

                    <TimeRangeField
                      label="入睡与起床时刻"
                      start={bed}
                      end={wake}
                      onStartChange={(v) => {
                        setBed(v)
                        setSubmitResult(null)
                      }}
                      onEndChange={(v) => {
                        setWake(v)
                        setSubmitResult(null)
                      }}
                      tone="sleep"
                    />

                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-caption font-semibold">晨起精神状态</span>
                      <Rating
                        value={quality}
                        onValueChange={setQuality}
                        tone="sleep"
                        label="晨起精神状态"
                      />
                    </div>

                    <Field label="睡眠备注" htmlFor="sleep-phone-note" aside="可选">
                      <Input
                        id="sleep-phone-note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </Field>

                    {/* 实时 AI 节律裁判卡 */}
                    <div
                      className={cn(
                        'flex flex-col gap-2 rounded-2xl border p-3',
                        evaluation.isValidCheckin
                          ? 'bg-sleep-soft/50 border-sleep/35'
                          : 'bg-warning-soft/55 border-warning/40',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Icon
                            name={evaluation.isValidCheckin ? 'shield' : 'alert'}
                            size={15}
                            className={
                              evaluation.isValidCheckin ? 'text-sleep-ink' : 'text-warning-ink'
                            }
                          />
                          <span
                            className={cn(
                              'text-caption font-bold',
                              evaluation.isValidCheckin ? 'text-sleep-ink' : 'text-warning-ink',
                            )}
                          >
                            {evaluation.verdictTitle}
                          </span>
                        </div>
                        <Badge tone={evaluation.isValidCheckin ? 'success' : 'warning'}>
                          {evaluation.isValidCheckin ? '可盖章' : '仅存档'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="bg-surface/85 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5">
                          <span
                            className={cn(
                              'text-tiny font-bold',
                              evaluation.bedtimePassed ? 'text-success-ink' : 'text-danger-ink',
                            )}
                          >
                            {evaluation.bedtimePassed ? '✓' : '✕'}
                          </span>
                          <span className="text-tiny truncate font-semibold">
                            入睡 {bed}（红线 {curfew}）
                          </span>
                        </div>
                        <div className="bg-surface/85 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5">
                          <span
                            className={cn(
                              'text-tiny font-bold',
                              evaluation.durationPassed ? 'text-success-ink' : 'text-danger-ink',
                            )}
                          >
                            {evaluation.durationPassed ? '✓' : '✕'}
                          </span>
                          <span className="text-tiny truncate font-semibold">
                            时长 {formatSpanMinutes(evaluation.durationMinutes)}
                          </span>
                        </div>
                      </div>

                      <p className="text-tiny text-muted leading-relaxed">
                        {evaluation.verdictDetail}
                      </p>
                    </div>

                    {evaluation.isValidCheckin ? (
                      <Button
                        icon="check"
                        className="w-full"
                        onClick={() => {
                          setSubmitResult('stamped')
                          toast.success(`早点睡打卡成功：${bed} → ${wake}`)
                        }}
                      >
                        确认记录 · 盖下早点睡印章
                      </Button>
                    ) : (
                      <Button
                        variant="soft"
                        icon="clock"
                        className="w-full"
                        onClick={() => {
                          setSubmitResult('archived')
                          toast.info(`已归档睡眠数据：${bed} → ${wake}（未计早睡有效卡）`)
                        }}
                      >
                        仅保存睡眠记录（不计有效早睡卡）
                      </Button>
                    )}
                  </>
                )}
              </Card>
            </div>
          </div>
        </PhoneFrame>
      </div>

      {/* 右侧：沙盒场景切换控制台 */}
      <div
        className="flex min-w-0 flex-col gap-3.5"
        data-ann="playbook.modules.sleep.sandbox.console"
      >
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-subhead font-bold">睡眠裁判场景切换器（实时联动左侧手机）</span>
            <Badge tone="sleep" icon="sparkles">
              交互沙盒
            </Badge>
          </div>
          <p className="text-caption text-muted">
            点击切换下方 3 种典型作息场景，或直接在左侧手机框里调整「入睡 / 起床」时间，体验 AI
            节律裁判如何实时拦截「熬夜补觉」并切换提交按钮状态：
          </p>

          <div className="flex flex-col gap-2">
            {(Object.keys(SLEEP_SCENARIOS) as SleepScenarioId[]).map((key) => {
              const item = SLEEP_SCENARIOS[key]
              const active = scenarioId === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyScenario(key)}
                  className={cn(
                    'flex min-w-0 items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-all active:scale-[0.99]',
                    active
                      ? 'border-sleep bg-sleep-soft/60 shadow-soft'
                      : 'border-border bg-surface-sunken/60 hover:bg-surface-sunken',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-caption truncate font-bold">{item.title}</p>
                    <p className="text-tiny text-muted mt-0.5 truncate">{item.subtitle}</p>
                  </div>
                  <Badge tone={item.badgeTone}>{item.badge}</Badge>
                </button>
              )
            })}
          </div>

          <div className="border-border bg-surface-sunken/70 flex flex-col gap-2.5 rounded-2xl border p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption font-semibold">调整目标入睡红线（实时重算判例）</span>
              <span className="text-tiny text-muted font-mono">当前红线：{curfew}</span>
            </div>
            <SegmentedControl
              size="sm"
              label="沙盒入睡红线"
              value={curfew}
              onValueChange={(next) => {
                setCurfew(next)
                setSubmitResult(null)
              }}
              options={[
                { value: '22:30', label: '22:30 前入睡' },
                { value: '23:00', label: '23:00 前入睡' },
                { value: '23:30', label: '23:30 前入睡' },
              ]}
            />
            <p className="text-tiny text-muted">
              试试在场景 A（23:15 入睡）下把红线切到「22:30
              前入睡」：左侧手机会立即从「有效打卡」切换为「晚于红线 45 分钟 · 仅存档」！
            </p>
          </div>
        </Card>

        <Card variant="sunken" className="flex flex-col gap-2">
          <p className="text-caption font-bold">睡眠板块页面核心构成</p>
          <ul className="text-tiny text-muted space-y-1.5 leading-relaxed">
            <li>
              • <strong className="text-foreground">入睡红线目标条</strong>
              ：在顶栏下方醒目提示设定的入睡红线（如 23:30）与有效时长窗口（6.5–9.5h）。
            </li>
            <li>
              • <strong className="text-foreground">跨午夜 TimeRangeField</strong>
              ：起床时刻小于入睡时刻时自动标记「次日」胶囊，并实时计算钟面总睡眠时长。
            </li>
            <li>
              • <strong className="text-foreground">AI 节律裁判卡与按钮降级</strong>
              ：未达红线时主按钮自动降级为 `soft`
              变体「仅保存睡眠记录（不计有效早睡卡）」，诚实存档不伤和气。
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
