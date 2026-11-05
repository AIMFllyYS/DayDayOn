import type { RulesOf, Verdict } from '@/features/referee/schemas'
import type { CreateCheckinInput } from '../../schemas'
import type { FolderSpec, ReportSpec } from '../../flow/types'
import type { CheckinModuleDef, ModuleDocs } from '../types'
import { useExerciseForm } from './form'

/** 运动分析页：每一项一张卡（计量、消耗、是否达标）→ 整体负荷 → 校验清单 */
function buildExerciseReport(verdict: Verdict, input: CreateCheckinInput): ReportSpec {
  const items = input.module === 'exercise' ? (input.items ?? []) : []
  const facts = verdict.facts?.module === 'exercise' ? verdict.facts : null
  const folders: FolderSpec[] = items.map((it, i) => {
    const fact = facts?.items[i]
    const check = verdict.checks[i]
    const pace =
      it.calc === 'distance' && it.km ? `${(it.minutes / it.km).toFixed(1)} 分钟/公里` : null
    return {
      id: `item-${i}`,
      defaultOpen: true,
      title: it.name,
      icon: 'exercise',
      tone: 'exercise',
      headline:
        it.calc === 'count'
          ? `${it.minutes} 分钟 · ${it.sets ?? 0} 组${fact ? ` · ${fact.kcal} kcal` : ''}`
          : `${it.minutes} 分钟 · ${it.km ?? 0} 公里${fact ? ` · ${fact.kcal} kcal` : ''}`,
      badge: check?.ok ? { text: '达标', tone: 'success' } : { text: '未达标', tone: 'warning' },
      rows: [
        ...(fact ? [{ label: '代谢当量', value: `MET ${fact.met}` }] : []),
        ...(fact
          ? [
              {
                label: '消耗',
                value: `${fact.kcal} kcal`,
                sub: fact.fromDevice ? '来自设备' : '按 MET 估算',
              },
            ]
          : []),
        ...(pace ? [{ label: '配速', value: pace }] : []),
        ...(it.heartRate ? [{ label: '平均心率', value: `${it.heartRate} 次/分` }] : []),
      ],
      checks: check ? [{ text: check.text, ok: check.ok }] : undefined,
      note: [it.effort, it.feel].filter(Boolean).join('；') || undefined,
    }
  })
  const load = Number(verdict.metrics.load ?? 0)
  folders.push({
    id: 'load',
    title: '整体负荷',
    icon: 'flame',
    tone: 'primary',
    headline: `${verdict.metrics.kcal ?? 0} kcal · 负荷${load < 0.3 ? '轻' : load < 0.7 ? '适中' : '较高'}`,
    rows: [
      { label: '总时长', value: `${verdict.metrics.minutes ?? 0} 分钟` },
      {
        label: '相对负荷',
        value: `${Math.round(load * 100)}%`,
        ratio: Math.min(1, load),
        tone: load >= 0.7 ? 'warning' : 'exercise',
        sub: '以 400 kcal 为一次完整训练',
      },
      ...(verdict.metrics.weightKg ? [] : [{ label: '体重', value: '未记录，按 60kg 估算' }]),
    ],
  })
  return {
    title: `运动分析 · ${verdict.isValid ? '达标' : '日常活动'}`,
    folders,
  }
}

function exerciseDocs(rules: RulesOf<'exercise'>): ModuleDocs {
  const dist = `时长 ≥ ${rules.distanceMinMinutes} 分钟 或 距离 ≥ ${rules.distanceMinKm} 公里`
  const count = `时长 ≥ ${rules.countMinMinutes} 分钟 或 组数 ≥ ${rules.countMinSets} 组`
  return {
    glance: {
      threshold: `跑走骑游：${dist}；力量核心：${count}`,
      tagline: '按计量方式分级的有效阈值',
      pass: '户外慢跑 25 分钟 · 4.2 公里',
      block: '饭后散步 10 分钟，仅记为日常活动',
    },
    rulesDoc: {
      title: '达标规则',
      sections: [
        {
          heading: '按计量方式判定',
          items: [
            `按时间 + 距离（跑、走、骑、游泳等）：${dist}`,
            `按时间 + 组数（力量、核心等）：${count}`,
            '一次打卡可以添加多项运动，任一项达标就盖有效章',
            '门槛在「我的 → 目标设置」里可以调',
          ],
        },
        {
          heading: '没达标怎么办',
          items: ['照常保存，记为日常活动，不盖有效章', '不报错，也不删数据'],
        },
        {
          heading: '强度与高级选项',
          items: ['强度只是一条备注，不参与判定', '消耗、心率、感受都可不写'],
        },
      ],
    },
    basisDoc: {
      title: '评判依据',
      sections: [
        {
          heading: '代谢当量（MET）',
          items: [
            '跑步 8.0，跳绳 11，游泳 7.0，骑行 6.8，快走 4.3，力量 5.0，其余按 4.5 估算',
            '消耗 ≈ MET × 体重 × 小时；体重取你最近一次记录，没有按 60kg；手表给了就用手表的',
          ],
        },
        {
          heading: 'Agent 怎么算',
          items: [
            'Agent 查 MET 表并估算消耗，是否达标由规则判断',
            '你的截图只用于识别，不会被保存',
          ],
        },
      ],
    },
  }
}

export const exerciseModule: CheckinModuleDef<'exercise'> = {
  module: 'exercise',
  tone: 'exercise',
  title: '科学运动打卡',
  agentSteps: ['读取每一项运动', '查代谢当量', '估算消耗', '按门槛判定'],
  useForm: useExerciseForm,
  docs: exerciseDocs,
  buildReport: buildExerciseReport,
}
