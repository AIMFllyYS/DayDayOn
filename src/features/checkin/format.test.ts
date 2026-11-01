import { describe, expect, it } from 'vitest'
import type { Checkin } from './schemas'
import {
  checkinSummary,
  gramsToKg,
  kgToGrams,
  progressText,
  rowStatusText,
  targetText,
} from './format'

const base: Omit<Checkin, 'payload'> = {
  id: '0193f6b2-0000-7000-8000-000000000001',
  goalId: '0193f6b2-0000-7000-8000-000000000002',
  module: 'exercise',
  localDate: '2026-11-01',
  occurredAt: '2026-11-01T00:00:00.000Z',
  source: 'manual',
  isMakeup: false,
  durationSeconds: 1800,
  count: 1,
  intakeKcal: null,
  burnKcal: 249,
  note: null,
  parsedText: null,
  fieldVersion: null,
  aiRunId: null,
  createdAt: '2026-11-01T00:00:00.000Z',
}

describe('目标量与进度文案', () => {
  it('时长类按分钟、计次类按次', () => {
    expect(targetText({ kind: 'duration', value: 1800 })).toBe('每天 30分钟')
    expect(targetText({ kind: 'count', value: 3 })).toBe('每天 3 次')
    expect(progressText('duration', { value: 1920, target: 1800, done: true })).toBe(
      '32分钟 / 30分钟',
    )
    expect(rowStatusText('count', { value: 0, target: 3, done: false })).toBe('今天还没记')
    expect(rowStatusText('count', { value: 3, target: 3, done: true })).toBe('已完成 · 3 / 3 次')
  })
})

describe('历史摘要', () => {
  it('运动带估算热量', () => {
    expect(
      checkinSummary({
        ...base,
        payload: { module: 'exercise', category: '跑步', intensity: 'moderate' },
      }),
    ).toBe('跑步 30分钟 · 适中 · 约 249 千卡')
  })

  it('自定义按当时版本的字段名展示', () => {
    expect(
      checkinSummary(
        { ...base, module: 'custom', payload: { module: 'custom', values: { cups: 6, ok: true } } },
        [
          {
            key: 'cups',
            label: '喝水',
            type: 'number',
            unit: '杯',
            integer: true,
            required: false,
          },
          { key: 'ok', label: '完成', type: 'boolean', required: false },
        ],
      ),
    ).toBe('喝水 6 杯 · 完成 是')
  })
})

describe('体重换算', () => {
  it('千克一位小数 ↔ 克', () => {
    expect(kgToGrams(62.5)).toBe(62_500)
    expect(kgToGrams(62.54)).toBe(62_500)
    expect(gramsToKg(62_500)).toBe(62.5)
  })
})
