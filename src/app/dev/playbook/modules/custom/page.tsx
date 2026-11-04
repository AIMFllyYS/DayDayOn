import type { Metadata } from 'next'
import { ModulePage } from '../_components/module-page'
import { MODULE_SPEC_BY_SLUG } from '../_data/module-specs'
import {
  CustomGoalRuleDesignerDemo,
  CustomModulePhoneSandbox,
  CustomRefereeComparisonMatrix,
} from './_components/custom-module-demos'

export const metadata: Metadata = { title: '自定义板块 · 我的小目标' }

export default function CustomModulePlaybookPage() {
  return (
    <ModulePage
      spec={MODULE_SPEC_BY_SLUG.custom!}
      sandbox={<CustomModulePhoneSandbox />}
      compare={<CustomRefereeComparisonMatrix />}
      rules={<CustomGoalRuleDesignerDemo />}
    />
  )
}
