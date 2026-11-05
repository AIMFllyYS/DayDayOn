import type { Metadata } from 'next'
import { DietFlowSandbox } from './_components/diet-flow'
import { ModulePage } from '../_components/module-page'
import { MODULE_SPEC_BY_SLUG } from '../_data/module-specs'
import {
  DietConstitutionAndRuleSection,
  DietRefereeScenariosMatrix,
} from './_components/diet-demos'

export const metadata: Metadata = { title: '饮食板块 · 好好吃饭' }

export default function DietModulePlaybookPage() {
  return (
    <ModulePage
      spec={MODULE_SPEC_BY_SLUG.diet!}
      sandbox={<DietFlowSandbox />}
      compare={<DietRefereeScenariosMatrix />}
      rules={<DietConstitutionAndRuleSection />}
    />
  )
}
