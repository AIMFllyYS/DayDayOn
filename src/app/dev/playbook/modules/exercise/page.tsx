import type { Metadata } from 'next'
import { ModulePage } from '../_components/module-page'
import { MODULE_SPEC_BY_SLUG } from '../_data/module-specs'
import {
  ExerciseFullPageSandbox,
  ExerciseThresholdMatrix,
  ExerciseVerdictComparisonMatrix,
} from './_components/exercise-demos'

export const metadata: Metadata = { title: '运动板块 · 动一动' }

export default function ExerciseModulePlaybookPage() {
  return (
    <ModulePage
      spec={MODULE_SPEC_BY_SLUG.exercise!}
      sandbox={<ExerciseFullPageSandbox />}
      compare={<ExerciseVerdictComparisonMatrix />}
      rules={<ExerciseThresholdMatrix />}
    />
  )
}
