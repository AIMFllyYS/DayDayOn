import { describe, expect, it } from 'vitest'
import { AppSettingsPatchSchema, DEFAULT_SETTINGS } from '@/server/settings-schema'
import { diffPatch, SETTING_FIELDS, toDraft } from './settings-form'

describe('全站设置表单', () => {
  it('覆盖除 aiPaused 外的全部配置项', () => {
    const keys = SETTING_FIELDS.map((f) => f.key).sort()
    const all = Object.keys(DEFAULT_SETTINGS)
      .filter((k) => k !== 'aiPaused')
      .sort()
    expect(keys).toEqual(all)
  })

  it('金额项显示为元', () => {
    const d = toDraft(DEFAULT_SETTINGS)
    expect(d.dailySpendCapMicros).toBe(10)
    expect(d.newUserQuotaMicros).toBe(2)
    expect(d.aiHourlyLimit).toBe(60)
  })

  it('没改动时补丁为空', () => {
    expect(diffPatch(DEFAULT_SETTINGS, toDraft(DEFAULT_SETTINGS))).toEqual({})
  })

  it('只提交改动项，元换回微元', () => {
    const draft = { ...toDraft(DEFAULT_SETTINGS), dailySpendCapMicros: 12.5, aiConcurrency: 3 }
    const patch = diffPatch(DEFAULT_SETTINGS, draft)
    expect(patch).toEqual({ dailySpendCapMicros: 12_500_000, aiConcurrency: 3 })
    expect(AppSettingsPatchSchema.safeParse(patch).success).toBe(true)
  })

  it('清空的项校验失败', () => {
    const draft = { ...toDraft(DEFAULT_SETTINGS), weeklyQuotaMicros: null }
    const r = AppSettingsPatchSchema.safeParse(diffPatch(DEFAULT_SETTINGS, draft))
    expect(r.success).toBe(false)
  })
})
