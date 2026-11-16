import { describe, expect, it } from 'vitest'
import { refereeSystemPrompt } from './prompt'

describe('refereeSystemPrompt', () => {
  it('将基础提示词中的「团团」全部替换为当前选中的陪伴角色名', () => {
    for (const petName of ['墩墩', '绵绵', '柚柚']) {
      const prompt = refereeSystemPrompt('diet', petName)
      expect(prompt).toContain(`你是 DayDayOn 的打卡裁判「${petName}」`)
      expect(prompt).not.toContain('你是 DayDayOn 的打卡裁判「团团」')
    }
    expect(refereeSystemPrompt('exercise')).toContain('你是 DayDayOn 的打卡裁判「团团」')
  })
})
