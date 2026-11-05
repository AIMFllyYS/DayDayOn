import type { FactsOf, RulesOf, Verdict } from '../schemas'
import { buildVerdict, hhmmToMinutes, round1, type JudgeContext } from './common'

/*
 * 早点睡：入睡红线 + 有效时长双门槛，缺一不可（Playbook sleep-flow）。
 * 入睡时刻放在「傍晚到次日中午」的轴上比较：中午前的时刻视为已过午夜（+24h），
 * 所以 23:30 的红线下，00:30 入睡是晚了 60 分钟，而不是早了 23 小时。
 * 本地时刻由调用方用 src/lib/time/ 按用户时区换算好再传进来。
 */

export interface SleepSubject {
  /** 入睡的本地时刻 HH:mm */
  bedLocal: string
  /** 起床的本地时刻 HH:mm */
  wakeLocal: string
  /** 睡眠总分钟数 */
  minutes: number
}

const NOON = 12 * 60

/** 把 HH:mm 放到「12:00 → 次日 12:00」的轴上 */
export function bedtimeAxis(hhmm: string): number | null {
  const m = hhmmToMinutes(hhmm)
  if (m === null) return null
  return m < NOON ? m + 1440 : m
}

export function judgeSleep(
  subject: SleepSubject,
  ctx: JudgeContext<RulesOf<'sleep'>, FactsOf<'sleep'>>,
): Verdict {
  const { rules, facts, extras } = ctx
  const bed = bedtimeAxis(subject.bedLocal)
  const red = bedtimeAxis(rules.bedtimeBy)
  const lateBy = bed !== null && red !== null ? bed - red : null
  const earlyOk = lateBy !== null && lateBy <= 0
  const minM = Math.round(rules.minHours * 60)
  const maxM = Math.round(rules.maxHours * 60)
  const durOk = subject.minutes >= minM && subject.minutes <= maxM
  const isValid = earlyOk && durOk
  const hours = round1(subject.minutes / 60)

  const advice: string[] = []
  if (!earlyOk && lateBy !== null) {
    advice.push(
      `今晚试着提前 ${Math.min(lateBy, 60)} 分钟放下手机，慢慢把入睡挪回 ${rules.bedtimeBy} 前`,
    )
  }
  if (subject.minutes < minM) advice.push('睡眠偏短，午间可以小睡 20 分钟补一补')
  if (subject.minutes > maxM) advice.push('睡太久反而更困，定个固定的起床闹钟')
  if (facts?.regularityMinutes != null && facts.regularityMinutes > 60) {
    advice.push('最近入睡时间波动很大，固定作息比偶尔早睡更重要')
  }

  return buildVerdict({
    isValid,
    detail: isValid
      ? `${subject.bedLocal} 入睡，睡了 ${hours} 小时，双门槛都达标`
      : !earlyOk && durOk
        ? `睡够了，但入睡晚于 ${rules.bedtimeBy}，属于熬夜补觉，仅存档`
        : earlyOk && !durOk
          ? `按时入睡，但 ${hours} 小时不在 ${rules.minHours}–${rules.maxHours} 小时内`
          : `入睡晚于 ${rules.bedtimeBy}，时长也不在有效范围内`,
    checks: [
      { id: 'bedtime', text: `入睡不晚于 ${rules.bedtimeBy}`, ok: earlyOk },
      {
        id: 'duration',
        text: `睡眠时长 ${rules.minHours}–${rules.maxHours} 小时`,
        ok: durOk,
        source: '褪黑素分泌高峰与慢波深睡集中在前半夜',
      },
    ],
    metrics: {
      minutes: subject.minutes,
      hours,
      bedLocal: subject.bedLocal,
      wakeLocal: subject.wakeLocal,
      bedtimeBy: rules.bedtimeBy,
      lateByMinutes: lateBy,
      regularityMinutes: facts?.regularityMinutes ?? null,
    },
    facts,
    advice,
    extras,
  })
}
