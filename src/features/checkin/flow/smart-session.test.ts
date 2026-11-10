import { describe, expect, it } from 'vitest'
import type { Verdict } from '@/features/referee/schemas'
import type { Checkin, CreateCheckinInput } from '../schemas'
import type { SmartRecognitionResult } from '../smart-schemas'
import {
  buildConfirmPayload,
  computeFlowUnconfirmed,
  hasDraftForModule,
  normalizeManualSubject,
  resolveInitialSmartForGoal,
} from './smart-session'

const AI_RUN_ID = '0193f6b2-0000-7000-8000-000000000999'
const REFEREE_RUN_ID = '0193f6b2-0000-7000-8000-000000000888'

const sampleSmart: SmartRecognitionResult = {
  aiRunId: AI_RUN_ID,
  draft: {
    detectedModule: 'diet',
    matchedGoalId: '0193f6b2-0000-7000-8000-000000000001',
    confidence: 0.93,
    summary: '识别到一碗燕麦粥与一颗水煮蛋',
    scanSteps: ['扫描餐盘', '提取营养估算', '匹配饮食目标'],
    exercise: null,
    diet: {
      mealType: 'breakfast',
      items: [
        { name: '燕麦粥', portion: '1碗', kcal: 160 },
        { name: '水煮蛋', portion: '1颗', kcal: 80 },
      ],
      note: null,
    },
    sleep: null,
    study: null,
    custom: null,
  },
}

const sampleVerdict: Verdict = {
  version: 1,
  isValid: false,
  settlement: 'pending',
  score: null,
  scoreMax: 5,
  detail: '待集齐三餐后统一结算',
  metrics: { mealsLogged: 1, mealsRequired: 3 },
  checks: [{ id: 'clear-food', text: '食材清晰', ok: true, source: '规则' }],
  facts: null,
  refereeRunId: REFEREE_RUN_ID,
  offline: false,
  citations: [],
  advice: ['午餐记得补充绿叶蔬菜'],
}

const dietPhotoSubject: CreateCheckinInput = {
  module: 'diet',
  method: 'photo',
  mealType: 'breakfast',
  items: [{ name: '燕麦粥', portion: '1碗', kcal: 160 }],
  note: null,
}

describe('smart-session：智能识别与手动打卡同页切换的上下文隔离', () => {
  it('智能拍照模式下首次确认：携带 source=ai、aiRunId 与 parsedText', () => {
    const payload = buildConfirmPayload({
      subject: dietPhotoSubject,
      mode: 'smart-capture',
      smart: sampleSmart,
      verdict: sampleVerdict,
    })

    expect(payload).toMatchObject({
      module: 'diet',
      method: 'photo',
      source: 'ai',
      aiRunId: AI_RUN_ID,
      parsedText: '识别到一碗燕麦粥与一颗水煮蛋',
      refereeRunId: REFEREE_RUN_ID,
      advice: ['午餐记得补充绿叶蔬菜'],
    })
  })

  it('在智能拍照页切到「手动填写」Tab 后提交：剥离残留 aiRunId 并把饮食 method 归一为 manual，防止 409 冲突', () => {
    const payload = buildConfirmPayload({
      subject: dietPhotoSubject,
      mode: 'manual',
      smart: sampleSmart,
      verdict: sampleVerdict,
    })

    expect(payload).not.toHaveProperty('aiRunId')
    expect(payload).not.toHaveProperty('source')
    expect(payload).not.toHaveProperty('parsedText')
    expect(payload.module === 'diet' && payload.method).toBe('manual')
  })

  it('首餐确认消费完 aiRunId（smart 置空）后继续记下一餐：不再重复携带旧 aiRunId', () => {
    const lunchSubject: CreateCheckinInput = {
      module: 'diet',
      method: 'manual',
      mealType: 'lunch',
      items: [{ name: '糙米饭', portion: '', kcal: null }],
      note: null,
    }
    const payload = buildConfirmPayload({
      subject: lunchSubject,
      mode: 'smart-capture',
      smart: null,
      verdict: sampleVerdict,
    })

    expect(payload).not.toHaveProperty('aiRunId')
    expect(payload).not.toHaveProperty('source')
  })

  it('normalizeManualSubject 只在手动模式下把饮食 photo 回落为 manual，不影响其他板块', () => {
    const studySubject: CreateCheckinInput = {
      module: 'study',
      what: '算法导论',
      durationSeconds: 1800,
      note: null,
    }
    expect(normalizeManualSubject(studySubject, 'manual')).toBe(studySubject)
    expect(normalizeManualSubject(dietPhotoSubject, 'smart-upload')).toBe(dietPhotoSubject)
    expect(normalizeManualSubject(dietPhotoSubject, 'manual')).toEqual({
      ...dietPhotoSubject,
      method: 'manual',
    })
  })

  it('resolveInitialSmartForGoal：未确认且同板块切换目标时保留草稿；确认后或跨到无草稿板块时返回 null', () => {
    const snap = { result: sampleSmart }
    expect(hasDraftForModule(sampleSmart.draft, 'diet')).toBe(true)
    expect(hasDraftForModule(sampleSmart.draft, 'exercise')).toBe(false)

    // 同板块未确认切换另一个饮食目标：保留识别草稿
    expect(
      resolveInitialSmartForGoal({
        snapshot: snap,
        confirmedCurrent: false,
        goalModule: 'diet',
      }),
    ).toBe(snap)

    // 切到运动板块（无运动识别草稿）：不注入饮食的 aiRunId
    expect(
      resolveInitialSmartForGoal({
        snapshot: snap,
        confirmedCurrent: false,
        goalModule: 'exercise',
      }),
    ).toBeNull()

    // 当前识别已确认入库后切换目标：不再二次注入已消费的 aiRunId
    expect(
      resolveInitialSmartForGoal({
        snapshot: snap,
        confirmedCurrent: true,
        goalModule: 'diet',
      }),
    ).toBeNull()
  })

  it('computeFlowUnconfirmed：智能草稿未确认或手动已做裁判未点确认时均拦截返回，入库后放行', () => {
    // 刚完成智能识别、尚未入库
    expect(
      computeFlowUnconfirmed({
        saved: null,
        subject: null,
        mode: 'smart-capture',
        smart: sampleSmart,
      }),
    ).toBe(true)

    // 切到手动填写且尚未点击「提交并 Agent 自动解析」：不误拦截退出
    expect(
      computeFlowUnconfirmed({
        saved: null,
        subject: null,
        mode: 'manual',
        smart: null,
      }),
    ).toBe(false)

    // 手动填写完并运行了团团裁判，但还没点击底部「确认完成/保存记录」：拦截误点返回！
    expect(
      computeFlowUnconfirmed({
        saved: null,
        subject: { module: 'study', what: '英语阅读', durationSeconds: 1800, note: null },
        mode: 'manual',
        smart: null,
      }),
    ).toBe(true)

    // 已确认入库：放行返回
    expect(
      computeFlowUnconfirmed({
        saved: { id: '0193f6b2-0000-7000-8000-000000000777' } as Checkin,
        subject: dietPhotoSubject,
        mode: 'manual',
        smart: null,
      }),
    ).toBe(false)
  })
})
