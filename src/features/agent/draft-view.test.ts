import { describe, expect, it } from 'vitest'
import type { Checkin } from '@/features/checkin/schemas'
import type { Verdict } from '@/features/referee/schemas'
import { draftFieldsOf, draftItemsOf, snapshotOf, verdictPreview } from './draft-view'

const base: Omit<Checkin, 'payload' | 'module' | 'durationSeconds'> = {
  id: '0193f6b2-0000-7000-8000-000000000001',
  goalId: '0193f6b2-0000-7000-8000-000000000002',
  localDate: '2026-11-05',
  occurredAt: '2026-11-05T04:00:00.000Z',
  source: 'manual',
  isMakeup: false,
  count: 1,
  intakeKcal: null,
  burnKcal: null,
  note: null,
  parsedText: null,
  fieldVersion: null,
  aiRunId: null,
  score: null,
  isValid: true,
  verdict: null,
  createdAt: '2026-11-05T04:00:00.000Z',
}

describe('draftFieldsOf', () => {
  it('运动多项逐项列出，带估算消耗', () => {
    const c: Checkin = {
      ...base,
      module: 'exercise',
      durationSeconds: 2400,
      burnKcal: 310,
      payload: {
        module: 'exercise',
        category: '慢跑',
        intensity: 'moderate',
        items: [
          {
            name: '慢跑',
            calc: 'distance',
            minutes: 30,
            km: 5,
            sets: null,
            effort: '',
            kcal: null,
            heartRate: null,
            feel: '',
          },
          {
            name: '深蹲',
            calc: 'count',
            minutes: 10,
            km: null,
            sets: 4,
            effort: '',
            kcal: 60,
            heartRate: null,
            feel: '',
          },
        ],
      },
    }
    expect(draftFieldsOf(c, 'Asia/Shanghai')).toEqual([
      { label: '慢跑', value: '30 分钟 · 5 公里' },
      { label: '深蹲', value: '10 分钟 · 4 组', hint: '设备记录 60 千卡' },
      { label: '估算消耗', value: '约 310 千卡' },
    ])
  })

  it('睡眠按用户时区显示时刻', () => {
    const c: Checkin = {
      ...base,
      module: 'sleep',
      durationSeconds: 28_800,
      payload: {
        module: 'sleep',
        bedAt: '2026-11-04T15:00:00.000Z',
        wakeAt: '2026-11-04T23:00:00.000Z',
        quality: 4,
      },
    }
    const fields = draftFieldsOf(c, 'Asia/Shanghai')
    expect(fields[0]).toEqual({ label: '入睡', value: '11月4日 23:00' })
    expect(fields[1]).toEqual({ label: '起床', value: '11月5日 07:00' })
    expect(fields.at(-1)).toEqual({ label: '质量', value: '4/5' })
  })
})

describe('snapshotOf / draftItemsOf / verdictPreview', () => {
  const diet: Checkin = {
    ...base,
    module: 'diet',
    durationSeconds: null,
    intakeKcal: 450,
    score: 2.5,
    isValid: false,
    note: '外卖',
    payload: {
      module: 'diet',
      method: 'manual',
      mealType: 'dinner',
      items: [
        { name: '炸鸡', portion: '半份', kcal: 400 },
        { name: '可乐', portion: '一罐', kcal: 50 },
      ],
    },
  }

  it('快照带一句话摘要、备注、分数和是否有效', () => {
    expect(snapshotOf(diet)).toEqual({
      summary: '晚餐：炸鸡、可乐 · 450 千卡',
      note: '外卖',
      isValid: false,
      score: 2.5,
    })
  })

  it('饮食条目可编辑，别的板块没有条目', () => {
    expect(draftItemsOf(diet, 1)?.map((i) => i.name)).toEqual(['炸鸡', '可乐'])
    expect(draftItemsOf({ ...diet, payload: { module: 'study', what: '英语' } })).toBeUndefined()
  })

  it('结论预览最多带 8 条检查、3 条建议', () => {
    const v: Verdict = {
      version: 1,
      isValid: true,
      score: 4.5,
      scoreMax: 5,
      detail: '蛋白充足',
      checks: Array.from({ length: 10 }, (_, i) => ({
        id: `c${i}`,
        text: `检查 ${i}`,
        ok: i % 2 === 0,
      })),
      metrics: {},
      facts: null,
      citations: [],
      advice: ['多喝水'],
      refereeRunId: null,
      offline: false,
    }
    const p = verdictPreview(v)
    expect(p.checks).toHaveLength(8)
    expect(p).toMatchObject({
      isValid: true,
      score: 4.5,
      scoreMax: 5,
      offline: false,
      advice: ['多喝水'],
    })
  })
})
