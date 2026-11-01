import type { FormErrors } from '@/components/ui/form'
import type { GoalDetail } from '@/features/goal/schemas'
import type { CreateCheckinInput } from '../schemas'

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

/** 各板块表单的共同 props：表单只组装请求体，提交和校验由 CheckinForm 负责 */
export interface ModuleFormProps {
  goal: CheckinGoal
  /** 目标打卡日：今天，补卡时为昨天 */
  day: string
  isMakeup: boolean
  clock: CheckinClock
  submitting: boolean
  errors?: FormErrors
  onSubmit: (input: CreateCheckinInput) => void
}

export const NOTE_PLACEHOLDER = '想记点什么都可以写在这里'
