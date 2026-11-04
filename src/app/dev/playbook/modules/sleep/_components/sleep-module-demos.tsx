'use client'

import { useState } from 'react'
import { Mascot } from '@/components/mascot/mascot'
import { Badge, IconTile } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Stamp } from '@/components/ui/stamp'
import { formatSpanMinutes, timeRangeSpan } from '@/components/ui/time-range-field'
import { deckClass } from '../../_components/deck'

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
    <div className={deckClass}>
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
    <div className={deckClass}>
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
