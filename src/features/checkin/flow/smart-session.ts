import type { Verdict } from '@/features/referee/schemas'
import type { Module } from '@/features/shared/schemas'
import type { SmartFillContext } from '../components/form-types'
import type { CheckinInputMode } from '../components/smart-scanner'
import type { Checkin, CreateCheckinInput } from '../schemas'
import type { SmartRecognitionDraft, SmartRecognitionResult } from '../smart-schemas'

/**
 * 智能识别草稿是否包含目标板块的结构化数据。
 * 用户在 /checkin/smart 顶栏切换到无识别草稿的其他板块时，不应携带原板块的识别上下文与 aiRunId。
 */
export function hasDraftForModule(draft: SmartRecognitionDraft, module: Module): boolean {
  return draft[module] !== null
}

/**
 * 手动填写模式下，确保饮食打卡的记录方式回落为 manual（即使此前曾运行过拍照识别）。
 */
export function normalizeManualSubject(
  input: CreateCheckinInput,
  mode: CheckinInputMode,
): CreateCheckinInput {
  if (mode === 'manual' && input.module === 'diet' && input.method === 'photo') {
    return { ...input, method: 'manual' }
  }
  return input
}

/**
 * 组装最终入库请求体：
 * - 仅当处于智能模式（smart-capture / smart-upload）且当前持有未消费的识别上下文时，才附带 source='ai' 与一次性 aiRunId；
 * - 切回手动填写、切换餐次或已确认消费过该次识别后，一律按普通手动记录入库，避免触发 checkins_ai_run_id_key 唯一冲突（409）。
 */
export function buildConfirmPayload(params: {
  subject: CreateCheckinInput
  mode: CheckinInputMode
  smart: SmartFillContext | null
  verdict: Verdict
}): CreateCheckinInput {
  const normalized = normalizeManualSubject(params.subject, params.mode)
  const attachSmart = params.mode !== 'manual' && params.smart !== null ? params.smart : null

  return {
    ...normalized,
    ...(attachSmart
      ? {
          source: 'ai' as const,
          aiRunId: attachSmart.aiRunId,
          parsedText: attachSmart.draft.summary.slice(0, 500),
        }
      : {}),
    ...(params.verdict.facts ? { facts: params.verdict.facts } : {}),
    ...(params.verdict.refereeRunId ? { refereeRunId: params.verdict.refereeRunId } : {}),
    ...(params.verdict.citations.length > 0 ? { citations: params.verdict.citations } : {}),
    ...(params.verdict.advice.length > 0
      ? { advice: params.verdict.advice.map((a) => a.slice(0, 80)) }
      : {}),
  }
}

/**
 * 计算 /checkin/smart 传给 CheckinFlow 的初始识别快照：
 * - 已经确认入库过的识别快照（aiRunId 已消费）不得再次注入新挂载的目标表单；
 * - 切换到没有对应草稿数据的板块时返回 null，避免跨板块污染 aiRunId。
 */
export function resolveInitialSmartForGoal<T extends { result: SmartRecognitionResult }>(params: {
  snapshot: T | null
  confirmedCurrent: boolean
  goalModule: Module
}): T | null {
  if (!params.snapshot || params.confirmedCurrent) return null
  if (!hasDraftForModule(params.snapshot.result.draft, params.goalModule)) return null
  return params.snapshot
}

/**
 * 判断打卡流当前是否存在「已生成草稿/裁判结论但尚未点击最终确认入库」的内容，供顶栏返回守卫拦截误退。
 */
export function computeFlowUnconfirmed(params: {
  saved: Checkin | null
  subject: CreateCheckinInput | null
  mode: CheckinInputMode
  smart: SmartFillContext | null
}): boolean {
  if (params.saved !== null) return false
  return params.subject !== null || (params.mode !== 'manual' && params.smart !== null)
}
