import type { Metadata } from 'next'
import { ModulePage } from '../_components/module-page'
import { MODULE_SPEC_BY_SLUG } from '../_data/module-specs'
import {
  DietConstitutionAndRuleSection,
  DietFullPageSandbox,
  DietRefereeScenariosMatrix,
} from './_components/diet-demos'

export const metadata: Metadata = { title: '饮食板块 · 好好吃饭' }

export default function DietModulePlaybookPage() {
  return (
    <ModulePage
      spec={MODULE_SPEC_BY_SLUG.diet!}
      sandbox={<DietFullPageSandbox />}
      compare={<DietRefereeScenariosMatrix />}
      rules={<DietConstitutionAndRuleSection />}
    />
  )
}
