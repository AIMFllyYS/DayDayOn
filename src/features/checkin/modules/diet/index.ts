import type { CheckinModuleDef } from '../types'
import { dietDocs } from './docs'
import { useDietForm } from './form'
import { buildDietReport } from './report'

export const dietModule: CheckinModuleDef<'diet'> = {
  module: 'diet',
  tone: 'diet',
  title: '科学饮食打卡',
  agentSteps: ['解析每一道菜', '查营养表与联网核对', '估算份量与烹饪方式', '按达标规则评分'],
  useForm: useDietForm,
  docs: dietDocs,
  buildReport: buildDietReport,
}
