import type { FactsOf, RulesOf, Verdict } from '../schemas'
import { buildVerdict, type JudgeContext } from './common'

/*
 * 学一点：专注时长 + 内容实质双核验（Playbook study-flow）。
 * 时长按「今天之前已记的分钟 + 这一次」累加，碎片学习同一天凑够也能盖章。
 * 内容：要点总字数 ≥ minNoteChars；有 Agent 事实时还要 substantive = true（不是乱码或空话）。
 */

export interface StudySubject {
  topic: string
  minutes: number | null
  points: string[]
}

/** 去掉空白后的要点总字数 */
export function noteChars(points: readonly string[]): number {
  return points.join('').replace(/\s+/g, '').length
}

export function judgeStudy(
  subject: StudySubject,
  ctx: JudgeContext<RulesOf<'study'>, FactsOf<'study'>>,
): Verdict {
  const { rules, facts, extras } = ctx
  const now = subject.minutes ?? 0
  const before = facts?.todayMinutesBefore ?? 0
  const total = now + before
  const timeOk = total >= rules.minFocusMinutes
  const chars = noteChars(subject.points)
  const enough = chars >= rules.minNoteChars
  const contentOk = enough && (facts ? facts.substantive : true)
  const isValid = timeOk && contentOk

  const advice: string[] = []
  if (!timeOk) advice.push(`再专注 ${rules.minFocusMinutes - total} 分钟，今天累计就够一个番茄钟`)
  if (!enough) advice.push('写下一两条具体的收获，比如一个公式或一个结论')
  else if (facts && !facts.substantive) advice.push('要点写得具体一点，能让明天的你看懂')

  return buildVerdict({
    isValid,
    detail: isValid
      ? `今天累计专注 ${total} 分钟，要点有实质内容`
      : !timeOk
        ? `今天累计 ${total} 分钟，未满 ${rules.minFocusMinutes} 分钟，先暂存为碎片学习`
        : '时长够了，但要点内容不够实质，仅存档',
    checks: [
      {
        id: 'focus',
        text: `今天累计专注 ≥ ${rules.minFocusMinutes} 分钟`,
        ok: timeOk,
        source: '番茄工作法的单个专注单元',
      },
      { id: 'content', text: `要点有实质内容（≥ ${rules.minNoteChars} 字）`, ok: contentOk },
    ],
    metrics: {
      minutes: now,
      todayMinutesBefore: before,
      totalMinutes: total,
      points: subject.points.length,
      chars,
      subject: facts?.subject ?? null,
      summary: facts?.summary ?? null,
    },
    facts,
    advice,
    extras,
  })
}
