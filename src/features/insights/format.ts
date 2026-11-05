import type { Tone } from '@/components/ui/tone'
import { formatDuration } from '@/lib/time'
import type { GoalInsight } from './schemas'

/*
 * 板块近况的文案：主数字、副标题、走势图的取值与门槛。纯函数，带单测。
 * 每个板块只看它的核心目的：饮食看平均分，运动看活动量，睡眠看早睡和睡够，学习看专注时长，自定义看达标率。
 */

/** 每周运动建议（WHO：中等强度每周至少 150 分钟） */
export const WEEKLY_EXERCISE_SECONDS = 150 * 60

export interface InsightView {
  /** 主数字与单位 */
  value: string
  unit: string
  /** 一行补充说明 */
  note: string
  /** 达标率文案，例如「达标 5/7」；没有打卡为 null */
  rate: string | null
  rateTone: Tone
  /** 走势图（与 series 一一对应） */
  bars: (number | null)[]
  threshold: number | null
  chartLabel: string
  /** 最常卡住的规则 */
  failure: string | null
  deadline: string | null
  empty: boolean
}

/** 从 0 点起的分钟 → 'HH:mm' */
export function clockText(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** 秒 → 主数字 + 单位：不到 1 小时按分钟，否则按小时一位小数（卡片上数字和单位分开排，不会折行） */
export function durationParts(seconds: number): { value: string; unit: string } {
  const minutes = Math.round(Math.max(0, seconds) / 60)
  if (minutes < 60) return { value: String(minutes), unit: '分钟' }
  return { value: String(Math.round((minutes / 60) * 10) / 10), unit: '小时' }
}

function hoursText(seconds: number): string {
  return `${Math.round((seconds / 3600) * 10) / 10}`
}

export function insightView(i: GoalInsight, days: number): InsightView {
  const empty = i.total === 0
  const rate = empty ? null : `达标 ${i.valid}/${i.total}`
  const ratio = empty ? 0 : i.valid / i.total
  const rateTone: Tone = empty
    ? 'neutral'
    : ratio >= 0.8
      ? 'success'
      : ratio >= 0.5
        ? 'warning'
        : 'danger'
  const failure =
    i.topFailure && i.topFailure.count > 0
      ? `最常卡在：${i.topFailure.text}（${i.topFailure.count}/${i.topFailure.of} 次）`
      : null
  const deadline = i.deadline
    ? i.deadline.daysLeft === 0
      ? '期限已到'
      : `距期限还有 ${i.deadline.daysLeft} 天`
    : null
  const values = i.series.map((p) => p.value)
  const base = { rate, rateTone, failure, deadline, empty }

  switch (i.module) {
    case 'diet':
      return {
        ...base,
        value: i.avgScore === null ? '—' : i.avgScore.toFixed(1),
        unit: '分',
        note:
          i.avgScore === null
            ? `近 ${days} 天还没有打分的餐`
            : `平均分 · 有效线 ${i.passScore ?? 3}${i.kcal !== null ? ` · 每餐约 ${i.kcal} 千卡` : ''}`,
        bars: values,
        threshold: i.passScore,
        chartLabel: `近 ${days} 天每天的平均分`,
      }
    case 'exercise': {
      const weekly =
        days === 7 ? WEEKLY_EXERCISE_SECONDS : Math.round((WEEKLY_EXERCISE_SECONDS * days) / 7)
      return {
        ...base,
        ...durationParts(i.totalSeconds),
        note: `建议 ${formatDuration(weekly)}${i.kcal !== null ? ` · 消耗约 ${i.kcal} 千卡` : ''}`,
        bars: values.map((v) => (v === null ? null : v / 60)),
        threshold: null,
        chartLabel: `近 ${days} 天每天的运动分钟数`,
      }
    }
    case 'sleep':
      return {
        ...base,
        value: i.avgSleepSeconds === null ? '—' : hoursText(i.avgSleepSeconds),
        unit: i.avgSleepSeconds === null ? '' : '小时',
        note:
          i.avgBedMinutes === null
            ? `近 ${days} 天还没有睡眠记录`
            : `平均 ${clockText(i.avgBedMinutes)} 入睡 · ${i.lateNights ?? 0} 晚晚于 ${i.bedtimeBy ?? '23:30'}`,
        bars: values.map((v) => (v === null ? null : v / 3600)),
        threshold: i.minSleepSeconds === null ? null : i.minSleepSeconds / 3600,
        chartLabel: `近 ${days} 天每晚睡了几小时`,
      }
    case 'study':
      return {
        ...base,
        ...durationParts(i.totalSeconds),
        note: `每天至少 ${Math.round((i.dailyTargetSeconds ?? 1500) / 60)} 分钟 · ${i.validDays} 天达标`,
        bars: values.map((v) => (v === null ? null : v / 60)),
        threshold: i.dailyTargetSeconds === null ? null : i.dailyTargetSeconds / 60,
        chartLabel: `近 ${days} 天每天的专注分钟数`,
      }
    case 'custom':
      return {
        ...base,
        value: `${i.validDays}`,
        unit: `/${days} 天`,
        note: '有达标记录的天数',
        bars: values,
        threshold: null,
        chartLabel: `近 ${days} 天每天的达标次数`,
      }
  }
}
