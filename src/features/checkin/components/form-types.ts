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
  smartContext?: SmartFillContext | null
  onSubmit: (input: CreateCheckinInput) => void
}

export const NOTE_PLACEHOLDER = '想记点什么都可以写在这里'
