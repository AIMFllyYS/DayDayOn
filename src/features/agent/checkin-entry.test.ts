import { describe, expect, it } from 'vitest'
import {
  CreateCheckinSchema,
  DeleteCheckinQuerySchema,
  UpdateCheckinSchema,
  type Checkin,
} from '@/features/checkin/schemas'
import {
  CheckinEntrySchema,
  checkinToEntry,
  entryToCreateInput,
  factsMismatch,
  type CheckinEntry,
} from './checkin-entry'

const parseEntry = (e: unknown): CheckinEntry => CheckinEntrySchema.parse(e)

describe('entryToCreateInput：对话里的内容换成创建打卡请求体', () => {
  it('运动：多项 → 品类取第一项、时长求和，带上 origin=agent', () => {
    const entry = parseEntry({
      module: 'exercise',
      items: [
        { name: '慢跑', calc: 'distance', minutes: 30, km: 5, sets: 3 },
        { name: '深蹲', calc: 'count', minutes: 10, km: 2, sets: 4 },
      ],
    })
    const input = entryToCreateInput(entry, { fieldVersion: null })
    const parsed = CreateCheckinSchema.parse(input)
    expect(parsed).toMatchObject({
      module: 'exercise',
      category: '慢跑',
      intensity: 'moderate',
      durationSeconds: 2400,
      origin: 'agent',
      source: 'manual',
      isMakeup: false,
    })
    if (parsed.module !== 'exercise') throw new Error('板块不对')
    // 按计量方式清掉另一个量
    expect(parsed.items?.[0]).toMatchObject({ km: 5, sets: null })
    expect(parsed.items?.[1]).toMatchObject({ km: null, sets: 4 })
  })

  it('饮食：只有加餐带 snackTime，事实与建议原样带上', () => {
    const entry = parseEntry({
      module: 'diet',
      mealType: 'lunch',
      snackTime: '15:00',
      items: [{ name: '番茄炒蛋', portion: '一盘', kcal: 220 }],
    })
    const facts = {
      module: 'diet' as const,
      dishes: [
        {
          name: '番茄炒蛋',
          portion: '一盘',
          kcal: 220,
          proteinG: 12,
          carbG: 8,
          fatG: 15,
          fiberG: 2,
          sodiumMg: 600,
          gi: 30,
          junk: false,
          sweet: false,
          cooking: 'stir-fried' as const,
          source: 'table' as const,
        },
      ],
    }
    const input = entryToCreateInput(
      entry,
      { fieldVersion: null, note: '公司食堂' },
      { facts, advice: ['加一份蔬菜'] },
    )
    const parsed = CreateCheckinSchema.parse(input)
    expect(parsed).toMatchObject({ module: 'diet', mealType: 'lunch', note: '公司食堂' })
    expect('snackTime' in parsed).toBe(false)
    expect(parsed.facts).toEqual(facts)
    expect(parsed.advice).toEqual(['加一份蔬菜'])
  })

  it('睡眠：带偏移的时刻归一化成 UTC', () => {
    const entry = parseEntry({
      module: 'sleep',
      bedAt: '2026-11-01T23:30:00+08:00',
      wakeAt: '2026-11-02T07:30:00+08:00',
      quality: 4,
    })
    expect(entryToCreateInput(entry, { fieldVersion: null, isMakeup: true })).toMatchObject({
      bedAt: '2026-11-01T15:30:00.000Z',
      wakeAt: '2026-11-01T23:30:00.000Z',
      isMakeup: true,
    })
  })

  it('学习：分钟换秒，要点保留', () => {
    const entry = parseEntry({
      module: 'study',
      what: '动态规划',
      durationMinutes: 40,
      points: ['状态转移方程', '滚动数组'],
    })
    const parsed = CreateCheckinSchema.parse(entryToCreateInput(entry, { fieldVersion: null }))
    expect(parsed).toMatchObject({ durationSeconds: 2400, points: ['状态转移方程', '滚动数组'] })
  })

  it('自定义：带上目标当前字段版本', () => {
    const entry = parseEntry({ module: 'custom', values: { cups: 8 } })
    expect(entryToCreateInput(entry, { fieldVersion: 3 })).toMatchObject({
      module: 'custom',
      fieldVersion: 3,
      values: { cups: 8 },
    })
  })
})

describe('factsMismatch：事实和内容一一对应', () => {
  const diet = parseEntry({
    module: 'diet',
    mealType: 'dinner',
    items: [
      { name: '米饭', portion: '一碗', kcal: 230 },
      { name: '青菜', portion: '一盘', kcal: 80 },
    ],
  })
  it('没有事实不算错', () => {
    expect(factsMismatch(diet, {})).toBeNull()
  })
  it('板块不同、条数不同都报出来', () => {
    expect(
      factsMismatch(diet, { facts: { module: 'sleep', regularityMinutes: null, recentNights: 0 } }),
    ).toContain('facts.module')
    expect(
      factsMismatch(diet, {
        facts: {
          module: 'diet',
          dishes: [
            {
              name: '米饭',
              portion: '',
              kcal: 230,
              proteinG: 4,
              carbG: 50,
              fatG: 0,
              fiberG: 0,
              sodiumMg: 0,
              gi: 80,
              junk: false,
              sweet: false,
              cooking: 'steamed',
              source: 'table',
            },
          ],
        },
      }),
    ).toContain('一一对应')
  })
})

describe('checkinToEntry：已存的打卡还原成可改的内容', () => {
  it('老的运动打卡（没有 items）按品类和时长还原一项', () => {
    const entry = checkinToEntry({
      payload: { module: 'exercise', category: '跑步', intensity: 'hard' },
      durationSeconds: 1800,
    } as Pick<Checkin, 'payload' | 'durationSeconds'>)
    expect(entry).toMatchObject({
      module: 'exercise',
      items: [{ name: '跑步', calc: 'distance', minutes: 30, km: null, sets: null }],
    })
  })

  it('学习打卡还原后再换回请求体，内容不变', () => {
    const c = {
      payload: { module: 'study', what: '英语阅读', points: ['定语从句'] },
      durationSeconds: 1500,
    } as Pick<Checkin, 'payload' | 'durationSeconds'>
    const back = entryToCreateInput(checkinToEntry(c), { fieldVersion: null })
    expect(back).toMatchObject({ what: '英语阅读', durationSeconds: 1500, points: ['定语从句'] })
  })
})

describe('修改 / 删除的请求体', () => {
  it('Agent 改打卡必须写原因', () => {
    expect(UpdateCheckinSchema.safeParse({ note: '好吃', origin: 'agent' }).success).toBe(false)
    expect(
      UpdateCheckinSchema.safeParse({ note: '好吃', origin: 'agent', reason: '补个备注' }).success,
    ).toBe(true)
  })
  it('页面上改备注不需要原因；items 和 replace 不能同时给', () => {
    expect(UpdateCheckinSchema.safeParse({ note: '好吃' }).success).toBe(true)
    expect(
      UpdateCheckinSchema.safeParse({
        items: [{ name: '米饭', portion: '', kcal: 200 }],
        replace: { module: 'study', what: '英语' },
      }).success,
    ).toBe(false)
    expect(UpdateCheckinSchema.safeParse({}).success).toBe(false)
  })
  it('Agent 删除必须写原因', () => {
    expect(DeleteCheckinQuerySchema.safeParse({ origin: 'agent' }).success).toBe(false)
    expect(DeleteCheckinQuerySchema.safeParse({}).data).toEqual({ origin: 'manual' })
  })
})
