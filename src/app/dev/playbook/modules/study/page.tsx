import type { Metadata } from 'next'
import { ModulePage } from '../_components/module-page'
import { MODULE_SPEC_BY_SLUG } from '../_data/module-specs'
import {
  StudyDualMechanismDemo,
  StudyModulePhoneSandbox,
  StudyRefereeComparisonMatrix,
} from './_components/study-module-demos'

export const metadata: Metadata = { title: '学习板块 · 学一点' }

export default function StudyModulePlaybookPage() {
  return (
    <ModulePage
      spec={MODULE_SPEC_BY_SLUG.study!}
      sandbox={<StudyModulePhoneSandbox />}
      compare={<StudyRefereeComparisonMatrix />}
      rules={<StudyDualMechanismDemo />}
    />
  )
}
