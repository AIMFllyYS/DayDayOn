import type {
  SmartRecognitionDraft,
  SmartRecognitionFields,
} from '@/features/checkin/smart-schemas'
import type { FieldDef } from '@/features/goal/schemas'
import type { Module } from '@/features/shared/schemas'

/*
 * 全板块智能识别的纯函数规则：组装 user message 与归一化模型输出（不碰数据库，带单测）。
 */

export interface SmartGoalBrief {
  id: string
  module: Module
  title: string
  fields?: readonly FieldDef[] | null
}

/**
 * 组装发给模型的 user message 文本：
 * 用户目标列表、已知板块提示、纯文本附件内容、用户备注均放在 user message 中，不拼入 system prompt。
 */
export function buildSmartUserText(input: {
  fields: SmartRecognitionFields
  goals: readonly SmartGoalBrief[]
  hasImage: boolean
}): string {
  const { fields, goals, hasImage } = input
  const lines: string[] = [
    hasImage
      ? '请识别这张图片（以及附带的说明）属于哪个打卡板块，并提取结构化打卡数据。'
      : '请分析以下上传的文本内容属于哪个打卡板块，并提取结构化打卡数据。',
  ]

  if (fields.hintModule) {
    lines.push(
      `已知所属板块（hintModule）：${fields.hintModule}（detectedModule 必须固定为 ${fields.hintModule}）`,
    )
  }
  if (fields.goalId) {
    lines.push(`指定目标 ID（goalId）：${fields.goalId}`)
  }

  if (goals.length > 0) {
    lines.push('用户当前进行中的目标列表：')
    for (const g of goals) {
      const fieldDesc =
        g.module === 'custom' && g.fields && g.fields.length > 0
          ? `（自定义字段：${g.fields.map((f) => `${f.key}:${f.label}[${f.type}]`).join(', ')}）`
          : ''
      lines.push(`- id="${g.id}" | module="${g.module}" | title="${g.title}"${fieldDesc}`)
    }
  } else {
    lines.push('用户当前暂无进行中的目标（matchedGoalId 填 null）。')
  }

  const textContent = fields.textContent?.trim()
  if (textContent) {
    lines.push(`上传的文本附件内容：\n${textContent}`)
  }

  const note = fields.note?.trim()
  if (note) {
    lines.push(`用户补充说明：${note}`)
  }

  return lines.join('\n')
}

/**
 * 归一化模型输出：
 * 1. 若请求指定了 hintModule，强制对齐 detectedModule；
 * 2. 校验 matchedGoalId 是否属于用户当前该板块下的目标，若不合法或未填则自动匹配同板块第一个目标；
 * 3. 为 detectedModule 对应的子表单对象补齐兜底结构，确保前端直接挂载渲染不报错。
 */
export function normalizeSmartDraft(
  draft: SmartRecognitionDraft,
  context: {
    hintModule?: Module
    goalId?: string
    goals: readonly SmartGoalBrief[]
  },
): SmartRecognitionDraft {
  const detectedModule: Module = context.hintModule ?? draft.detectedModule
  const moduleGoals = context.goals.filter((g) => g.module === detectedModule)

  let matchedGoalId: string | null = null
  if (context.goalId && moduleGoals.some((g) => g.id === context.goalId)) {
    matchedGoalId = context.goalId
  } else if (draft.matchedGoalId && moduleGoals.some((g) => g.id === draft.matchedGoalId)) {
    matchedGoalId = draft.matchedGoalId
  } else {
    matchedGoalId = moduleGoals[0]?.id ?? null
  }

  const exercise =
    draft.exercise ??
    (detectedModule === 'exercise'
      ? {
          category: '跑步',
          durationMinutes: 30,
          intensity: 'moderate' as const,
          estimatedKcal: null,
          note: null,
        }
      : null)

  const diet = draft.diet
    ? {
        ...draft.diet,
        items: draft.diet.items.map((i) => ({
          name: i.name.trim() || '未命名食物',
          portion: i.portion.trim(),
          kcal: i.kcal,
        })),
      }
    : detectedModule === 'diet'
      ? {
          mealType: 'lunch' as const,
          items: [{ name: '识别餐食', portion: '1 份', kcal: null }],
          note: null,
        }
      : null

  const sleep =
    draft.sleep ??
    (detectedModule === 'sleep'
      ? {
          bedTime: '23:00',
          wakeTime: '07:00',
          quality: 4 as const,
          note: null,
        }
      : null)

  const study =
    draft.study ??
    (detectedModule === 'study'
      ? {
          what: draft.summary.trim().slice(0, 60) || '学习打卡',
          durationMinutes: 30,
          note: null,
        }
      : null)

  const custom =
    draft.custom ??
    (detectedModule === 'custom'
      ? {
          values: {},
          note: null,
        }
      : null)

  const scanSteps: [string, string, string] = [
    draft.scanSteps[0].trim() || '已完成上传内容扫描',
    draft.scanSteps[1].trim() || `识别为「${detectedModule}」板块数据`,
    draft.scanSteps[2].trim() || '已预填表单，请核对后确认记录',
  ]

  return {
    ...draft,
    detectedModule,
    matchedGoalId,
    summary: draft.summary.trim() || '已完成智能打卡识别',
    scanSteps,
    exercise,
    diet,
    sleep,
    study,
    custom,
  }
}
