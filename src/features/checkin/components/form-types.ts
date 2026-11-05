import type { FormErrors } from '@/components/ui/form'
import type { GoalDetail } from '@/features/goal/schemas'
import type { CreateCheckinInput } from '../schemas'
import type { SmartRecognitionDraft } from '../smart-schemas'

/** 打卡表单需要的目标信息（GoalDetail 的子集，Playbook 可以直接造） */
export type CheckinGoal = Pick<
  GoalDetail,
  'id' | 'module' | 'title' | 'target' | 'fields' | 'fieldVersion'
>

/** 用户资料里的时区与日切换时间（睡眠组合时刻用） */
export interface CheckinClock {
  timeZone: string
  dayStartHour: number
}

/** AI 智能识别上下文：存在时预填表单并在提交时附带 source: 'ai' 与 aiRunId */
export interface SmartFillContext {
  draft: SmartRecognitionDraft
  aiRunId: string
}

/** 各板块表单的共同 props：表单只组装请求体，提交和校验由 CheckinForm 负责 */
export interface ModuleFormProps {
  goal: CheckinGoal
  /** 目标打卡日：今天，补卡时为昨天 */
  day: string
  isMakeup: boolean
  clock: CheckinClock
  submitting: boolean
  errors?: FormErrors
  /** 最终完整的 AI 识别上下文（用于初始化表单状态） */
  smartContext?: SmartFillContext | null
  /** 流式魔法填充期间实时切片的 AI 上下文 */
  streamedContext?: SmartFillContext | null
  /** 是否正处于流式魔法填充动画中 */
  magicStreaming?: boolean
  /** 当前正在流式写入的字段阶段（0: 摘要, 1: 主字段, 2: 数值/子项, 3: 备注, 4: 完成） */
  magicStage?: 0 | 1 | 2 | 3 | 4
  onSubmit: (input: CreateCheckinInput) => void
}

export const NOTE_PLACEHOLDER = '想记点什么都可以写在这里'
